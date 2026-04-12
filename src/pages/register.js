import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

/**
 * 基本情報入力画面
 * - 会員コード → API照合 → 事業者名を自動表示（入力不要）
 * - 教室名 / 氏名 / メールアドレスを入力
 * - ?code=A001 のようなURLパラメータで会員コードを自動入力・自動照合
 */
export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ memberCode: '', classroomName: '', fullName: '', email: '' });
  const [companyName, setCompanyName] = useState('');
  const [codeStatus, setCodeStatus] = useState('idle'); // idle | checking | ok | error | inactive
  const [errors, setErrors] = useState({});
  const [urlCodeApplied, setUrlCodeApplied] = useState(false);

  // URLパラメータ ?code=A001 の自動入力・自動照合
  useEffect(() => {
    if (!router.isReady) return;
    const codeParam = router.query.code;
    if (codeParam && !urlCodeApplied) {
      const code = String(codeParam).trim().toUpperCase();
      setForm((prev) => ({ ...prev, memberCode: code }));
      setUrlCodeApplied(true);
      // 自動照合
      lookupCode(code);
    }
  }, [router.isReady, router.query.code]);

  const lookupCode = async (code) => {
    if (!code) return;
    setCodeStatus('checking');
    setCompanyName('');
    try {
      const res = await fetch('/api/lookup-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.found) {
        setCompanyName(data.name);
        setCodeStatus('ok');
        setErrors((prev) => ({ ...prev, memberCode: null }));
      } else if (data.inactive) {
        setCodeStatus('inactive');
        setErrors((prev) => ({
          ...prev,
          memberCode: 'このコードは現在ご利用できません。事務局にお問い合わせください。',
        }));
      } else {
        setCodeStatus('error');
        setErrors((prev) => ({
          ...prev,
          memberCode: '会員コードが見つかりません。正確に入力されているかご確認ください。',
        }));
      }
    } catch {
      setCodeStatus('error');
      setErrors((prev) => ({ ...prev, memberCode: 'コードの照合中にエラーが発生しました。' }));
    }
  };

  const handleCodeLookup = () => lookupCode(form.memberCode.trim());

  const validate = () => {
    const errs = {};
    if (!form.memberCode.trim()) errs.memberCode = '会員コードを入力してください。';
    else if (codeStatus === 'inactive') errs.memberCode = 'このコードは現在ご利用できません。事務局にお問い合わせください。';
    else if (codeStatus !== 'ok') errs.memberCode = '有効な会員コードを入力・照合してください。';
    if (!form.classroomName.trim()) errs.classroomName = '教室名を入力してください。';
    if (!form.fullName.trim()) errs.fullName = '氏名を入力してください。';
    if (!form.email.trim()) errs.email = 'メールアドレスを入力してください。';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'メールアドレスの形式が正しくありません。';
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    sessionStorage.setItem('trainee', JSON.stringify({
      memberCode: form.memberCode.trim(),
      companyName,
      classroomName: form.classroomName.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
    }));
    router.push('/video');
  };

  const inputClass = (field) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
    }`;

  // URLパラメータからコードが来ている場合の案内
  const hasUrlCode = !!router.query.code;

  return (
    <Layout title="基本情報入力">
      <div className="max-w-xl mx-auto">
        {/* ステッパー */}
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-400 mb-5">
          <span className="font-bold text-green-800">① 基本情報入力</span>
          <span className="mx-1">›</span><span>② 研修動画</span>
          <span className="mx-1">›</span><span>③ 確認テスト</span>
          <span className="mx-1">›</span><span>④ 修了証</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">基本情報の入力</h1>
        <p className="text-sm text-gray-500 mb-6">以下の項目をすべて正確に入力してください。<span className="text-red-500">*</span> は必須です。</p>

        {/* 専用URLアクセス時の案内 */}
        {hasUrlCode && codeStatus === 'ok' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-xs text-blue-800">
            <p className="font-semibold mb-0.5">📎 専用URLからアクセスしました</p>
            <p>会員コードが自動で入力されています。教室名・氏名・メールアドレスをご入力ください。</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-green-200 p-6 space-y-5" noValidate>

          {/* 会員コード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              会員コード <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.memberCode}
                onChange={(e) => {
                  setForm({ ...form, memberCode: e.target.value });
                  setCodeStatus('idle');
                  setCompanyName('');
                }}
                onBlur={handleCodeLookup}
                placeholder="例：A001"
                maxLength={20}
                readOnly={hasUrlCode && codeStatus === 'ok'}
                className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors ${
                  errors.memberCode ? 'border-red-400 bg-red-50'
                  : codeStatus === 'ok' ? 'border-green-400 bg-green-50'
                  : codeStatus === 'inactive' ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-white'
                } ${hasUrlCode && codeStatus === 'ok' ? 'cursor-not-allowed opacity-75' : ''}`}
              />
              {!(hasUrlCode && codeStatus === 'ok') && (
                <button type="button" onClick={handleCodeLookup}
                  disabled={codeStatus === 'checking'}
                  className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 border border-gray-300 rounded-lg transition-colors whitespace-nowrap">
                  {codeStatus === 'checking' ? '照合中...' : '照合'}
                </button>
              )}
            </div>
            {codeStatus === 'checking' && <p className="mt-1 text-xs text-gray-500">照合中...</p>}
            {codeStatus === 'ok' && <p className="mt-1 text-xs text-green-700 font-medium">✓ 会員コードを確認しました</p>}
            {errors.memberCode && <p className="mt-1 text-xs text-red-600">{errors.memberCode}</p>}
          </div>

          {/* 事業者名（自動取得） */}
          {companyName && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3">
              <p className="text-xs text-green-700 font-semibold mb-0.5">事業者名（会員コードから自動取得）</p>
              <p className="text-sm font-bold text-green-900">{companyName}</p>
              <p className="text-xs text-green-600 mt-1">※ 事業者名は入力不要です。自動で記録されます。</p>
            </div>
          )}

          {/* 教室名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">教室名 <span className="text-red-500">*</span></label>
            <input type="text" value={form.classroomName}
              onChange={(e) => setForm({ ...form, classroomName: e.target.value })}
              placeholder="例：渋谷校" className={inputClass('classroomName')} />
            {errors.classroomName && <p className="mt-1 text-xs text-red-600">{errors.classroomName}</p>}
          </div>

          {/* 氏名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label>
            <input type="text" value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="例：山田 太郎" className={inputClass('fullName')} />
            {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
          </div>

          {/* メールアドレス */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
            <input type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="例：yamada@example.com" className={inputClass('email')} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div className="pt-2">
            <button type="submit"
              className="w-full bg-green-800 hover:bg-green-700 active:bg-green-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
              次へ進む（研修動画へ）→
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
