import Head from 'next/head';
import Image from 'next/image';

/**
 * 共通レイアウト
 * ヘッダー（正式ロゴ）・フッターを含む全ページ共通の枠組み
 * カラー：薄緑ベース（公益社団法人全国学習塾協会 ブランドカラー）
 */
export default function Layout({ children, title = '研修システム' }) {
  return (
    <>
      <Head>
        <title>{title} | 公益社団法人全国学習塾協会（JJA）</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen flex flex-col bg-green-50">
        {/* ========== ヘッダー ========== */}
        <header className="bg-white border-b-2 border-green-700 shadow-sm no-print">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* 正式ロゴ */}
            <div className="flex-shrink-0">
              <Image
                src="/logo.jpg"
                alt="公益社団法人全国学習塾協会"
                width={200}
                height={52}
                style={{ objectFit: 'contain', height: '44px', width: 'auto' }}
                priority
              />
            </div>
            {/* 区切り線 */}
            <div className="hidden sm:block w-px h-8 bg-green-200" />
            {/* システム名 */}
            <div className="hidden sm:block">
              <p className="text-xs text-green-700 font-medium leading-tight">
                日本版DBS対応
              </p>
              <p className="text-sm font-bold text-green-900 leading-tight">
                研修・修了証発行システム
              </p>
            </div>
          </div>
        </header>

        {/* ========== メインコンテンツ ========== */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
          {children}
        </main>

        {/* ========== フッター ========== */}
        <footer className="border-t border-green-200 bg-white mt-12 no-print">
          <div className="max-w-4xl mx-auto px-4 py-5 text-center">
            <p className="text-sm text-gray-600">
              公益社団法人全国学習塾協会（JJA）
            </p>
            <p className="text-xs text-gray-400 mt-1">
              ※ このシステムは試作・検証版です。本番運用前に十分なテストを行ってください。
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
