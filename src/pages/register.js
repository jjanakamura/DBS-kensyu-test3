import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

/**
 * 基本情報入力画面
 * - ?biz=A001 → 事業者コード自動入力・自動照合
 * - ?cls=A001-C01 → 教室名を自動取得・読み取り専用化
 * - 両方なしの場合は手動入力
 */
export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ operatorCode: '', classroomName: '', fullName: '', email: '' });
  const [companyName, setCompanyName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');
  const [codeStatus, setCodeStatus] = useState('idle'); // idle | checking | ok | error | inactive
  const [classroomLocked, setClassroomLocked] = useState(false);
  const [errors, setErrors] = useState({});
  const [urlParamsApplied, setUrlParamsApplied] = useState(false);
  const [track, setTrack] = useState('general'); // 'general' | 'manager'
  const [pledged, setPledged] = useState(false);

  // URLパラメータ ?biz=A001&cls=A001-C01&track=manager の自動処理
  useEffect(() => {
    if (!router.isReady || urlParamsApplied) return;
    const biz = router.query.biz ? String(router.query.biz).trim().toUpperCase() : '';
    const cls = router.query.cls ? String(router.query.cls).trim().toUpperCase() : '';
    const trk = router.query.track === 'manager' ? 'manager' : 'general';
    if (!biz) return;

    setUrlParamsApplied(true);
    setTrack(trk);
    setForm((prev) => ({ ...prev, operatorCode: biz }));
    if (cls) setClassroomCode(cls);
    lookupOperator(biz, cls || null);
  }, [router.isReady, router.query]);

  const lookupOperator = async (code, clsCode) => {
    if (!code) return;
    setCodeStatus('checking');
    setCompanyName('');
    try {
      const res = await fetch('/api/lookup-operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorCode: code, classroomCode: clsCode }),
      });
      const data = await res.json();

      if (data.found) {
        setCompanyName(data.companyName);
        setCodeStatus('ok');
        setErrors((prev) => ({ ...prev, operatorCode: null }));
        if (data.classroomName) {
          setForm((prev) => ({ ...prev, classroomName: data.classroomName }));
          setClassroomLocked(true);
        }
      } else if (data.inactive) {
        setCodeStatus('inactive');
        setErrors((prev) => ({
          ...prev,
          operatorCode: 'このコードは現在ご利用できません。事務局にお問い合わせください。',
        }));
      } else {
        setCodeStatus('error');
        setErrors((prev) => ({
          ...prev,
          operatorCode: '事業者コードが見つかりません。正確に入力されているかご確認ください。',
        }));
      }
    } catch {
      setCodeStatus('error');
      setErrors((prev) => ({ ...prev, operatorCode: 'コードの照合中にエラーが発生しました。' }));
    }
  };

  const handleCodeLookup = () => lookupOperator(form.operatorCode.trim(), classroomCode || null);

  const validate = () => {
    const errs = {};
    if (!form.operatorCode.trim()) errs.operatorCode = '事業者コードを入力してください。';
    else if (codeStatus === 'inactive') errs.operatorCode = 'このコードは現在ご利用できません。';
    else if (codeStatus !== 'ok') errs.operatorCode = '有効な事業者コードを入力・照合してください。';
    if (!form.classroomName.trim()) errs.classroomName = '教室名を入力してください。';
    if (!form.fullName.trim()) errs.fullName = '氏名を入力してください。';
    if (!pledged) errs.pledged = '本人受講の誓約にチェックしてください。';
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    sessionStorage.setItem('trainee', JSON.stringify({
      operatorCode: form.operatorCode.trim(),
      classroomCode: classroomCode || '',
      companyName,
      classroomName: form.classroomName.trim(),
      fullName: form.fullName.trim(),
      track: track || 'general',
    }));
    router.push('/video');
  };

  const inputClass = (field) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
    }`;

  const hasUrlBiz = !!router.query.biz;
  const hasUrlCls = !!router.query.cls;
  const isManager = track === 'manager';

  return (
    <Layout title="基本情報入力">
      <div className="max-w-xl mx-auto">
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-400 mb-5">
          <span className="font-bold text-green-800">① 基本情報入力</span>
          <span className="mx-1">›</span><span>② 研修動画</span>
          <span className="mx-1">›</span><span>③ 確認テスト</span>
          <span className="mx-1">›</span><span>④ 修了証</span>
        </div>

        {/* 情報管理責任者コース案内バナー */}
        {isManager && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-4 text-xs text-amber-900">
            <p className="font-bold mb-0.5">📋 情報管理責任者研修コース</p>
            <p>このURLは<strong>情報管理責任者向け</strong>の研修コースです。情報管理規程を含む専用の研修動画・確認テストが提供されます。</p>
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-900 mb-1">基本情報の入力</h1>
        <p className="text-sm text-gray-500 mb-6">以下の項目をすべて正確に入力してください。<span className="text-red-500">*</span> は必須です。</p>

        {/* 専用URLアクセス時の案内 */}
        {hasUrlBiz && codeStatus === 'ok' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-xs text-blue-800">
            <p className="font-semibold mb-0.5">📎 専用URLからアクセスしました</p>
            <p>{hasUrlCls ? '事業者コード・教室名が自動で入力されています。氏名・メールアドレスをご入力ください。' : '事業者コードが自動で入力されています。教室名・氏名・メールアドレスをご入力ください。'}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-green-200 p-6 space-y-5" noValidate>

          {/* 事業者コード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              事業者コード <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.operatorCode}
                onChange={(e) => {
                  setForm({ ...form, operatorCode: e.target.value });
                  setCodeStatus('idle');
                  setCompanyName('');
                  setClassroomLocked(false);
                }}
                onBlur={handleCodeLookup}
                placeholder="例：A001"
                maxLength={20}
                readOnly={hasUrlBiz && codeStatus === 'ok'}
                className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors ${
                  errors.operatorCode ? 'border-red-400 bg-red-50'
                  : codeStatus === 'ok' ? 'border-green-400 bg-green-50'
                  : codeStatus === 'inactive' ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-white'
                } ${hasUrlBiz && codeStatus === 'ok' ? 'cursor-not-allowed opacity-75' : ''}`}
              />
              {!(hasUrlBiz && codeStatus === 'ok') && (
                <button type="button" onClick={handleCodeLookup}
                  disabled={codeStatus === 'checking'}
                  className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 border border-gray-300 rounded-lg transition-colors whitespace-nowrap">
                  {codeStatus === 'checking' ? '照合中...' : '照合'}
                </button>
              )}
            </div>
            {codeStatus === 'ok' && <p className="mt-1 text-xs text-green-700 font-medium">✓ 事業者コードを確認しました</p>}
            {errors.operatorCode && <p className="mt-1 text-xs text-red-600">{errors.operatorCode}</p>}
          </div>

          {/* 事業者名（自動取得） */}
          {companyName && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3">
              <p className="text-xs text-green-700 font-semibold mb-0.5">事業者名（事業者コードから自動取得）</p>
              <p className="text-sm font-bold text-green-900">{companyName}</p>
              <p className="text-xs text-green-600 mt-1">※ 事業者名は入力不要です。自動で記録されます。</p>
            </div>
          )}

          {/* 教室名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              教室名 <span className="text-red-500">*</span>
              {classroomLocked && <span className="ml-2 text-xs text-blue-600 font-normal">（自動入力）</span>}
            </label>
            <input
              type="text"
              value={form.classroomName}
              onChange={(e) => !classroomLocked && setForm({ ...form, classroomName: e.target.value })}
              readOnly={classroomLocked}
              placeholder="例：渋谷校"
              className={`${inputClass('classroomName')} ${classroomLocked ? 'cursor-not-allowed opacity-75 bg-green-50 border-green-300' : ''}`}
            />
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

          {/* 本人受講の誓約 */}
          <div className={`rounded-lg border p-4 ${errors.pledged ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={pledged}
                onChange={(e) => setPledged(e.target.checked)}
                className="mt-0.5 flex-shrink-0 w-4 h-4 accent-green-700"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                私は、この研修を<strong>本人自身が受講</strong>していることを誓います。代理受講・なりすまし等の不正行為は、事業者規程に基づき対処されることを理解しています。
              </span>
            </label>
            {errors.pledged && <p className="mt-2 text-xs text-red-600">{errors.pledged}</p>}
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
