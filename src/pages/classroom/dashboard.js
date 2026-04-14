import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import dynamic from 'next/dynamic';
const QRCodeCanvas = dynamic(() => import('qrcode.react').then(m => m.QRCodeCanvas), { ssr: false });

/**
 * 教室管理者ダッシュボード
 * - タブ①受講記録  ②受講者管理
 * - sessionStorage の classroomAuth を用いた認証ガード
 */

// 修了日から有効期限（1年後）を計算
function calcExpiry(completionDate) {
  if (!completionDate) return null;
  const m = completionDate.match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  return `${parseInt(m[1]) + 1}年${m[2]}月${m[3]}日`;
}

const STATUS_LABEL = { active: '在籍中', suspended: '停止中', retired: '退職済' };
const STATUS_COLOR = {
  active:    'bg-green-100 text-green-800 border border-green-300',
  suspended: 'bg-amber-100 text-amber-800 border border-amber-300',
  retired:   'bg-gray-100 text-gray-600 border border-gray-300',
};

export default function ClassroomDashboard() {
  const router = useRouter();

  // 認証情報
  const [auth, setAuth] = useState(null); // { operatorCode, classroomCode, companyName, classroomName }

  // データ
  const [records, setRecords] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);

  // QRコードモーダル
  const [showQr, setShowQr] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // タブ
  const [activeTab, setActiveTab] = useState('records');

  // ステータス変更モーダル
  const [statusModal, setStatusModal] = useState(null); // { id, fullName, currentStatus, notes }
  const [modalStatus, setModalStatus] = useState('active');
  const [modalNotes, setModalNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState('');
  const modalRef = useRef(null);

  // ── 認証チェック ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('classroomAuth') || localStorage.getItem('classroomAuth');
      if (!raw) { router.replace('/classroom/login'); return; }
      const parsed = JSON.parse(raw);
      if (!parsed?.operatorCode || !parsed?.classroomCode) {
        router.replace('/classroom/login');
        return;
      }
      setAuth(parsed);
    } catch {
      router.replace('/classroom/login');
    }
  }, [router]);

  // ── データ取得 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!auth) return;
    (async () => {
      setLoading(true);
      setFetchError('');
      try {
        const [recRes, trnRes] = await Promise.all([
          fetch(`/api/get-operator-records?operatorCode=${encodeURIComponent(auth.operatorCode)}`),
          fetch(`/api/get-trainees?operatorCode=${encodeURIComponent(auth.operatorCode)}&includeRetired=true`),
        ]);
        const recJson = await recRes.json();
        const trnJson = await trnRes.json();

        const allRecords  = recJson.records  || [];
        const allTrainees = trnJson.trainees || [];

        setRecords(allRecords.filter((r) => r.classroomCode === auth.classroomCode));
        setTrainees(allTrainees.filter((t) => t.classroomCode === auth.classroomCode));
      } catch (e) {
        console.error(e);
        setFetchError('データの読み込みに失敗しました。再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  }, [auth]);

  // ── モーダル外クリックで閉じる ──────────────────────────────────
  useEffect(() => {
    if (!statusModal) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        closeModal();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusModal]);

  const openStatusModal = (trainee) => {
    setStatusModal({
      id:            trainee.id,
      fullName:      trainee.fullName || '（氏名なし）',
      currentStatus: trainee.status || 'active',
      notes:         trainee.notes  || '',
    });
    setModalStatus(trainee.status || 'active');
    setModalNotes(trainee.notes   || '');
    setStatusError('');
  };

  const closeModal = () => {
    setStatusModal(null);
    setStatusError('');
  };

  const handleStatusUpdate = async () => {
    if (!statusModal) return;
    setStatusUpdating(true);
    setStatusError('');
    try {
      const res = await fetch('/api/update-trainee-status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: statusModal.id, status: modalStatus, notes: modalNotes }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusError(json.error || 'ステータスの更新に失敗しました。');
        return;
      }
      // ローカルステートを更新
      setTrainees((prev) =>
        prev.map((t) =>
          t.id === statusModal.id
            ? { ...t, status: modalStatus, notes: modalNotes }
            : t
        )
      );
      closeModal();
    } catch {
      setStatusError('通信エラーが発生しました。再度お試しください。');
    } finally {
      setStatusUpdating(false);
    }
  };

  // ── ログアウト ─────────────────────────────────────────────────
  const handleLogout = () => {
    sessionStorage.removeItem('classroomAuth');
    router.push('/classroom/login');
  };

  // ── 派生値 ────────────────────────────────────────────────────
  const passedRecords = records.filter((r) => r.passed);
  const passRate =
    records.length > 0
      ? Math.round((passedRecords.length / records.length) * 100)
      : 0;

  // 最終受講日（受講者ごとに records から引く）
  const lastStudyDate = (trainee) => {
    const recs = records
      .filter((r) => r.traineeName === trainee.fullName || r.traineeId === trainee.id)
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    if (!recs.length) return '—';
    const raw = recs[0].submittedAt || recs[0].date || '';
    if (!raw) return '—';
    return raw.replace('T', ' ').slice(0, 16);
  };

  // ── CSV出力ヘルパー ───────────────────────────────────────────
  const downloadCsv = (filename, rows) => {
    const BOM = '\uFEFF';
    const csv = BOM + rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = (filterMode) => {
    // filterMode: 'all' | 'passed' | 'failed'
    let filtered = records;
    let label = '全件';
    if (filterMode === 'passed') { filtered = records.filter(r => r.passed); label = '合格'; }
    if (filterMode === 'failed') { filtered = records.filter(r => !r.passed); label = '不合格'; }

    const auth = JSON.parse(sessionStorage.getItem('classroomAuth') || localStorage.getItem('classroomAuth') || '{}');
    const filename = `受講記録_${auth.classroomName || ''}_${label}_${new Date().toISOString().slice(0,10)}.csv`;

    const header = ['受講日時', '氏名', '研修種別', '得点', '合否', '修了日', '有効期限', '修了番号'];
    const rows = [header, ...filtered.map(r => [
      r.submittedAt ? new Date(r.submittedAt).toLocaleString('ja-JP') : '',
      r.fullName || '',
      r.track === 'manager' ? '情報管理責任者研修' : '一般研修',
      r.score ?? '',
      r.passed ? '合格' : '不合格',
      r.completionDate || '',
      calcExpiry(r.completionDate) || '',
      r.certNumber || '',
    ])];
    downloadCsv(filename, rows);
  };

  // ── 認証待ち or ローディング ───────────────────────────────────
  if (!auth || loading) {
    return (
      <Layout title="教室管理画面">
        <div className="flex flex-col items-center justify-center py-32 text-green-700">
          <svg
            className="animate-spin h-10 w-10 mb-4 text-green-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <p className="text-sm font-medium">データを読み込んでいます…</p>
        </div>
      </Layout>
    );
  }

  // ── メイン ────────────────────────────────────────────────────
  return (
    <Layout title="教室管理画面">

      {/* ── ページヘッダー ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block bg-green-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full tracking-wide">
              教室管理画面
            </span>
          </div>
          <h1 className="text-xl font-bold text-green-900 leading-snug">
            {auth.companyName}
            <span className="mx-2 text-green-400 font-normal">／</span>
            {auth.classroomName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQr(true)}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 text-sm bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white transition-colors px-4 py-2 rounded-lg shadow-sm font-medium"
          >
            📷 受講画面QRコード
          </button>
          <button
            onClick={handleLogout}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 text-sm bg-white border border-green-300 text-green-700 hover:bg-green-50 active:bg-green-100 transition-colors px-4 py-2 rounded-lg shadow-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            ログアウト
          </button>
        </div>
      </div>

      {/* ── フェッチエラー ── */}
      {fetchError && (
        <div className="mb-5 bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 7a1 1 0 012 0v4a1 1 0 01-2 0V7zm0 6a1 1 0 112 0 1 1 0 01-2 0z"
              clipRule="evenodd" />
          </svg>
          {fetchError}
        </div>
      )}

      {/* ── タブ切替 ── */}
      <div className="flex border-b border-green-200 mb-6 gap-1">
        {[
          { key: 'records',  label: '受講記録' },
          { key: 'trainees', label: '受講者管理' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === key
                ? 'border-green-700 text-green-800 bg-green-50'
                : 'border-transparent text-gray-500 hover:text-green-700 hover:bg-green-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          タブ①：受講記録
          ════════════════════════════════════════ */}
      {activeTab === 'records' && (
        <div>
          {/* CSV出力 */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs text-gray-500 self-center">CSV出力：</span>
            <button onClick={() => exportCsv('all')}
              className="text-xs px-3 py-1.5 rounded-lg border border-green-600 text-green-700 hover:bg-green-50 font-medium transition-colors">
              📥 全件
            </button>
            <button onClick={() => exportCsv('passed')}
              className="text-xs px-3 py-1.5 rounded-lg border border-blue-500 text-blue-700 hover:bg-blue-50 font-medium transition-colors">
              📥 合格のみ
            </button>
            <button onClick={() => exportCsv('failed')}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-400 text-red-600 hover:bg-red-50 font-medium transition-colors">
              📥 不合格のみ
            </button>
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: '受講者数',  value: records.length,        unit: '件' },
              { label: '合格者数',  value: passedRecords.length,  unit: '名' },
              { label: '合格率',    value: `${passRate}`,         unit: '%' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-white rounded-xl border border-green-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                <p className="text-2xl font-bold text-green-800">
                  {value}
                  <span className="text-sm font-normal text-gray-500 ml-0.5">{unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* 受講記録テーブル */}
          {records.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">受講記録がまだありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-green-100 shadow-sm">
              <table className="min-w-full text-sm bg-white">
                <thead>
                  <tr className="bg-green-700 text-white">
                    {['受講日時', '氏名', '研修種別', '得点', '合否', '修了日', '有効期限', '修了番号', '操作'].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const passed = !!r.passed;
                    return (
                      <tr
                        key={r.id || i}
                        className={`border-t border-green-50 ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/40'} hover:bg-green-50 transition-colors`}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 text-xs">
                          {(r.submittedAt || r.date || '—').replace('T', ' ').slice(0, 16)}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                          {r.traineeName || r.fullName || '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                          {r.trainingType || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-gray-800">
                          {r.score !== undefined && r.score !== null ? `${r.score}点` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                            passed
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : 'bg-red-100 text-red-700 border border-red-300'
                          }`}>
                            {passed ? '合格' : '不合格'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 text-xs">
                          {passed ? (r.completionDate || '—') : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 text-xs">
                          {passed ? (calcExpiry(r.completionDate) || '—') : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                          {passed ? (r.certNumber || r.completionNumber || '—') : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {passed ? (
                            <button
                              onClick={() => router.push('/certificate?record=' + r.id)}
                              className="text-xs text-green-700 hover:text-green-900 underline underline-offset-2 font-medium whitespace-nowrap"
                            >
                              修了証再発行
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          タブ②：受講者管理
          ════════════════════════════════════════ */}
      {activeTab === 'trainees' && (
        <div>
          {trainees.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 110-8 4 4 0 010 8z" />
              </svg>
              <p className="text-sm">受講者が登録されていません</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-green-100 shadow-sm">
              <table className="min-w-full text-sm bg-white">
                <thead>
                  <tr className="bg-green-700 text-white">
                    {['氏名', '研修種別', 'ステータス', '最終受講日', '操作'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trainees.map((t, i) => {
                    const statusKey = t.status || 'active';
                    return (
                      <tr
                        key={t.id || i}
                        className={`border-t border-green-50 ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/40'} hover:bg-green-50 transition-colors`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {t.fullName || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {t.trainingType || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[statusKey] || STATUS_COLOR.active}`}>
                            {STATUS_LABEL[statusKey] || statusKey}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {lastStudyDate(t)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => openStatusModal(t)}
                            className="text-xs bg-white border border-green-300 text-green-700 hover:bg-green-50 active:bg-green-100 transition-colors px-3 py-1.5 rounded-lg font-medium shadow-sm"
                          >
                            ステータス変更
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          ステータス変更モーダル
          ════════════════════════════════════════ */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-green-100"
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-green-900">ステータス変更</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 対象者 */}
            <div className="mb-5 bg-green-50 rounded-lg px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5.121 17.804A4 4 0 018 17h8a4 4 0 012.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-semibold text-green-900">{statusModal.fullName}</span>
              <span className="ml-auto text-xs text-gray-500">
                現在：
                <span className={`ml-1 font-semibold ${
                  statusModal.currentStatus === 'active' ? 'text-green-700'
                  : statusModal.currentStatus === 'suspended' ? 'text-amber-700'
                  : 'text-gray-500'
                }`}>
                  {STATUS_LABEL[statusModal.currentStatus] || statusModal.currentStatus}
                </span>
              </span>
            </div>

            {/* ステータス選択 */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-2">新しいステータス</label>
              <div className="flex flex-col gap-2">
                {[
                  { value: 'active',    label: '在籍中',  desc: '通常の受講者として管理されます' },
                  { value: 'suspended', label: '停止中',  desc: '一時的に活動を停止している状態です' },
                  { value: 'retired',   label: '退職済',  desc: '退職・離籍した受講者です' },
                ].map(({ value, label, desc }) => (
                  <label
                    key={value}
                    className={`flex items-start gap-3 cursor-pointer rounded-lg border px-3 py-2.5 transition-colors ${
                      modalStatus === value
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modalStatus"
                      value={value}
                      checked={modalStatus === value}
                      onChange={() => setModalStatus(value)}
                      className="mt-0.5 accent-green-700"
                    />
                    <div>
                      <span className={`text-sm font-semibold ${
                        value === 'active'    ? 'text-green-800'
                        : value === 'suspended' ? 'text-amber-700'
                        : 'text-gray-600'
                      }`}>
                        {label}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 退職警告 */}
            {modalStatus === 'retired' && (
              <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-lg px-3 py-2.5 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-5a1 1 0 00-1 1v2a1 1 0 002 0V9a1 1 0 00-1-1z"
                    clipRule="evenodd" />
                </svg>
                <span>「退職済」に設定すると、受講者が退職扱いになります。受講記録は保持されます。</span>
              </div>
            )}

            {/* 備考 */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                備考 <span className="font-normal text-gray-400">（任意）</span>
              </label>
              <textarea
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="変更理由や補足事項を入力してください"
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 placeholder-gray-300"
              />
            </div>

            {/* エラー */}
            {statusError && (
              <p className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {statusError}
              </p>
            )}

            {/* ボタン */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeModal}
                disabled={statusUpdating}
                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={statusUpdating || modalStatus === statusModal.currentStatus}
                className="px-5 py-2 text-sm text-white bg-green-700 hover:bg-green-800 active:bg-green-900 transition-colors rounded-lg font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {statusUpdating && (
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {statusUpdating ? '更新中…' : '変更を保存'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ════ 受講画面QRコードモーダル ════ */}
      {showQr && auth && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowQr(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">📷 受講画面QRコード</h3>
            <p className="text-sm text-gray-500 mb-1">{auth.classroomName}</p>
            <p className="text-xs text-gray-400 mb-4">（{auth.classroomCode}）</p>
            <div className="flex justify-center mb-3 p-3 bg-white border border-gray-100 rounded-xl">
              <QRCodeCanvas
                id="qr-canvas"
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register?biz=${auth.operatorCode}&cls=${auth.classroomCode}`}
                size={220}
                level="M"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <p className="text-xs text-gray-400 break-all mb-4 bg-gray-50 rounded p-2 text-left">
              {typeof window !== 'undefined' ? `${window.location.origin}/register?biz=${auth.operatorCode}&cls=${auth.classroomCode}` : ''}
            </p>
            <p className="text-xs text-gray-500 mb-4">このQRコードを印刷・配布すると、スタッフがスマホで受講を開始できます。</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const canvas = document.getElementById('qr-canvas');
                  if (!canvas) return;
                  const png = canvas.toDataURL('image/png');
                  const a = document.createElement('a');
                  a.href = png;
                  a.download = `受講画面QR_${auth.classroomCode}.png`;
                  a.click();
                }}
                className="flex-1 bg-purple-700 hover:bg-purple-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                📥 PNG保存
              </button>
              <button onClick={() => setShowQr(false)}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium py-2 rounded-lg transition-colors">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
