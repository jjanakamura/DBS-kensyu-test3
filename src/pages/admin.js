import { useState } from 'react';
import Layout from '../components/Layout';

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
        fetch('/api/get-operators'),
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
        fetch('/api/get-operators'),
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

  const tabs = [
    { key: 'records', label: '受講記録', count: records.length },
    { key: 'operators', label: '事業者一覧', count: operators.length },
    { key: 'classrooms', label: '教室一覧', count: classrooms.length },
    { key: 'trainees', label: '受講者管理', count: trainees.length },
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
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                {tab.count}
              </span>
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
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{calcExpiry(r.completionDate) || '—'}</td>
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">担当者メール</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">教室数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">受講者数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">合格者数</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">登録日</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">ステータス</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">事業者管理URL</th>
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
                          <td className="px-4 py-3 text-xs text-gray-600">{op.contactEmail || '—'}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-700">{op.classroomCount ?? 0}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-700">{op.traineeCount ?? 0}</td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-green-700">{op.passedCount ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{op.registeredAt || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${op.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                              {op.status === 'active' ? '有効' : '停止'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {op.status === 'active' && (
                              <button onClick={() => copyUrl(`op-${op.operatorCode}`, loginUrl)}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${copiedKey === `op-${op.operatorCode}` ? 'bg-green-700 text-white border-green-700' : 'bg-white text-green-700 border-green-400 hover:bg-green-50'}`}>
                                {copiedKey === `op-${op.operatorCode}` ? '✓ コピー済' : 'URLコピー'}
                              </button>
                            )}
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
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 space-y-2">
              <p className="font-semibold">⚠️ 事業者追加・編集について</p>
              <p>現在は <code className="bg-amber-100 px-1 rounded">data/operators.json</code> を直接編集してください。停止は <code className="bg-amber-100 px-1 rounded">"status": "inactive"</code> に変更します。</p>
              <p className="font-semibold mt-2">🏢 新規事業者追加時の手順</p>
              <ol className="list-decimal list-inside space-y-1 text-amber-700">
                <li><code className="bg-amber-100 px-1 rounded">operators.json</code> に事業者を1行追加（operatorCode・adminPassword等）</li>
                <li><code className="bg-amber-100 px-1 rounded">classrooms.json</code> に本部エントリを追加：<br />
                  <code className="bg-amber-100 px-1 rounded text-xs block mt-1 p-1">{"{"}"classroomCode": "A006-HQ", "operatorCode": "A006", "classroomName": "本部", "isHQ": true, "status": "active", "createdAt": "YYYY-MM-DD"{"}"}</code>
                </li>
                <li>事業者に <code className="bg-amber-100 px-1 rounded">/operator/login</code> のURLとログイン情報を送付</li>
              </ol>
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
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                              {cls.status === 'active' ? '有効' : '停止'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {cls.status === 'active' && (
                              <button onClick={() => copyUrl(`cls-${cls.classroomCode}`, url)}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${copiedKey === `cls-${cls.classroomCode}` ? 'bg-green-700 text-white border-green-700' : 'bg-white text-green-700 border-green-400 hover:bg-green-50'}`}>
                                {copiedKey === `cls-${cls.classroomCode}` ? '✓ コピー済' : 'URLコピー'}
                              </button>
                            )}
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
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {filteredTrainees.map((t, idx) => (
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
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => openStatusModal(t)}
                              className="text-xs px-2.5 py-1 bg-white border border-green-400 text-green-700 hover:bg-green-50 rounded transition-colors whitespace-nowrap">
                              ステータス変更
                            </button>
                          </td>
                        </tr>
                      ))}
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

        <p className="mt-6 text-xs text-gray-400 text-center">
          ※ 試作版です。本番では適切な認証・権限管理を実装してください。
        </p>
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
    </Layout>
  );
}
