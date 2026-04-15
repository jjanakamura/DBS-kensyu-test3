import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

/**
 * 教室CSVインポートページ
 * /operator/import
 *
 * CSV形式:
 *   教室名（1列目のみ使用）
 *   渋谷校
 *   新宿校
 *   ...
 */
export default function OperatorImport() {
  const router = useRouter();
  const [auth, setAuth] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('operatorAuth');
    if (!stored) { router.replace('/operator/login'); return; }
    setAuth(JSON.parse(stored));
  }, []);

  // CSV テキストをパースしてプレビュー生成
  const handleCsvChange = (text) => {
    setCsvText(text);
    setResult(null);
    if (!text.trim()) { setPreview([]); return; }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    // ヘッダー行を自動スキップ（「教室名」「classroomName」等を含む行）
    const dataLines = lines.filter(
      (l) => !l.match(/^(教室名|校舎名|classroomname|name)/i)
    );
    // カンマ区切りの場合は1列目を使用
    const names = dataLines.map((l) => l.split(',')[0].replace(/["\s]/g, '')).filter(Boolean);
    setPreview(names);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleCsvChange(ev.target.result);
    reader.readAsText(file, 'UTF-8');
  };

  const handleSubmit = async () => {
    if (preview.length === 0) { setError('教室名が1件もありません。'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/add-classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-token': auth.operatorToken || '',
          'x-operator-code': auth.operatorCode || '',
        },
        body: JSON.stringify({
          operatorCode: auth.operatorCode,
          classrooms: preview.map((name) => ({ classroomName: name })),
        }),
      });
      if (res.status === 401) {
        sessionStorage.removeItem('operatorAuth');
        router.replace('/operator/login?expired=1');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setCsvText('');
        setPreview([]);
      } else {
        setError(data.error || '登録に失敗しました。');
      }
    } catch {
      setError('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const getBaseUrl = () => typeof window !== 'undefined' ? window.location.origin : '';

  if (!auth) return null;

  return (
    <Layout title="教室CSV取込">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.push('/operator/dashboard')}
            className="text-xs text-green-700 hover:underline">← ダッシュボードへ戻る</button>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">教室CSV取込</h1>
        <p className="text-sm text-gray-500 mb-6">{auth.companyName} の教室を一括登録します</p>

        {/* 登録完了メッセージ */}
        {result && (
          <div className="bg-green-50 border border-green-300 rounded-xl p-5 mb-6">
            <p className="font-semibold text-green-800 mb-3">✓ 登録完了</p>
            <p className="text-sm text-green-700 mb-3">{result.added.length} 件の教室を登録しました。</p>
            {result.skipped.length > 0 && (
              <p className="text-xs text-amber-700 mb-3">スキップ（重複）: {result.skipped.join('、')}</p>
            )}
            <div className="space-y-2">
              {result.added.map((cls, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white rounded-lg border border-green-200 px-3 py-2">
                  <div>
                    <span className="font-mono text-xs text-gray-500 mr-2">{cls.classroomCode}</span>
                    <span className="text-sm font-medium text-gray-900">{cls.classroomName}</span>
                  </div>
                  <CopyUrlButton url={`${getBaseUrl()}/register?biz=${auth.operatorCode}&cls=${cls.classroomCode}`} />
                </div>
              ))}
            </div>
            <button onClick={() => setResult(null)}
              className="mt-4 text-xs text-gray-500 hover:underline">続けて追加する</button>
          </div>
        )}

        {!result && (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6 space-y-5">
            {/* ファイルアップロード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CSVファイルを選択</label>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload}
                className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer" />
            </div>

            {/* テキスト入力 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">または直接入力（1行に1教室名）</label>
              <textarea
                value={csvText}
                onChange={(e) => handleCsvChange(e.target.value)}
                rows={6}
                placeholder={'渋谷校\n新宿校\n池袋校\n横浜校'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {/* フォーマット説明 */}
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              <p className="font-semibold mb-1">CSVフォーマット（例）</p>
              <pre className="font-mono">教室名{'\n'}渋谷校{'\n'}新宿校{'\n'}池袋校</pre>
              <p className="mt-2">※ 1列目の教室名のみ使用。ヘッダー行は自動スキップ。同名教室はスキップされます。</p>
            </div>

            {/* プレビュー */}
            {preview.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">取込予定（{preview.length}件）</p>
                <div className="flex flex-wrap gap-2">
                  {preview.map((name, idx) => (
                    <span key={idx} className="bg-green-50 border border-green-200 text-green-800 text-xs px-2 py-1 rounded-full">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button onClick={handleSubmit} disabled={preview.length === 0 || loading}
              className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors">
              {loading ? '登録中...' : `${preview.length}件の教室を登録する`}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

function CopyUrlButton({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`text-xs px-2 py-1 rounded border transition-colors ${copied ? 'bg-green-700 text-white border-green-700' : 'bg-white text-green-700 border-green-400 hover:bg-green-50'}`}>
      {copied ? '✓ コピー済' : 'URLコピー'}
    </button>
  );
}
