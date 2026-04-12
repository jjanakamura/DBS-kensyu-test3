import { useState } from 'react';
import Layout from '../components/Layout';

/**
 * 管理画面
 * - パスワード認証（試作用）
 * - タブ①：受講記録の一覧（検索・フィルタ・ソート）
 * - タブ②：会員マスタ一覧（ステータス・担当者情報）
 */

const ADMIN_PASSWORD = 'admin2024';

// ホスト名を動的に取得（専用URL生成用）
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://your-domain.com';
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [inputPw, setInputPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'members'

  // 受講記録
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [filterPassed, setFilterPassed] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState('submittedAt');
  const [sortDir, setSortDir] = useState('desc');

  // 会員マスタ
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [copiedCode, setCopiedCode] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (inputPw === ADMIN_PASSWORD) {
      setAuthed(true);
      fetchRecords();
      fetchMembers();
    } else {
      setPwError('パスワードが正しくありません。');
    }
  };

  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await fetch('/api/get-records');
      const data = await res.json();
      setRecords(data.records || []);
    } catch (e) {
      console.error(e);
    } finally {
      setRecordsLoading(false);
    }
  };

  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await fetch('/api/get-members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (e) {
      console.error(e);
    } finally {
      setMembersLoading(false);
    }
  };

  // 専用URLをクリップボードにコピー
  const copyUrl = (memberCode) => {
    const url = `${getBaseUrl()}/register?code=${memberCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(memberCode);
      setTimeout(() => setCopiedCode(''), 2000);
    });
  };

  // ===== 受講記録フィルタ =====
  const filteredRecords = records
    .filter((r) => {
      if (filterPassed === 'passed') return r.passed;
      if (filterPassed === 'failed') return !r.passed;
      return true;
    })
    .filter((r) => {
      if (!searchText) return true;
      const t = searchText.toLowerCase();
      return (
        (r.fullName || '').includes(searchText) ||
        (r.companyName || '').includes(searchText) ||
        (r.classroomName || '').includes(searchText) ||
        (r.memberCode || '').toLowerCase().includes(t) ||
        (r.email || '').toLowerCase().includes(t)
      );
    })
    .sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = av > bv ? 1 : av < bv ? -1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const passedCount = records.filter((r) => r.passed).length;

  const handleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => sortField === field
    ? <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
    : null;

  // ===== 会員マスタフィルタ =====
  const filteredMembers = members
    .filter((m) => {
      if (memberFilter === 'active') return m.status === 'active';
      if (memberFilter === 'inactive') return m.status === 'inactive';
      return true;
    })
    .filter((m) => {
      if (!memberSearch) return true;
      const t = memberSearch.toLowerCase();
      return (
        (m.memberCode || '').toLowerCase().includes(t) ||
        (m.companyName || '').includes(memberSearch) ||
        (m.contactName || '').includes(memberSearch) ||
        (m.contactEmail || '').toLowerCase().includes(t)
      );
    });

  // ========== ログイン前 ==========
  if (!authed) {
    return (
      <Layout title="管理画面">
        <div className="max-w-sm mx-auto mt-12">
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">管理画面</h1>
            <p className="text-sm text-gray-500 text-center mb-6">管理者パスワードを入力してください</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                <input type="password" value={inputPw} onChange={(e) => setInputPw(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="パスワードを入力" autoFocus />
                {pwError && <p className="mt-1 text-xs text-red-600">{pwError}</p>}
              </div>
              <button type="submit"
                className="w-full bg-green-800 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition-colors">
                ログイン
              </button>
            </form>
            <p className="mt-4 text-xs text-gray-400 text-center">※ 試作版の簡易認証です。本番では適切な認証に変更してください。</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ========== 管理画面本体 ==========
  return (
    <Layout title="管理画面">
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">管理画面</h1>
            <p className="text-sm text-gray-500 mt-0.5">閲覧専用（試作版）</p>
          </div>
          <button
            onClick={() => { fetchRecords(); fetchMembers(); }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors">
            更新
          </button>
        </div>

        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-green-200">
          {[
            { key: 'records', label: '受講記録', count: records.length },
            { key: 'members', label: '会員マスタ', count: members.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-green-700 text-green-800 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-green-700 hover:bg-green-50'
              }`}
            >
              {tab.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* ===== タブ①：受講記録 ===== */}
        {activeTab === 'records' && (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">総受講数</p>
                <p className="text-2xl font-bold text-gray-900">{records.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-green-300 p-4 text-center">
                <p className="text-xs text-green-700 mb-1">合格</p>
                <p className="text-2xl font-bold text-green-700">{passedCount}</p>
              </div>
              <div className="bg-white rounded-lg border border-red-200 p-4 text-center">
                <p className="text-xs text-red-500 mb-1">不合格</p>
                <p className="text-2xl font-bold text-red-600">{records.length - passedCount}</p>
              </div>
            </div>

            {/* フィルター */}
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                placeholder="会員コード・氏名・事業者名・教室名で検索..."
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-1">
                {[{ val: 'all', label: 'すべて' }, { val: 'passed', label: '合格のみ' }, { val: 'failed', label: '不合格のみ' }].map((f) => (
                  <button key={f.val} onClick={() => setFilterPassed(f.val)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                      filterPassed === f.val
                        ? 'bg-green-800 text-white border-green-800'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* テーブル */}
            {recordsLoading ? (
              <div className="text-center py-12 text-gray-500 text-sm">読み込み中...</div>
            ) : filteredRecords.length === 0 ? (
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
                          { field: 'memberCode', label: '会員コード' },
                          { field: 'companyName', label: '事業者名' },
                          { field: 'classroomName', label: '教室名' },
                          { field: 'fullName', label: '氏名' },
                          { field: 'email', label: 'メール' },
                          { field: 'score', label: '得点' },
                          { field: 'passed', label: '合否' },
                          { field: 'completionDate', label: '修了日' },
                        ].map((col) => (
                          <th key={col.field} onClick={() => handleSort(col.field)}
                            className="px-4 py-3 text-left text-xs font-semibold text-green-900 cursor-pointer hover:text-green-700 whitespace-nowrap select-none">
                            {col.label}<SortIcon field={col.field} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {filteredRecords.map((record, idx) => (
                        <tr key={idx} className="hover:bg-green-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {record.submittedAt ? new Date(record.submittedAt).toLocaleString('ja-JP', {
                              year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                            }) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{record.memberCode || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{record.companyName || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{record.classroomName || '—'}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{record.fullName || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{record.email || '—'}</td>
                          <td className="px-4 py-3 text-xs text-center font-semibold">{record.score != null ? `${record.score}%` : '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                              record.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                            }`}>
                              {record.passed ? '合格' : '不合格'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{record.completionDate || '—'}</td>
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

        {/* ===== タブ②：会員マスタ ===== */}
        {activeTab === 'members' && (
          <>
            {/* サマリー */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">総会員数</p>
                <p className="text-2xl font-bold text-gray-900">{members.length}</p>
              </div>
              <div className="bg-white rounded-lg border border-green-300 p-4 text-center">
                <p className="text-xs text-green-700 mb-1">有効（active）</p>
                <p className="text-2xl font-bold text-green-700">{members.filter(m => m.status === 'active').length}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">停止（inactive）</p>
                <p className="text-2xl font-bold text-gray-400">{members.filter(m => m.status === 'inactive').length}</p>
              </div>
            </div>

            {/* 専用URL説明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-xs text-blue-800">
              <p className="font-semibold mb-1">📎 専用URLの使い方</p>
              <p>各会員の「URLコピー」ボタンを押すと <code className="bg-blue-100 px-1 rounded">https://…/register?code=A001</code> の形式でクリップボードにコピーされます。このURLを責任者にメールで送付してください。</p>
            </div>

            {/* フィルター */}
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="text" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="会員コード・事業者名・担当者名・メールで検索..."
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-1">
                {[{ val: 'all', label: 'すべて' }, { val: 'active', label: '有効のみ' }, { val: 'inactive', label: '停止のみ' }].map((f) => (
                  <button key={f.val} onClick={() => setMemberFilter(f.val)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                      memberFilter === f.val
                        ? 'bg-green-800 text-white border-green-800'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* テーブル */}
            {membersLoading ? (
              <div className="text-center py-12 text-gray-500 text-sm">読み込み中...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-green-200">
                該当する会員がありません。
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-green-50 border-b border-green-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">会員コード</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">事業者名</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">担当者名</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">担当者メール</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">登録日</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">ステータス</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 whitespace-nowrap">備考</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-green-900 whitespace-nowrap">専用URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {filteredMembers.map((member, idx) => (
                        <tr key={idx} className={`transition-colors ${member.status === 'inactive' ? 'bg-gray-50 opacity-60' : 'hover:bg-green-50'}`}>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-gray-800">{member.memberCode}</td>
                          <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">{member.companyName}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{member.contactName || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{member.contactEmail || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{member.registeredAt || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                              member.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {member.status === 'active' ? '有効' : '停止'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{member.note || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {member.status === 'active' ? (
                              <button
                                onClick={() => copyUrl(member.memberCode)}
                                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                                  copiedCode === member.memberCode
                                    ? 'bg-green-700 text-white border-green-700'
                                    : 'bg-white text-green-700 border-green-400 hover:bg-green-50'
                                }`}
                              >
                                {copiedCode === member.memberCode ? '✓ コピー済' : 'URLコピー'}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 text-right">
                  {filteredMembers.length} 件表示（全 {members.length} 件）
                </div>
              </div>
            )}

            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">⚠️ 会員追加・編集について</p>
              <p>現在は <code className="bg-amber-100 px-1 rounded">data/members.json</code> を直接編集して会員を追加・変更してください。停止する場合は <code className="bg-amber-100 px-1 rounded">"status": "inactive"</code> に変更します。将来的には管理画面からの編集機能を追加予定です。</p>
            </div>
          </>
        )}

        <p className="mt-6 text-xs text-gray-400 text-center">
          ※ 試作版です。本番では適切な認証・権限管理を実装してください。
        </p>
      </div>
    </Layout>
  );
}
