import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

/**
 * 事業者管理ダッシュボード
 * /operator/dashboard
 */
export default function OperatorDashboard() {
  const router = useRouter();
  const [auth, setAuth] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('classrooms');

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
      const [clsRes, recRes] = await Promise.all([
        fetch(`/api/get-classrooms?operatorCode=${operatorCode}`),
        fetch(`/api/get-operator-records?operatorCode=${operatorCode}`),
      ]);
      const clsData = await clsRes.json();
      const recData = await recRes.json();
      setClassrooms(clsData.classrooms || []);
      setRecords(recData.records || []);
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

  if (!auth) return null;

  const passedCount = records.filter((r) => r.passed).length;
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
              <p className="font-semibold mb-1">📎 専用URLの発行方法</p>
              <p>「URLコピー」ボタンで各教室専用の受講URLをコピーできます。各教室の責任者にメールで送付してください。</p>
            </div>
            {classrooms.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-green-200">
                教室が登録されていません。「教室CSV取込」から追加してください。
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-green-50 border-b border-green-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">教室コード</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-900">教室名</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">受講者数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">合格者数</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">ステータス</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-900">専用URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-50">
                    {classrooms.map((cls, idx) => (
                      <tr key={idx} className={`hover:bg-green-50 transition-colors ${cls.isHQ ? 'bg-green-50' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {cls.classroomCode}
                          {cls.isHQ && <span className="ml-1 text-xs bg-green-700 text-white px-1.5 py-0.5 rounded-full">本部</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-900">{cls.classroomName}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600">{cls.totalTrainees ?? 0}</td>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-green-700">{cls.passedTrainees ?? 0}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                            {cls.status === 'active' ? '有効' : '停止'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <UrlCopyButton onClick={() => copyUrl(cls.classroomCode, auth.operatorCode)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* 受講記録 */}
        {!loading && activeTab === 'records' && (
          <>
            {records.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-green-200">
                受講記録がありません。
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {records.map((r, idx) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-green-100 bg-green-50 text-xs text-gray-400 text-right">
                  {records.length} 件
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
