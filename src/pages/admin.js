import { useState } from 'react';
import Layout from '../components/Layout';
import dynamic from 'next/dynamic';
const QRCodeCanvas = dynamic(() => import('qrcode.react').then(m => m.QRCodeCanvas), { ssr: false });

/**
 * JJA 協会本部 管理画面
 * - 全事業者・全教室・全受講記録・受講者管理を横断閲覧
 * - タブ①受講記録 ②事業者一覧 ③教室一覧 ④受講者管理
 */

const ADMIN_PASSWORD = 'admin2024';

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

function getBaseUrl() {
  return typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [inputPw, setInputPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [activeTab, setActiveTab] = useState('records');

  const [records, setRecords] = useState([]);
  const [operators, setOperators] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(false);

  // 受講記録フィルタ
  const [filterPassed, setFilterPassed] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState('submittedAt');
  const [sortDir, setSortDir] = useState('desc');

  // 事業者フィルタ
  const [opSearch, setOpSearch] = useState('');
  const [opFilter, setOpFilter] = useState('all');

  // 教室フィルタ
  const [clsSearch, setClsSearch] = useState('');
  const [clsOpFilter, setClsOpFilter] = useState('');

  // 受講者管理フィルタ
  const [traineeSearch, setTraineeSearch] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const [traineeOpFilter, setTraineeOpFilter] = useState('');

  // ステータス変更モーダル
  const [statusModal, setStatusModal] = useState(null); // { id, fullName, currentStatus, notes }
  const [modalStatus, setModalStatus] = useState('active');
  const [modalNotes, setModalNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  // URLコピー
  const [copiedKey, setCopiedKey] = useState('');

  // 汎用確認モーダル（confirm()の代替）
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }

  // パスワード表示トグル
  const [showPasswords, setShowPasswords] = useState(false);

  // 事業者パスワード変更モーダル
  const [pwChangeModal, setPwChangeModal] = useState(null); // { operatorCode, companyName }
  const [newPwValue, setNewPwValue]       = useState('');
  const [pwChanging, setPwChanging]       = useState(false);
  const [pwChangeError, setPwChangeError] = useState('');

  // 教室パスワード変更モーダル
  const [clsPwModal, setClsPwModal]   = useState(null); // { classroomCode, classroomName }
  const [newClsPw, setNewClsPw]       = useState('');
  const [clsPwChanging, setClsPwChanging] = useState(false);
  const [clsPwError, setClsPwError]   = useState('');
  const [showClsPasswords, setShowClsPasswords] = useState(false);

  // QRコードモーダル（再研修URL用）
  const [qrModal, setQrModal] = useState(null); // { url, title }
  const getRetrainUrl = (operatorCode, classroomCode, track) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const trackParam = track === 'manager' ? '&track=manager' : '';
    return `${base}/register?biz=${operatorCode}&cls=${classroomCode}${trackParam}`;
  };

  // 自動削除（クリーンアップ）
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult]   = useState(null); // 最新実行結果
  const [cleanupDryResult, setCleanupDryResult] = useState(null); // 試算結果

  const runCleanupApi = async (dryRun) => {
    setCleanupRunning(true);
    try {
      const res = await fetch('/api/cron/cleanup-trainees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (dryRun) {
        setCleanupDryResult(data);
      } else {
        setCleanupResult(data);
        setCleanupDryResult(null);
        // 受講者一覧を再取得して画面を更新
        const trnRes = await fetch('/api/get-trainees?includeRetired=true');
        setTrainees((await trnRes.json()).trainees || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCleanupRunning(false);
    }
  };

  // 新規事業者登録フォーム
  const [showAddOpForm, setShowAddOpForm]   = useState(false);
  const [newOpCode, setNewOpCode]           = useState('');
  const [newOpName, setNewOpName]           = useState('');
  const [newOpContact, setNewOpContact]     = useState('');
  const [newOpPassword, setNewOpPassword]   = useState('');
  const [addOpError, setAddOpError]         = useState('');
  const [addOpLoading, setAddOpLoading]     = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (inputPw !== ADMIN_PASSWORD) { setPwError('パスワードが正しくありません。'); return; }
    setAuthed(true);
    setLoading(true);
    try {
      const [recRes, opRes, clsRes, trnRes] = await Promise.all([
        fetch('/api/get-records'),
        fetch('/api/get-operators?includePasswords=true'),
        fetch('/api/get-classrooms'),
        fetch('/api/get-trainees?includeRetired=true'),
      ]);
      setRecords((await recRes.json()).records || []);
      setOperators((await opRes.json()).operators || []);
      setClassrooms((await clsRes.json()).classrooms || []);
      setTrainees((await trnRes.json()).trainees || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [recRes, opRes, clsRes, trnRes] = await Promise.all([
        fetch('/api/get-records'),
        fetch('/api/get-operators?includePasswords=true'),
        fetch('/api/get-classrooms'),
        fetch('/api/get-trainees?includeRetired=true'),
      ]);
      setRecords((await recRes.json()).records || []);
      setOperators((await opRes.json()).operators || []);
      setClassrooms((await clsRes.json()).classrooms || []);
      setTrainees((await trnRes.json()).trainees || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const copyUrl = (key, url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    });
  };

  // ===== 受講記録フィルタ =====
  const filteredRecords = records
    .filter((r) => filterPassed === 'all' ? true : filterPassed === 'passed' ? r.passed : !r.passed)
    .filter((r) => {
      if (!searchText) return true;
      const t = searchText.toLowerCase();
      return (
        (r.fullName || '').includes(searchText) ||
        (r.companyName || '').includes(searchText) ||
        (r.classroomName || '').includes(searchText) ||
        (r.operatorCode || r.memberCode || '').toLowerCase().includes(t)
      );
    })
    .sort((a, b) => {
      const av = a[sortField] ?? ''; const bv = b[sortField] ?? '';
      const cmp = av > bv ? 1 : av < bv ? -1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };
  const SortIcon = ({ field }) => sortField === field ? <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span> : null;

  const passedCount = records.filter((r) => r.passed).length;

  // ===== 事業者フィルタ =====
  const filteredOperators = operators
    .filter((o) => opFilter === 'all' ? true : o.status === opFilter)
    .filter((o) => {
      if (!opSearch) return true;
      const t = opSearch.toLowerCase();
      return (o.operatorCode || '').toLowerCase().includes(t) ||
        (o.companyName || '').includes(opSearch) ||
        (o.contactName || '').includes(opSearch);
    });

  // ===== 教室フィルタ =====
  const filteredClassrooms = classrooms
    .filter((c) => !clsOpFilter || c.operatorCode === clsOpFilter)
    .filter((c) => {
      if (!clsSearch) return true;
      const t = clsSearch.toLowerCase();
      return (c.classroomCode || '').toLowerCase().includes(t) ||
        (c.classroomName || '').includes(clsSearch) ||
        (c.operatorCode || '').toLowerCase().includes(t);
    });

  // ===== 受講者フィルタ =====
  const filteredTrainees = trainees
    .filter((t) => showRetired ? true : t.status !== 'retired')
    .filter((t) => !traineeOpFilter || t.operatorCode === traineeOpFilter)
    .filter((t) => {
      if (!traineeSearch) return true;
      const s = traineeSearch.toLowerCase();
      return (
        (t.fullName || '').includes(traineeSearch) ||
        (t.operatorCode || '').toLowerCase().includes(s) ||
        (t.companyName || '').includes(traineeSearch) ||
        (t.classroomName || '').includes(traineeSearch)
      );
    });

  const activeTrainees = trainees.filter((t) => t.status === 'active').length;
  const retiredTrainees = trainees.filter((t) => t.status === 'retired').length;
  const suspendedTrainees = trainees.filter((t) => t.status === 'suspended').length;

  // ===== ステータス変更モーダル =====
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

  const handleAddOperator = async (e) => {
    e.preventDefault();
    setAddOpError('');
    setAddOpLoading(true);
    try {
      const res = await fetch('/api/add-operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorCode: newOpCode,
          companyName:  newOpName,
          contactName:  newOpContact,
          adminPassword: newOpPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAddOpError(data.error || '登録に失敗しました。');
      } else {
        // Reset form and refresh operator list
        setShowAddOpForm(false);
        setNewOpCode(''); setNewOpName(''); setNewOpContact(''); setNewOpPassword('');
        await refresh();  // refresh() is already defined in the file
      }
    } catch {
      setAddOpError('通信エラーが発生しました。');
    } finally {
      setAddOpLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPwValue.trim()) { setPwChangeError('パスワードを入力してください。'); return; }
    setPwChanging(true); setPwChangeError('');
    try {
      const res = await fetch('/api/update-operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorCode: pwChangeModal.operatorCode, adminPassword: newPwValue }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPwChangeError(data.error || '変更に失敗しました。'); return; }
      setPwChangeModal(null); setNewPwValue('');
      await refresh();
    } catch { setPwChangeError('通信エラーが発生しました。'); }
    finally { setPwChanging(false); }
  };

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
      await refresh();
    } catch { setClsPwError('通信エラーが発生しました。'); }
    finally { setClsPwChanging(false); }
  };

  // 事業者ステータス切り替え
  const handleOpStatusToggle = (op) => {
    const newStatus = op.status === 'active' ? 'inactive' : 'active';
    const label = newStatus === 'active' ? '有効' : '停止';
    setConfirmModal({
      message: `「${op.companyName}」のステータスを「${label}」に変更しますか？`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/update-operator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operatorCode: op.operatorCode, status: newStatus }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) { setConfirmModal({ message: data.error || '変更に失敗しました。', errorOnly: true }); return; }
          setOperators((prev) => prev.map((o) =>
            o.operatorCode === op.operatorCode ? { ...o, status: newStatus } : o
          ));
        } catch { setConfirmModal({ message: '通信エラーが発生しました。', errorOnly: true }); }
      },
    });
  };

  // 教室ステータス切り替え（admin用）
  const handleAdminClsStatusToggle = (cls) => {
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

  // ========== ログイン前 ==========
  if (!authed) {
    return (
      <Layout title="JJA管理画面">
        <div className="max-w-sm mx-auto mt-12">
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">JJA 協会管理画面</h1>
            <p className="text-sm text-gray-500 text-center mb-6">管理者パスワードを入力してください</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                <input type="password" value={inputPw} onChange={(e) => setInputPw(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="パスワードを入力" autoFocus />
                {pwError && <p className="mt-1 text-xs text-red-600">{pwError}</p>}
              </div>
              <button type="submit" className="w-full bg-green-800 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition-colors">
                ログイン
              </button>
            </form>
            <p className="mt-4 text-xs text-gray-400 text-center">※ 協会事務局専用</p>
          </div>
        </div>
      </Layout>
    );
  }

  // 有効期限が30日以内に迫っている在籍中受講者（警告バナー用）
  const expiringTrainees = trainees
    .filter((t) => t.status === 'active')
    .reduce((acc, t) => {
      const latestPassed = records
        .filter((r) => r.passed && r.fullName === t.fullName &&
          (r.operatorCode || r.memberCode || '') === (t.operatorCode || ''))
        .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))[0];
      if (!latestPassed) return acc;
      const remaining = calcRemainingDays(latestPassed.completionDate);
      if (remaining !== null && remaining <= 30) {
        acc.push({ ...t, remaining });
      }
      return acc;
    }, [])
    .sort((a, b) => a.remaining - b.remaining);

  const tabs = [
    { key: 'records', label: '受講記録', count: records.length },
    { key: 'operators', label: '事業者一覧', count: operators.length },
    { key: 'classrooms', label: '教室一覧', count: classrooms.length },
    { key: 'trainees', label: '受講者管理', count: trainees.length },
    { key: 'cleanup', label: '🗑️ 自動削除', count: null },
  ];

  return (
    <Layout title="JJA管理画面">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">JJA 協会管理画面</h1>
            <p className="text-sm text-gray-500 mt-0.5">全事業者・全受講記録を閲覧（試作版）</p>
          </div>
          <button onClick={refresh} disabled={loading}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 border border-gray-300 rounded-lg transition-colors">
            {loading ? '読込中...' : '更新'}
          </button>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: '事業者数', val: operators.filter(o => o.status === 'active').length, sub: `全${operators.length}社`, color: 'green' },
            { label: '教室数', val: classrooms.filter(c => c.status === 'active').length, sub: `全${classrooms.length}室`, color: 'green' },
            { label: '合格者', val: passedCount, sub: `受講${records.length}名`, color: 'green' },
            { label: '不合格', val: records.length - passedCount, sub: `合格率${records.length ? Math.round(passedCount / records.length * 100) : 0}%`, color: 'red' },
          ].map((s, i) => (
            <div key={i} className={`bg-white rounded-lg border p-3 text-center ${s.color === 'red' ? 'border-red-200' : 'border-green-200'}`}>
              <p className={`text-xs mb-1 ${s.color === 'red' ? 'text-red-500' : 'text-gray-500'}`}>{s.label}</p>
              <p className={`text-2xl font-bold ${s.color === 'red' ? 'text-red-600' : 'text-green-700'}`}>{s.val}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
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
                    <span className="text-amber-900 font-medium">{item.companyName}　{item.classroomName}　{item.fullName}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-green-200">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-green-700 text-green-800 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-green-700 hover:bg-green-50'
              }`}>
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== タブ①：受講記録 ===== */}
        {activeTab === 'records' && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-white rounded-lg border border-green-200 p-4 text-center"><p className="text-xs text-gray-500 mb-1">総受講数</p><p className="text-2xl font-bold">{records.length}</p></div>
              <div className="bg-white rounded-lg border border-green-300 p-4 text-center"><p className="text-xs text-green-700 mb-1">合格</p><p className="text-2xl font-bold text-green-700">{passedCount}</p></div>
              <div className="bg-white rounded-lg border border-red-200 p-4 text-center"><p className="text-xs text-red-500 mb-1">不合格</p><p className="text-2xl font-bold text-red-600">{records.length - passedCount}</p></div>
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                placeholder="事業者コード・氏名・事業者名・教室名で検索..."
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-1">
                {[{ val: 'all', label: 'すべて' }, { val: 'passed', label: '合格のみ' }, { val: 'failed', label: '不合格のみ' }].map((f) => (
                  <button key={f.val} onClick={() => setFilterPassed(f.val)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${filterPassed === f.val ? 'bg-green-800 text-white border-green-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-green-200">
                {records.length === 0 ? '受講記録がありません。' : '条件に一致する記録がありません。'}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-green-50 border-b border-green-200">
                      <tr>
                        {[
                          { field: 'submittedAt', label: '受講日時' },
                          { field: 'operatorCode', label: '事業者コード' },
                          { field: 'companyName', label: '事業者名' },
                          { field: 'classroomCode', label: '教室コード' },
                          { field: 'classroomName', label: '教室名' },
                          { field: 'fullName', label: '氏名' },
                          { field: 'track', label: '研修種別' },
                          { field: 'score', label: '得点' },
                          { field: 'passed', label: '合否' },
                          { field: 'completionDate', label: '修了日' },
                          { field: 'expiry', label: '有効期限' },
                          { field: 'action', label: '操作' },
                        ].map((col) => (
                          <th key={col.field} onClick={() => handleSort(col.field)}
                            className="px-4 py-3 text-left text-xs font-semibold text-green-900 cursor-pointer hover:text-green-700 whitespace-nowrap select-none">
                            {col.label}<SortIcon field={col.field} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {filteredRecords.map((r, idx) => (
                        <tr key={idx} className="hover:bg-green-50">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.operatorCode || r.memberCode || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{r.companyName || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.classroomCode || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{r.classroomName || '—'}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{r.fullName || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {r.track === 'manager'
                              ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">情報管理</span>
                              : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">一般</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-xs text-center font-semibold">{r.score != null ? `${r.score}%` : '—'}</td>
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
                            {(() => {
                              const base = typeof window !== 'undefined' ? window.location.origin : '';
                              const trackParam = r.track === 'manager' ? '&track=manager' : '';
                              const retrainUrl = `${base}/register?biz=${r.operatorCode || r.memberCode}&cls=${r.classroomCode}${trackParam}`;
                              const key = `rec-retrain-${r.id || idx}`;
                              return (
                                <div className="flex items-center gap-1.5 justify-center flex-wrap">
                                  <button
                                    onClick={() => copyUrl(key, retrainUrl)}
                                    className={`text-xs px-2 py-1 rounded border transition-colors whitespace-nowrap ${
                                      copiedKey === key
                                        ? 'bg-green-700 text-white border-green-700'
                                        : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'
                                    }`}
                                  >
                                    {copiedKey === key ? '✓ コピー済' : '🔗 再研修URL'}
                                  </button>
                                  <button
                                    onClick={() => setQrModal({ url: retrainUrl, title: `${r.fullName || ''}の再研修QR` })}
                                    className="text-xs px-2 py-1 rounded border bg-white border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors whitespace-nowrap"
                                  >
                                    📱 QR
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 text-right">
                  {filteredRecords.length} 件表示（全 {records.length} 件）
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== タブ②：事業者一覧 ===== */}
        {activeTab === 'operators' && (
          <>
            {/* 新規事業者登録 */}
            <div className="mb-4">
              <button
                onClick={() => { setShowAddOpForm(v => !v); setAddOpError(''); }}
                className="flex items-center gap-2 bg-green-800 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <span>＋</span> 新規事業者を登録する
              </button>
              {showAddOpForm && (
                <form onSubmit={handleAddOperator} className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-green-900">新規事業者登録</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">事業者コード ＊</label>
                      <input value={newOpCode} onChange={e=>setNewOpCode(e.target.value.toUpperCase())}
                        placeholder="例：C001" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">会社名 ＊</label>
                      <input value={newOpName} onChange={e=>setNewOpName(e.target.value)}
                        placeholder="例：株式会社〇〇" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
                      <input value={newOpContact} onChange={e=>setNewOpContact(e.target.value)}
                        placeholder="例：田中 一郎"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">初期パスワード ＊</label>
                      <input value={newOpPassword} onChange={e=>setNewOpPassword(e.target.value)}
                        placeholder="8文字以上推奨" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                    </div>
                  </div>
                  {addOpError && <p className="text-xs text-red-600">{addOpError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={addOpLoading}
                      className="bg-green-800 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                      {addOpLoading ? '登録中...' : '登録する'}
                    </button>
                    <button type="button" onClick={()=>setShowAddOpForm(false)}
                      className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg transition-colors">
                      キャンセル
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="text" value={opSearch} onChange={(e) => setOpSearch(e.target.value)}
                placeholder="事業者コード・事業者名・担当者名で検索..."
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-1">
                {[{ val: 'all', label: 'すべて' }, { val: 'active', label: '有効' }, { val: 'inactive', label: '停止' }].map((f) => (
                  <button key={f.val} onClick={() => setOpFilter(f.val)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${opFilter === f.val ? 'bg-green-800 text-white border-green-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-green-50 border-b border-green-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">事業者コード</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">事業者名</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">担当者名</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">
                        <div className="flex items-center gap-2">
                          <span>パスワード</span>
                          <button
                            onClick={() => setShowPasswords(v => !v)}
                            className="text-xs px-1.5 py-0.5 rounded border border-green-400 text-green-700 hover:bg-green-100 transition-colors"
                            title={showPasswords ? 'パスワードを隠す' : 'パスワードを表示'}>
                            {showPasswords ? '🙈 隠す' : '👁 表示'}
                          </button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">教室数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">受講者数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">合格者数</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">登録日</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">ステータス</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">事業者管理URL</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">PW変更</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-50">
                    {filteredOperators.map((op, idx) => {
                      const loginUrl = `${getBaseUrl()}/operator/login`;
                      return (
                        <tr key={idx} className={`transition-colors ${op.status === 'inactive' ? 'opacity-50 bg-gray-50' : 'hover:bg-green-50'}`}>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-gray-800">{op.operatorCode}</td>
                          <td className="px-4 py-3 text-xs text-gray-900 whitespace-nowrap">{op.companyName}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{op.contactName || '—'}</td>
                          <td className="px-4 py-3 text-xs font-mono">
                            {showPasswords
                              ? <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold select-all">{op.adminPassword || '—'}</span>
                              : <span className="text-gray-300 tracking-widest">••••••••</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-700">{op.classroomCount ?? 0}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-700">{op.traineeCount ?? 0}</td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-green-700">{op.passedCount ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{op.registeredAt || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpStatusToggle(op)}
                              title="クリックでステータス変更"
                              className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${op.status === 'active' ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-100 hover:text-red-700 hover:border-red-300' : 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-green-100 hover:text-green-800 hover:border-green-300'}`}>
                              {op.status === 'active' ? '有効' : '停止'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {op.status === 'active' && (
                              <button onClick={() => copyUrl(`op-${op.operatorCode}`, loginUrl)}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${copiedKey === `op-${op.operatorCode}` ? 'bg-green-700 text-white border-green-700' : 'bg-white text-green-700 border-green-400 hover:bg-green-50'}`}>
                                {copiedKey === `op-${op.operatorCode}` ? '✓ コピー済' : 'URLコピー'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => { setPwChangeModal({ operatorCode: op.operatorCode, companyName: op.companyName }); setNewPwValue(''); setPwChangeError(''); }}
                              className="text-xs px-2 py-1 rounded border border-amber-400 text-amber-700 hover:bg-amber-50 transition-colors whitespace-nowrap">
                              🔑 変更
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 text-right">
                {filteredOperators.length} 件表示（全 {operators.length} 社）
              </div>
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
              <p className="font-semibold mb-1">ℹ️ ステータス変更について</p>
              <p>各行の「有効」「停止」ボタンをクリックするとステータスを切り替えられます。停止にすると事業者はログインできなくなります。</p>
            </div>
          </>
        )}

        {/* ===== タブ③：教室一覧 ===== */}
        {activeTab === 'classrooms' && (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="text" value={clsSearch} onChange={(e) => setClsSearch(e.target.value)}
                placeholder="教室コード・教室名で検索..."
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <select value={clsOpFilter} onChange={(e) => setClsOpFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">全事業者</option>
                {operators.filter(o => o.status === 'active').map((o) => (
                  <option key={o.operatorCode} value={o.operatorCode}>{o.operatorCode}：{o.companyName}</option>
                ))}
              </select>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-green-50 border-b border-green-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">教室コード</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">教室名</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">事業者コード</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">事業者名</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">受講者数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">合格者数</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">登録日</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">ステータス</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">専用URL</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">
                        <div className="flex items-center gap-1">
                          <span>教室PW</span>
                          <button onClick={() => setShowClsPasswords(v => !v)}
                            className="text-xs px-1 py-0.5 rounded border border-green-400 text-green-700 hover:bg-green-100">
                            {showClsPasswords ? '🙈' : '👁'}
                          </button>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">PW変更</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-50">
                    {filteredClassrooms.map((cls, idx) => {
                      const op = operators.find(o => o.operatorCode === cls.operatorCode);
                      const url = `${getBaseUrl()}/register?biz=${cls.operatorCode}&cls=${cls.classroomCode}`;
                      return (
                        <tr key={idx} className={`transition-colors ${cls.status === 'inactive' ? 'opacity-50 bg-gray-50' : 'hover:bg-green-50'}`}>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-gray-800">{cls.classroomCode}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900">{cls.classroomName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{cls.operatorCode}</td>
                          <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{op?.companyName || '—'}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-600">{cls.totalTrainees ?? 0}</td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-green-700">{cls.passedTrainees ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{cls.createdAt || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleAdminClsStatusToggle(cls)}
                              title="クリックでステータス変更"
                              className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${cls.status === 'active' ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-100 hover:text-red-700 hover:border-red-300' : 'bg-gray-200 text-gray-500 border-gray-300 hover:bg-green-100 hover:text-green-800 hover:border-green-300'}`}>
                              {cls.status === 'active' ? '有効' : '停止'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {cls.status === 'active' && (
                              <button onClick={() => copyUrl(`cls-${cls.classroomCode}`, url)}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${copiedKey === `cls-${cls.classroomCode}` ? 'bg-green-700 text-white border-green-700' : 'bg-white text-green-700 border-green-400 hover:bg-green-50'}`}>
                                {copiedKey === `cls-${cls.classroomCode}` ? '✓ コピー済' : 'URLコピー'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">
                            {showClsPasswords
                              ? <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold select-all">{cls.classroomPassword || cls.classroomCode}</span>
                              : <span className="text-gray-300 tracking-widest">••••••</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => { setClsPwModal({ classroomCode: cls.classroomCode, classroomName: cls.classroomName }); setNewClsPw(''); setClsPwError(''); }}
                              className="text-xs px-2 py-1 rounded border border-amber-400 text-amber-700 hover:bg-amber-50 transition-colors">
                              🔑 変更
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 text-right">
                {filteredClassrooms.length} 件表示（全 {classrooms.length} 室）
              </div>
            </div>
          </>
        )}

        {/* ===== タブ④：受講者管理 ===== */}
        {activeTab === 'trainees' && (
          <>
            {/* サマリー */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">在籍中</p>
                <p className="text-2xl font-bold text-green-700">{activeTrainees}</p>
              </div>
              <div className="bg-white rounded-lg border border-orange-200 p-4 text-center">
                <p className="text-xs text-orange-500 mb-1">停止中</p>
                <p className="text-2xl font-bold text-orange-600">{suspendedTrainees}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">退職済</p>
                <p className="text-2xl font-bold text-gray-500">{retiredTrainees}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-xs text-blue-800">
              <p className="font-semibold mb-0.5">ℹ️ 受講者管理について</p>
              <p>退職・停止はステータス変更のみ（論理削除）です。受講記録・修了履歴は雇用状態に関わらず保持されます。</p>
            </div>

            {/* フィルタ */}
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="text" value={traineeSearch} onChange={(e) => setTraineeSearch(e.target.value)}
                placeholder="氏名・事業者コード・事業者名・教室名で検索..."
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <select value={traineeOpFilter} onChange={(e) => setTraineeOpFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">全事業者</option>
                {operators.filter(o => o.status === 'active').map((o) => (
                  <option key={o.operatorCode} value={o.operatorCode}>{o.operatorCode}：{o.companyName}</option>
                ))}
              </select>
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">事業者コード</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">事業者名</th>
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
                          .filter((r) => r.passed && r.fullName === t.fullName &&
                            (r.operatorCode || r.memberCode || '') === (t.operatorCode || ''))
                          .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))[0];
                        const expiryDate = latestPassed ? calcExpiry(latestPassed.completionDate) : null;
                        const remainingDays = latestPassed ? calcRemainingDays(latestPassed.completionDate) : null;
                        return (
                        <tr key={idx} className={`transition-colors ${t.status === 'retired' ? 'opacity-60 bg-gray-50' : 'hover:bg-green-50'}`}>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{t.fullName || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.operatorCode || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{t.companyName || '—'}</td>
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
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-32 truncate" title={t.notes}>{t.notes || '—'}</td>
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
                              {(() => {
                                const base = typeof window !== 'undefined' ? window.location.origin : '';
                                const trackParam = t.track === 'manager' ? '&track=manager' : '';
                                const retrainUrl = `${base}/register?biz=${t.operatorCode}&cls=${t.classroomCode}${trackParam}`;
                                const key = `retrain-${t.id}`;
                                return (
                                  <>
                                    <button
                                      onClick={() => copyUrl(key, retrainUrl)}
                                      className={`text-xs px-2.5 py-1 rounded border transition-colors whitespace-nowrap ${
                                        copiedKey === key
                                          ? 'bg-green-700 text-white border-green-700'
                                          : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'
                                      }`}
                                    >
                                      {copiedKey === key ? '✓ コピー済' : '🔗 再研修URL'}
                                    </button>
                                    <button
                                      onClick={() => setQrModal({ url: retrainUrl, title: `${t.fullName || ''}の再研修QR` })}
                                      className="text-xs px-2 py-1 rounded border bg-white border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors whitespace-nowrap"
                                    >
                                      📱 QR
                                    </button>
                                  </>
                                );
                              })()}
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

        {/* ===== ⑤ 自動削除タブ ===== */}
        {activeTab === 'cleanup' && (
          <div className="space-y-5">

            {/* 削除ルール説明 */}
            <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-green-50 border-b border-green-100">
                <h2 className="text-sm font-bold text-green-900">📋 自動削除ルール（JIS Q 15001 / 個人情報保護法 準拠）</h2>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-red-800 mb-1">ルール①　停止中</p>
                    <p className="text-xs text-red-700">ステータスが「停止中」に変更されてから</p>
                    <p className="text-2xl font-black text-red-600 my-1">30日</p>
                    <p className="text-xs text-red-700">経過後に自動削除</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-amber-800 mb-1">ルール②　在籍中・有効期限切れ</p>
                    <p className="text-xs text-amber-700">研修の有効期限が切れてから</p>
                    <p className="text-2xl font-black text-amber-600 my-1">30日</p>
                    <p className="text-xs text-amber-700">経過後に自動削除（再研修未完了）</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-700 mb-1">ルール③　退職済み</p>
                    <p className="text-xs text-gray-600">ステータスが「退職済み」に変更されてから</p>
                    <p className="text-2xl font-black text-gray-500 my-1">90日</p>
                    <p className="text-xs text-gray-600">経過後に自動削除</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-xs text-blue-800 space-y-0.5">
                  <p>🕑 <strong>自動実行：</strong>毎日 午前11時（日本時間）に Vercel Cron Job が自動実行します。</p>
                  <p>🗂 <strong>削除内容：</strong>受講者プロファイル（trainees）と受講記録（records）を両方削除します。</p>
                  <p>📝 <strong>削除ログ：</strong>「誰を・いつ・なぜ削除したか」を ID のみで記録します（個人情報は含みません）。</p>
                </div>
              </div>
            </div>

            {/* 手動実行パネル */}
            <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-green-50 border-b border-green-100">
                <h2 className="text-sm font-bold text-green-900">🔧 手動実行</h2>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-gray-600">通常は自動実行されますが、今すぐ実行したい場合は下のボタンを使用してください。</p>

                <div className="flex flex-wrap gap-3">
                  {/* 試算（ドライラン） */}
                  <button
                    onClick={() => runCleanupApi(true)}
                    disabled={cleanupRunning}
                    className="px-4 py-2 text-sm font-semibold bg-white border border-blue-400 text-blue-700 hover:bg-blue-50 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {cleanupRunning ? '処理中...' : '🔍 削除対象を確認する（試算・削除しない）'}
                  </button>

                  {/* 本番実行 */}
                  <button
                    onClick={() => {
                      if (!window.confirm('削除ルールに該当する受講者データを実際に削除します。\nこの操作は取り消せません。実行しますか？')) return;
                      runCleanupApi(false);
                    }}
                    disabled={cleanupRunning}
                    className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {cleanupRunning ? '処理中...' : '🗑️ 今すぐ削除を実行する'}
                  </button>
                </div>

                {/* 試算結果 */}
                {cleanupDryResult && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs space-y-2">
                    <p className="font-bold text-blue-800">🔍 試算結果（実際には削除していません）</p>
                    <p className="text-blue-700">対象受講者数: <strong className="text-xl text-blue-900">{cleanupDryResult.deletedTraineesCount} 名</strong>（全 {cleanupDryResult.totalTrainees} 名中）</p>
                    {cleanupDryResult.deletedTraineesCount === 0 ? (
                      <p className="text-green-700 font-semibold">✅ 削除対象はいません。</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-blue-800">削除対象一覧：</p>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {cleanupDryResult.deletedItems.map((item, i) => (
                            <div key={i} className="bg-white border border-blue-100 rounded px-3 py-1.5">
                              <span className="font-mono text-gray-500 mr-2">{item.id}</span>
                              <span className="text-red-700">{item.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 実行結果 */}
                {cleanupResult && (
                  <div className={`border rounded-lg p-4 text-xs space-y-1 ${cleanupResult.deletedTraineesCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`font-bold ${cleanupResult.deletedTraineesCount > 0 ? 'text-red-800' : 'text-green-800'}`}>
                      {cleanupResult.deletedTraineesCount > 0 ? '🗑️ 削除完了' : '✅ 削除対象なし'}
                    </p>
                    <p>実行日時: {new Date(cleanupResult.runAt).toLocaleString('ja-JP')}</p>
                    <p>削除受講者数: <strong>{cleanupResult.deletedTraineesCount} 名</strong></p>
                    <p>削除受講記録数: <strong>{cleanupResult.deletedRecordsCount} 件</strong></p>
                    <p>残存受講者数: {cleanupResult.keptCount} 名</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        <p className="mt-6 text-xs text-gray-400 text-center">
          ※ 試作版です。本番では適切な認証・権限管理を実装してください。
        </p>
      </div>

      {/* ===== QRコードモーダル ===== */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-800 mb-1">📱 再研修QRコード</p>
            <p className="text-xs font-medium text-gray-600 mb-3">{qrModal.title}</p>
            <div className="flex justify-center mb-4 p-3 bg-gray-50 rounded-xl">
              <QRCodeCanvas value={qrModal.url} size={200} />
            </div>
            <p className="text-xs text-gray-400 break-all mb-4 bg-gray-50 rounded-lg px-3 py-2 text-left">{qrModal.url}</p>
            <button onClick={() => setQrModal(null)} className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors">閉じる</button>
          </div>
        </div>
      )}

      {/* ===== 事業者パスワード変更モーダル ===== */}
      {pwChangeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setPwChangeModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">🔑 パスワード変更</h3>
            <p className="text-sm text-gray-500 mb-4">{pwChangeModal.companyName}（{pwChangeModal.operatorCode}）</p>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード</label>
                <input value={newPwValue} onChange={e => setNewPwValue(e.target.value)}
                  type="text" placeholder="新しいパスワードを入力" required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400" />
              </div>
              {pwChangeError && <p className="text-xs text-red-600">{pwChangeError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pwChanging}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  {pwChanging ? '変更中...' : '変更する'}
                </button>
                <button type="button" onClick={() => setPwChangeModal(null)}
                  className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  キャンセル
                </button>
              </div>
            </form>
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
            <p className="text-sm text-gray-500 mb-4">{clsPwModal.classroomName}（{clsPwModal.classroomCode}）</p>
            <form onSubmit={handleClsPwChange} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード</label>
                <input value={newClsPw} onChange={e => setNewClsPw(e.target.value)}
                  type="text" placeholder="新しいパスワードを入力" required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400" />
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
                  退職済に変更しても受講記録・修了証は保持されます。元に戻す場合は「在籍中」を選択してください。
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
