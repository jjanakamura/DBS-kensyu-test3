import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

/**
 * 事業者管理画面ログインページ
 * /operator/login
 */
export default function OperatorLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ operatorCode: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // セッション切れによるリダイレクト時にメッセージを表示
  const sessionExpired = router.query.expired === '1';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.operatorCode.trim() || !form.password) {
      setError('事業者コードとパスワードを入力してください。');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/operator-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorCode: form.operatorCode.trim().toUpperCase(), password: form.password }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('operatorAuth', JSON.stringify({
          operatorCode: data.operatorCode,
          companyName: data.companyName,
          operatorToken: data.operatorToken,
        }));
        router.push('/operator/dashboard');
      } else {
        setError(data.message || 'ログインに失敗しました。');
      }
    } catch {
      setError('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="事業者管理画面ログイン">
      <div className="max-w-sm mx-auto mt-12">
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">事業者管理画面</h1>
          <p className="text-sm text-gray-500 text-center mb-6">事業者コードとパスワードを入力してください</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">事業者コード</label>
              <input
                type="text"
                value={form.operatorCode}
                onChange={(e) => setForm({ ...form, operatorCode: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="例：A001"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="パスワードを入力"
              />
            </div>
            {sessionExpired && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                ⏰ セッションが期限切れです。再ログインしてください。
              </p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
          <p className="mt-4 text-xs text-gray-400 text-center">
            ※ 事業者コードとパスワードは事務局から発行されます
          </p>
        </div>
      </div>
    </Layout>
  );
}
