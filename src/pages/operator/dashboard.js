import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

/**
 * 事業者管理ダッシュボード
 * /operator/dashboard
 */

function calcExpiry(completionDate) {
  if (!completionDate) return null;
  const m = completionDate.match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  return `${parseInt(m[1]) + 1}年${m[2]}月${m[3]}日`;
}

function calcRemainingDays(completionDate) {
  const expiry = calcExpiry(completionDate);
  if (!expiry) return null;
  const m = expiry.match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  const expiryDate = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
}

function RemainingBadge({ days }) {
  if (days === null || days === undefined) return <span className="text-gray-300">—</span>;
  if (days < 0) return <span className="text-xs font-bold text-red-600">期限切れ</span>;
  if (days <= 30) return <span className="text-xs font-bold text-red-600">残り{days}日</span>;
  if (days <= 60) return <span className="text-xs font-semibold text-amber-600">残り{days}日</span>;
  return <span className="text-xs text-gray-400">残り{days}日</span>;
}
export default function OperatorDashboard() {
  const router = useRouter();
  const [auth, setAuth] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [records, setRecords] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('classrooms');

  // 受講者管理フィルタ
  const [traineeSearch, setTraineeSearch] = useState('');
  const [showRetired, setShowRetired] = useState(false);

  // CSV出力
  const [csvClassroom, setCsvClassroom] = useState('');

  // 教室複数選択
  const [selectedClassrooms, setSelectedClassrooms] = useState(new Set());

  // 教室パスワード表示・変更
  const [showClsPw, setShowClsPw]     = useState(false);
  const [clsPwModal, setClsPwModal]   = useState(null); // { classroomCode, classroomName }
  const [newClsPw, setNewClsPw]       = useState('');
  const [clsPwChanging, setClsPwChanging] = useState(false);
  const [clsPwError, setClsPwError]   = useState('');

  // ステータス変更モーダル（受講者用）
  const [statusModal, setStatusModal] = useState(null);
  const [modalStatus, setModalStatus] = useState('active');
  const [modalNotes, setModalNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  // 教室変更モーダル
  const [clsChangeModal, setClsChangeModal] = useState(null); // { id, fullName, currentCode, currentName }
  const [newClsCode, setNewClsCode] = useState('');
  const [clsChanging, setClsChanging] = useState(false);

  const handleClassroomChange = async () => {
    if (!clsChangeModal || !newClsCode) return;
    const selected = classrooms.find((c) => c.classroomCode === newClsCode);
    if (!selected) return;
    setClsChanging(true);
    try {
      const res = await fetch('/api/update-trainee-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clsChangeModal.id, classroomCode: selected.classroomCode, classroomName: selected.classroomName }),
      });
      if (res.ok) {
        setTrainees((prev) => prev.map((t) =>
          t.id === clsChangeModal.id ? { ...t, classroomCode: selected.classroomCode, classroomName: selected.classroomName } : t
        ));
        setClsChangeModal(null);
        setNewClsCode('');
      }
    } catch (e) { console.error(e); }
    finally { setClsChanging(false); }
  };

  // 再研修URLコピー
  const [copiedTraineeId, setCopiedTraineeId] = useState('');
  const copyRetrainUrl = (traineeId, operatorCode, classroomCode, track) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const trackParam = track === 'manager' ? '&track=manager' : '';
    const url = `${base}/register?biz=${operatorCode}&cls=${classroomCode}${trackParam}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTraineeId(traineeId);
      setTimeout(() => setCopiedTraineeId(''), 2000);
    });
  };

  // 汎用確認モーダル（confirm()の代替）
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm } | { message, errorOnly: true }

  useEffect(() => {
    const stored = sessionStorage.getItem('operatorAuth');
    if (!stored) { router.replace('/operator/login'); return; }
    const parsed = JSON.parse(stored);
    setAuth(parsed);
    fetchData(parsed.operatorCode);
  }, []);

  const fetchData = async (operatorCode) => {
    setLoading(true);
    try {
      const [clsRes, recRes, trnRes] = await Promise.all([
        fetch(`/api/get-classrooms?operatorCode=${operatorCode}`),
        fetch(`/api/get-operator-records?operatorCode=${operatorCode}`),
        fetch(`/api/get-trainees?operatorCode=${operatorCode}&includeRetired=true`),
      ]);
      const clsData = await clsRes.json();
      const recData = await recRes.json();
      const trnData = await trnRes.json();
      setClassrooms(clsData.classrooms || []);
      setRecords(recData.records || []);
      setTrainees(trnData.trainees || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getBaseUrl = () => typeof window !== 'undefined' ? window.location.origin : '';

  const copyUrl = (classroomCode, operatorCode) => {
    const url = `${getBaseUrl()}/register?biz=${operatorCode}&cls=${classroomCode}`;
    navigator.clipboard.writeText(url);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('operatorAuth');
    router.push('/operator/login');
  };

  // 教室ステータス切り替え
  const handleClsStatusToggle = (cls) => {
    const newStatus = cls.status === 'active' ? 'inactive' : 'active';
    const label = newStatus === 'active' ? '有効' : '停止';
    setConfirmModal({
      message: `「${cls.classroomName}」のステータスを「${label}」に変更しますか？`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/update-classroom-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classroomCode: cls.classroomCode, status: newStatus }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) { setConfirmModal({ message: data.error || '変更に失敗しました。', errorOnly: true }); return; }
          setClassrooms((prev) => prev.map((c) =>
            c.classroomCode === cls.classroomCode ? { ...c, status: newStatus } : c
          ));
        } catch { setConfirmModal({ message: '通信エラーが発生しました。', errorOnly: true }); }
      },
    });
  };

  // 教室パスワード変更
  const handleClsPwChange = async (e) => {
    e.preventDefault();
    if (!newClsPw.trim()) { setClsPwError('パスワードを入力してください。'); return; }
    setClsPwChanging(true); setClsPwError('');
    try {
      const res = await fetch('/api/update-classroom-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomCode: clsPwModal.classroomCode, classroomPassword: newClsPw }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setClsPwError(data.error || '変更に失敗しました。'); return; }
      setClsPwModal(null); setNewClsPw('');
      // ローカルのclassrooms stateを即時更新
      setClassrooms(prev => prev.map(c =>
        c.classroomCode === clsPwModal.classroomCode ? { ...c, classroomPassword: newClsPw } : c
      ));
    } catch { setClsPwError('通信エラーが発生しました。'); }
    finally { setClsPwChanging(false); }
  };

  // 受講者フィルタ
  const filteredTrainees = trainees
    .filter((t) => showRetired ? true : t.status !== 'retired')
    .filter((t) => {
      if (!traineeSearch) return true;
      const s = traineeSearch.toLowerCase();
      return (
        (t.fullName || '').includes(traineeSearch) ||
        (t.classroomName || '').includes(traineeSearch) ||
        (t.operatorCode || '').toLowerCase().includes(s)
      );
    });

  const openStatusModal = (trainee) => {
    setStatusModal({ id: trainee.id, fullName: trainee.fullName, currentStatus: trainee.status });
    setModalStatus(trainee.status);
    setModalNotes(trainee.notes || '');
  };

  const handleStatusUpdate = async () => {
    if (!statusModal) return;
    setStatusUpdating(true);
    try {
      const res = await fetch('/api/update-trainee-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: statusModal.id, status: modalStatus, notes: modalNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setTrainees((prev) => prev.map((t) => t.id === statusModal.id ? data.trainee : t));
        setStatusModal(null);
      }
    } catch (e) { console.error(e); }
    finally { setStatusUpdating(false); }
  };

  const statusLabel = (s) => {
    if (s === 'active') return '在籍中';
    if (s === 'retired') return '退職済';
    if (s === 'suspended') return '停止中';
    return s;
  };
  const statusBadge = (s) => {
    if (s === 'active') return 'bg-green-100 text-green-800';
    if (s === 'retired') return 'bg-gray-200 text-gray-600';
    if (s === 'suspended') return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-500';
  };

  // 教室チェックボックス操作
  const toggleClassroom = (code) => {
    setSelectedClassrooms((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };
  const allClsChecked = classrooms.length > 0 && selectedClassrooms.size === classrooms.length;
  const someClsChecked = selectedClassrooms.size > 0 && !allClsChecked;
  const toggleAllClassrooms = () => {
    if (allClsChecked) setSelectedClassrooms(new Set());
    else setSelectedClassrooms(new Set(classrooms.map((c) => c.classroomCode)));
  };

  // 受講記録：選択教室でフィルタ
  const displayedRecords = selectedClassrooms.size > 0
    ? records.filter((r) => selectedClassrooms.has(r.classroomCode))
    : records;

  // CSV出力ユーティリティ
  const downloadCsv = (filename, rows) => {
    const BOM = '\uFEFF';
    const csv = BOM + rows
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRecordsCsv = (filter) => {
    // filter: '' = 全体 / string = 単一教室コード / Set = 複数教室
    const statusMap = { active: '在籍中', retired: '退職済', suspended: '停止中' };
    let filtered;
    let label;
    if (!filter || (filter instanceof Set && filter.size === 0)) {
      filtered = records;
      label = '全体';
    } else if (filter instanceof Set) {
      filtered = records.filter((r) => filter.has(r.classroomCode));
      label = `選択${filter.size}教室`;
    } else {
      filtered = records.filter((r) => r.classroomCode === filter);
      label = filter;
    }
    const header = [
      '受講日時', '教室コード', '教室名', '氏名',
      '研修種別', '得点', '合否', '修了日', '修了番号', '在籍ステータス',
    ];
    const rows = filtered.map((r) => {
      const trainee = trainees.find(
        (t) => t.fullName === r.fullName && t.operatorCode === (r.operatorCode || r.memberCode)
      );
      return [
        r.submittedAt ? new Date(r.submittedAt).toLocaleString('ja-JP') : '',
        r.classroomCode || '',
        r.classroomName || '',
        r.fullName || '',
        r.track === 'manager' ? '情報管理責任者研修' : '一般研修',
        r.score != null ? `${r.score}%` : '',
        r.passed ? '合格' : '不合格',
        r.completionDate || '',
        r.certNumber || '',
        trainee ? (statusMap[trainee.status] || trainee.status) : '—',
      ];
    });
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`受講記録_${auth.operatorCode}_${label}_${date}.csv`, [header, ...rows]);
  };

  if (!auth) return null;

  const passedCount = records.filter((r) => r.passed).length;

  // 有効期限が30日以内に迫っている在籍中受講者（警告バナー用）
  const expiringTrainees = trainees
    .filter((t) => t.status === 'active')
    .reduce((acc, t) => {
      const latestPassed = records
        .filter((r) => r.passed && r.fullName === t.fullName)
        .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))[0];
      if (!latestPassed) return acc;
      const remaining = calcRemainingDays(latestPassed.completionDate);
      if (remaining !== null && remaining <= 30) {
        acc.push({ ...t, remaining });
      }
      return acc;
    }, [])
    .sort((a, b) => a.remaining - b.remaining);

  const hqClassroom = classrooms.find((c) => c.isHQ);
  const hqUrl = hqClassroom
    ? `${getBaseUrl()}/register?biz=${auth.operatorCode}&cls=${hqClassroom.classroomCode}`
    : `${getBaseUrl()}/register?biz=${auth.operatorCode}`;
  const managerUrl = `${getBaseUrl()}/register?biz=${auth.operatorCode}&cls=${auth.operatorCode}-HQ&track=manager`;

  return (
    <Layout title="事業者管理画面">
      <div>
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{auth.companyName}</h1>
            <p className="text-xs text-gray-500 mt-0.5">事業者コード：{auth.operatorCode} ／ 事業者管理画面</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/operator/import')}
              className="px-3 py-2 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors">
              教室CSV取込
            </button>
            <button onClick={handleLogout}
              className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors">
              ログアウト
            </button>
          </div>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">教室数</p>
            <p className="text-2xl font-bold text-gray-900">{classrooms.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-green-300 p-4 text-center">
            <p className="text-xs text-green-700 mb-1">合格者数</p>
            <p className="text-2xl font-bold text-green-700">{passedCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">総受講数</p>
            <p className="text-2xl font-bold text-gray-900">{records.length}</p>
          </div>
        </div>

        {/* 有効期限間近の警告バナー */}
        {expiringTrainees.length > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-lg mt-0.5 flex-shrink-0">⚠️</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800 mb-1">研修の有効期間が残り1か月を切った受講者がいます</p>
              <p className="text-xs text-amber-700 mb-2">
                以下の方々の研修有効期間が残り30日以内です。在籍中の場合は再研修の手続きを、退職済みの場合はステータス変更をご検討ください。
              </p>
              <ul className="space-y-1">
                {expiringTrainees.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className={`font-bold px-2 py-0.5 rounded whitespace-nowrap ${item.remaining < 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {item.remaining < 0 ? '期限切れ' : `残り${item.remaining}日`}
                    </span>
                    <span className="text-amber-900 font-medium">{item.classroomName}　{item.fullName}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 本部スタッフ向けURL + 情報管理責任者URL */}
        <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2">
          {/* 本部スタッフ向け一般研修URL */}
          <div className="bg-green-50 border border-green-300 rounded-xl px-5 py-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-green-800 mb-0.5">🏢 本部スタッフ向け受講URL</p>
              <p className="text-xs text-green-700">教室に所属しない本部・事務局スタッフ（一般研修）はこちらのURLから受講できます。</p>
              <p className="text-xs font-mono text-green-600 mt-1 break-all">{hqUrl}</p>
            </div>
            <HqCopyButton url={hqUrl} label="本部URLをコピー" />
          </div>

          {/* 情報管理責任者向け研修URL */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-amber-800 mb-0.5">📋 情報管理責任者向け受講URL</p>
              <p className="text-xs text-amber-700">情報管理責任者に指定された方はこちらのURLから専用研修を受講してください。</p>
              <p className="text-xs font-mono text-amber-600 mt-1 break-all">{managerUrl}</p>
            </div>
            <HqCopyButton url={managerUrl} label="責任者URLをコピー" colorClass="amber" />
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-green-200">
          {[
            { key: 'classrooms', label: '教室一覧・URL発行' },
            { key: 'records', label: '受講記録' },
            { key: 'trainees', label: '受講者管理' },
            { key: 'certificates', label: '修了証再発行' },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-green-700 text-green-800 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-green-700 hover:bg-green-50'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-12 text-gray-500 text-sm">読み込み中...</div>}

        {/* 教室一覧・URL発行 */}
        {!loading && activeTab === 'classrooms' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-xs text-blue-800">
              <p className="font-semibold mb-1">📋 教室管理について</p>
              <p>「📋 教室管理へ」で各教室の受講記録・受講者管理・QRコード発行が行えます。教室のログインIDとパスワードもここで確認・変更できます。</p>
            </div>
            {/* 選択アクションバー */}
            {selectedClassrooms.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 bg-green-700 text-white px-4 py-2.5 rounded-xl mb-3 text-sm">
                <span className="font-semibold">{selectedClassrooms.size} 教室を選択中</span>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => { setActiveTab('records'); }}
                    className="px-3 py-1.5 text-xs font-semibold bg-white text-green-800 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap">
                    受講記録を表示
                  </button>
                  <button
                    onClick={() => exportRecordsCsv(selectedClassrooms)}
                    className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-500 border border-green-400 text-white rounded-lg transition-colors whitespace-nowrap">
                    ↓ CSVで出力
                  </button>
                  <button
                    onClick={() => setSelectedClassrooms(new Set())}
                    className="px-3 py-1.5 text-xs text-green-200 hover:text-white transition-colors whitespace-nowrap">
                    選択解除
                  </button>
                </div>
              </div>
            )}

            {classrooms.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-green-200">
                教室が登録されていません。「教室CSV取込」から追加してください。
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-green-50 border-b border-green-200">
                    <tr>
                      {/* 全選択チェックボックス */}
                      <th className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allClsChecked}
                          ref={(el) => { if (el) el.indeterminate = someClsChecked; }}
                          onChange={toggleAllClassrooms}
                          className="w-4 h-4 accent-green-700 cursor-pointer"
                          title="全選択 / 全解除"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">教室コード</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">教室名</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">受講者数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">合格者数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">ステータス</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">
                        <div className="flex items-center gap-1">
                          <span>教室PW</span>
                          <button onClick={() => setShowClsPw(v => !v)}
                            className="text-xs px-1 py-0.5 rounded border border-green-400 text-green-700 hover:bg-green-100 transition-colors">
                            {showClsPw ? '🙈' : '👁'}
                          </button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">PW変更</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">教室管理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-50">
                    {classrooms.map((cls, idx) => {
                      const isChecked = selectedClassrooms.has(cls.classroomCode);
                      return (
                        <tr
                          key={idx}
                          onClick={() => toggleClassroom(cls.classroomCode)}
                          className={`cursor-pointer transition-colors ${isChecked ? 'bg-green-50' : cls.isHQ ? 'bg-green-50/50' : 'hover:bg-green-50'}`}>
                          <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleClassroom(cls.classroomCode)}
                              className="w-4 h-4 accent-green-700 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {cls.classroomCode}
                            {cls.isHQ && <span className="ml-1 text-xs bg-green-700 text-white px-1.5 py-0.5 rounded-full">本部</span>}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900">{cls.classroomName}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-600">{cls.totalTrainees ?? 0}</td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-green-700">{cls.passedTrainees ?? 0}</td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleClsStatusToggle(cls)}
                              title="クリックでステータス変更"
                              className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${cls.status === 'active' ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-100 hover:text-red-700 hover:border-red-300' : 'bg-gray-200 text-gray-500 border-gray-300 hover:bg-green-100 hover:text-green-800 hover:border-green-300'}`}>
                              {cls.status === 'active' ? '有効' : '停止'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" onClick={(e) => e.stopPropagation()}>
                            {showClsPw
                              ? <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold select-all">{cls.classroomPassword || cls.classroomCode}</span>
                              : <span className="text-gray-300 tracking-widest">••••••</span>}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => { setClsPwModal({ classroomCode: cls.classroomCode, classroomName: cls.classroomName }); setNewClsPw(''); setClsPwError(''); }}
                              className="text-xs px-2 py-1 rounded border border-amber-400 text-amber-700 hover:bg-amber-50 transition-colors">
                              🔑 変更
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {cls.status === 'active' && (
                              <button
                                onClick={() => {
                                  localStorage.setItem('classroomAuth', JSON.stringify({
                                    operatorCode: auth.operatorCode,
                                    classroomCode: cls.classroomCode,
                                    companyName: auth.companyName,
                                    classroomName: cls.classroomName,
                                  }));
                                  window.open('/classroom/dashboard', '_blank');
                                }}
                                className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap">
                                📋 教室管理へ
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 flex items-center justify-between">
                  <span>{selectedClassrooms.size > 0 ? `${selectedClassrooms.size} / ${classrooms.length} 教室を選択中` : '行をクリックして教室を選択できます'}</span>
                  <span>{classrooms.length} 教室</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* 受講記録 */}
        {!loading && activeTab === 'records' && (
          <>
            {/* 教室フィルタ中バナー */}
            {selectedClassrooms.size > 0 && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-xl px-4 py-2.5 mb-3 text-xs">
                <span className="font-semibold text-green-800">
                  {selectedClassrooms.size} 教室でフィルタ中：
                  {classrooms
                    .filter((c) => selectedClassrooms.has(c.classroomCode))
                    .map((c) => c.classroomName)
                    .join('、')}
                </span>
                <button
                  onClick={() => setSelectedClassrooms(new Set())}
                  className="ml-auto text-green-600 hover:text-green-800 font-semibold whitespace-nowrap transition-colors">
                  ✕ フィルタ解除
                </button>
              </div>
            )}

            {/* CSV出力バー */}
            {records.length > 0 && (
              <div className="bg-white border border-green-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">📥 CSV出力</span>
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  {selectedClassrooms.size > 0 ? (
                    <>
                      <button
                        onClick={() => exportRecordsCsv(selectedClassrooms)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors whitespace-nowrap">
                        ↓ 選択した {selectedClassrooms.size} 教室
                      </button>
                      <button
                        onClick={() => exportRecordsCsv('')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-green-50 text-green-700 border border-green-400 rounded-lg transition-colors whitespace-nowrap">
                        ↓ 事業者全体
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => exportRecordsCsv('')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors whitespace-nowrap">
                        ↓ 事業者全体
                      </button>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={csvClassroom}
                          onChange={(e) => setCsvClassroom(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500">
                          <option value="">教室を選択</option>
                          {classrooms.map((c) => (
                            <option key={c.classroomCode} value={c.classroomCode}>
                              {c.classroomName}（{c.classroomCode}）
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => csvClassroom && exportRecordsCsv(csvClassroom)}
                          disabled={!csvClassroom}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed text-green-700 border border-green-400 rounded-lg transition-colors whitespace-nowrap">
                          ↓ 教室別
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {displayedRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-green-200">
                {records.length === 0 ? '受講記録がありません。' : '選択した教室の受講記録がありません。'}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-green-50 border-b border-green-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">受講日時</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">教室コード</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">教室名</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">氏名</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">得点</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">研修種別</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">合否</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">修了日</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">有効期限</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {displayedRecords.map((r, idx) => (
                        <tr key={idx} className="hover:bg-green-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.classroomCode || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{r.classroomName || '—'}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{r.fullName || '—'}</td>
                          <td className="px-4 py-3 text-xs text-center font-semibold">{r.score != null ? `${r.score}%` : '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {r.track === 'manager'
                              ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">情報管理</span>
                              : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">一般</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                              {r.passed ? '合格' : '不合格'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{r.completionDate || '—'}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {r.passed && r.completionDate ? (
                              <div>
                                <div className="text-gray-600">{calcExpiry(r.completionDate) || '—'}</div>
                                <RemainingBadge days={calcRemainingDays(r.completionDate)} />
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => copyRetrainUrl(r.id, r.operatorCode || r.memberCode, r.classroomCode, r.track)}
                              className={`text-xs px-2 py-1 rounded border transition-colors whitespace-nowrap ${
                                copiedTraineeId === r.id
                                  ? 'bg-green-700 text-white border-green-700'
                                  : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'
                              }`}
                            >
                              {copiedTraineeId === r.id ? '✓ コピー済' : '🔗 再研修URL'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 text-right">
                  {displayedRecords.length} 件{selectedClassrooms.size > 0 && `（全 ${records.length} 件中）`}
                </div>
              </div>
            )}
          </>
        )}

        {/* 受講者管理 */}
        {!loading && activeTab === 'trainees' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-xs text-blue-800">
              <p className="font-semibold mb-0.5">ℹ️ 受講者管理について</p>
              <p>退職・停止はステータス変更のみです。受講記録・修了証は保持されます。</p>
            </div>

            {/* フィルタ */}
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="text" value={traineeSearch} onChange={(e) => setTraineeSearch(e.target.value)}
                placeholder="氏名・教室名で検索..."
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 select-none">
                <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)}
                  className="w-4 h-4 accent-gray-600" />
                退職者を含む
              </label>
            </div>

            {filteredTrainees.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-green-200">
                {trainees.length === 0 ? '受講者データがありません。' : '条件に一致する受講者がいません。'}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-green-50 border-b border-green-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">氏名</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">教室名</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">研修種別</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">ステータス</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">登録日</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">退職日</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">メモ</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">有効期限</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {filteredTrainees.map((t, idx) => {
                        const latestPassed = records
                          .filter((r) => r.passed && r.fullName === t.fullName)
                          .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))[0];
                        const expiryDate = latestPassed ? calcExpiry(latestPassed.completionDate) : null;
                        const remainingDays = latestPassed ? calcRemainingDays(latestPassed.completionDate) : null;
                        return (
                        <tr key={idx} className={`transition-colors ${t.status === 'retired' ? 'opacity-60 bg-gray-50' : 'hover:bg-green-50'}`}>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{t.fullName || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{t.classroomName || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {t.track === 'manager'
                              ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">情報管理</span>
                              : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">一般</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge(t.status)}`}>
                              {statusLabel(t.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{t.registeredAt || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {t.retiredAt ? new Date(t.retiredAt).toLocaleDateString('ja-JP') : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-28 truncate" title={t.notes}>{t.notes || '—'}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {expiryDate ? (
                              <div>
                                <div className="text-gray-600">{expiryDate}</div>
                                <RemainingBadge days={remainingDays} />
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center gap-2 justify-center flex-wrap">
                              <button onClick={() => openStatusModal(t)}
                                className="text-xs px-2.5 py-1 bg-white border border-green-400 text-green-700 hover:bg-green-50 rounded transition-colors whitespace-nowrap">
                                ステータス変更
                              </button>
                              <button
                                onClick={() => { setClsChangeModal({ id: t.id, fullName: t.fullName, currentCode: t.classroomCode, currentName: t.classroomName }); setNewClsCode(t.classroomCode || ''); }}
                                className="text-xs px-2.5 py-1 bg-white border border-orange-300 text-orange-600 hover:bg-orange-50 rounded transition-colors whitespace-nowrap"
                              >
                                🏫 教室変更
                              </button>
                              <button
                                onClick={() => copyRetrainUrl(t.id, t.operatorCode, t.classroomCode, t.track)}
                                className={`text-xs px-2.5 py-1 rounded border transition-colors whitespace-nowrap ${
                                  copiedTraineeId === t.id
                                    ? 'bg-green-700 text-white border-green-700'
                                    : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'
                                }`}
                              >
                                {copiedTraineeId === t.id ? '✓ コピー済' : '🔗 再研修URL'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 text-right">
                  {filteredTrainees.length} 件表示（全 {trainees.length} 件）
                </div>
              </div>
            )}
          </>
        )}

        {/* 修了証再発行 */}
        {!loading && activeTab === 'certificates' && (
          <CertificatesTab records={records.filter((r) => r.passed)} />
        )}
      </div>

      {/* ===== ステータス変更モーダル ===== */}
      {statusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl border border-green-200 w-full max-w-md">
          <div className="px-6 py-4 border-b border-green-100">
            <h2 className="text-base font-bold text-gray-900">ステータス変更</h2>
            <p className="text-sm text-gray-500 mt-0.5">{statusModal.fullName}</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">新しいステータス</label>
              <div className="flex gap-2">
                {[
                  { val: 'active', label: '在籍中', color: 'green' },
                  { val: 'suspended', label: '停止中', color: 'orange' },
                  { val: 'retired', label: '退職済', color: 'gray' },
                ].map((s) => (
                  <button key={s.val} onClick={() => setModalStatus(s.val)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      modalStatus === s.val
                        ? s.color === 'green' ? 'bg-green-700 text-white border-green-700'
                          : s.color === 'orange' ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-gray-500 text-white border-gray-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ（任意）</label>
              <textarea value={modalNotes} onChange={(e) => setModalNotes(e.target.value)}
                placeholder="退職理由・備考など"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            {modalStatus === 'retired' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                退職済に変更しても受講記録・修了証は保持されます。
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-green-100 flex justify-end gap-3">
            <button onClick={() => setStatusModal(null)}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
            <button onClick={handleStatusUpdate} disabled={statusUpdating}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-800 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors">
              {statusUpdating ? '更新中...' : '変更を保存'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ===== 教室パスワード変更モーダル ===== */}
      {clsPwModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setClsPwModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">🔑 教室パスワード変更</h3>
            <p className="text-sm text-gray-500 mb-1">{clsPwModal.classroomName}</p>
            <p className="text-xs font-mono text-gray-400 mb-4">({clsPwModal.classroomCode})</p>
            <form onSubmit={handleClsPwChange} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード</label>
                <input value={newClsPw} onChange={e => setNewClsPw(e.target.value)}
                  type="text" placeholder="新しいパスワードを入力" required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400" />
                <p className="text-xs text-gray-400 mt-1">変更後は教室長へ新しいパスワードをお伝えください。</p>
              </div>
              {clsPwError && <p className="text-xs text-red-600">{clsPwError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={clsPwChanging}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  {clsPwChanging ? '変更中...' : '変更する'}
                </button>
                <button type="button" onClick={() => setClsPwModal(null)}
                  className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== 教室変更モーダル ===== */}
      {clsChangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-orange-200 w-full max-w-sm">
            <div className="px-6 py-4 border-b border-orange-100">
              <h2 className="text-base font-bold text-gray-900">🏫 所属教室の変更</h2>
              <p className="text-sm text-gray-500 mt-0.5">{clsChangeModal.fullName}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">現在の教室</p>
                <p className="text-sm font-semibold text-gray-700">{clsChangeModal.currentName}（{clsChangeModal.currentCode}）</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">変更先の教室</label>
                <select
                  value={newClsCode}
                  onChange={(e) => setNewClsCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">選択してください</option>
                  {classrooms.map((c) => (
                    <option key={c.classroomCode} value={c.classroomCode}>
                      {c.classroomName}（{c.classroomCode}）
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-400">※ 過去の受講記録はそのまま保持されます。</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={handleClassroomChange}
                disabled={clsChanging || !newClsCode || newClsCode === clsChangeModal.currentCode}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {clsChanging ? '変更中...' : '変更する'}
              </button>
              <button
                onClick={() => { setClsChangeModal(null); setNewClsCode(''); }}
                className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 汎用確認モーダル ===== */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-200">
            <div className="flex flex-col items-center text-center mb-5">
              {confirmModal.errorOnly ? (
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ) : (
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
              )}
              <p className="text-sm text-gray-800 font-medium">{confirmModal.message}</p>
            </div>
            <div className="flex gap-2 justify-center">
              {confirmModal.errorOnly ? (
                <button onClick={() => setConfirmModal(null)}
                  className="px-6 py-2 text-sm font-semibold text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                  閉じる
                </button>
              ) : (
                <>
                  <button onClick={() => setConfirmModal(null)}
                    className="flex-1 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    キャンセル
                  </button>
                  <button onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }}
                    className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg transition-colors">
                    変更する
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// URLコピーボタン（大きめ・カラー対応）
function HqCopyButton({ url, label = 'URLをコピー', colorClass = 'green' }) {
  const [copied, setCopied] = useState(false);
  const colors = colorClass === 'amber'
    ? { active: 'bg-amber-600 text-white border-amber-600', idle: 'bg-white text-amber-700 border-amber-500 hover:bg-amber-50' }
    : { active: 'bg-green-700 text-white border-green-700', idle: 'bg-white text-green-700 border-green-500 hover:bg-green-100' };
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`self-start text-sm font-semibold px-4 py-2 rounded-lg border transition-colors whitespace-nowrap ${
        copied ? colors.active : colors.idle
      }`}>
      {copied ? '✓ コピー済み' : label}
    </button>
  );
}

// URLコピーボタン（コピー済みフィードバック付き）
function UrlCopyButton({ onClick }) {
  const [copied, setCopied] = useState(false);
  const handleClick = () => {
    onClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleClick}
      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
        copied ? 'bg-green-700 text-white border-green-700' : 'bg-white text-green-700 border-green-400 hover:bg-green-50'
      }`}>
      {copied ? '✓ コピー済' : 'URLコピー'}
    </button>
  );
}

// 修了証再発行タブ
function CertificatesTab({ records }) {
  const router = useRouter();
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-green-200">
        合格者の記録がありません。
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-green-50 border-b border-green-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">修了日</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">教室名</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">氏名</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">修了番号</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">修了証</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-green-50">
            {records.map((r, idx) => (
              <tr key={idx} className="hover:bg-green-50 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{r.completionDate || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{r.classroomName || '—'}</td>
                <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{r.fullName || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.certNumber || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => router.push(`/certificate?record=${r.id}`)}
                    className="text-xs px-2.5 py-1 bg-green-700 hover:bg-green-600 text-white rounded border border-green-700 transition-colors">
                    PDF再発行
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 text-right">
        合格者 {records.length} 名
      </div>
    </div>
  );
}
