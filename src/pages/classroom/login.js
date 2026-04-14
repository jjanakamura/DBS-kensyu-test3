import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

/**
 * 教室管理画面ログインページ
 * /classroom/login
 */
export default function ClassroomLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ operatorCode: '', classroomCode: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.operatorCode.trim() || !form.classroomCode.trim() || !form.password) {
      setError('すべての項目を入力してください。');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/classroom-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorCode: form.operatorCode.trim().toUpperCase(),
          classroomCode: form.classroomCode.trim().toUpperCase(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('classroomAuth', JSON.stringify({
          operatorCode: data.operatorCode,
          classroomCode: data.classroomCode,
          companyName: data.companyName,
          classroomName: data.classroomName,
        }));
        router.push('/classroom/dashboard');
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
    <Layout title="教室管理ログイン">
      <div className="max-w-sm mx-auto mt-12">
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8">
          {/* ヘッダーバッジ */}
          <div className="flex justify-center mb-4">
            <span className="inline-block bg-green-800 text-white text-xs font-semibold px-4 py-1.5 rounded-full tracking-wide">
              教室管理ログイン
            </span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">教室管理画面</h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            各コードとパスワードを入力してください
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                事業者コード
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                教室コード
              </label>
              <input
                type="text"
                value={form.classroomCode}
                onChange={(e) => setForm({ ...form, classroomCode: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="例：A001-C01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="パスワードを入力"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* パスワード初期値の案内 */}
          <div className="mt-5 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-xs text-green-800 leading-relaxed">
              パスワードは初期設定では「教室コード」と同じです。（例：A001-C01）
            </p>
          </div>

          {/* 受講者向け注意書き */}
          <p className="mt-4 text-xs text-gray-400 text-center leading-relaxed">
            従事者として受講する場合はこちらのURLは使用しません。<br />
            教室長から届いた専用URLをご利用ください。
          </p>
        </div>
      </div>
    </Layout>
  );
}
