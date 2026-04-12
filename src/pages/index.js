import { useRouter } from 'next/router';
import Layout from '../components/Layout';

/**
 * トップページ（受講開始画面）
 */
export default function Home() {
  const router = useRouter();

  const steps = [
    { num: '1', label: '基本情報の入力', desc: '会員コード・教室名・氏名・メールアドレスを入力' },
    { num: '2', label: '研修動画の視聴', desc: '日本版DBSの概要と実務対応について学びます' },
    { num: '3', label: '確認テストの受験', desc: '全20問 — 16問以上正解（80%）で合格' },
    { num: '4', label: '修了証の受領', desc: '合格者には修了証を発行します' },
  ];

  return (
    <Layout title="受講開始">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8 mb-6">
          <div className="text-center mb-7">
            <span className="inline-block bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-wide">
              必須受講
            </span>
            <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-2">
              こども性暴力防止法（日本版DBS）<br />対応研修
            </h1>
            <p className="text-gray-500 text-sm">公益社団法人全国学習塾協会（JJA）</p>
          </div>

          {/* 注意事項 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-7">
            <p className="text-amber-900 text-sm font-semibold mb-1">この研修について</p>
            <p className="text-amber-800 text-sm leading-relaxed">
              本研修は、こども性暴力防止法（日本版DBS）に関する正しい知識の習得を目的としています。
              受講後の確認テスト（全20問）で <strong>16問以上正解（80%以上）</strong> で合格となり、修了証が発行されます。
            </p>
          </div>

          {/* 受講の流れ */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-700 mb-3">受講の流れ</h2>
            <div className="space-y-3">
              {steps.map((s) => (
                <div key={s.num} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-800 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {s.num}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.label}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => router.push('/register')}
            className="w-full bg-green-800 hover:bg-green-700 active:bg-green-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-base"
          >
            受講を開始する →
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          ※ 本システムは試作・検証版です。運用開始前に担当者へお問い合わせください。
        </p>
      </div>
    </Layout>
  );
}
