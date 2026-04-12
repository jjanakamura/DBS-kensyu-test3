import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

/**
 * 合否結果画面
 * 合格基準：16問以上正解（80%）
 *
 * 不合格時の再受講ルール：
 *   1〜2回目不合格 → テストのみ直接再受講
 *   3回目以降不合格 → 動画を再視聴してから再受講
 */
export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [trainee, setTrainee] = useState(null);

  useEffect(() => {
    const storedResult = sessionStorage.getItem('result');
    const storedTrainee = sessionStorage.getItem('trainee');
    if (!storedResult || !storedTrainee) { router.replace('/register'); return; }
    setResult(JSON.parse(storedResult));
    setTrainee(JSON.parse(storedTrainee));
  }, []);

  if (!result || !trainee) return null;

  const { score, correctCount, totalQuestions, passed, answerDetails, failCount = 0 } = result;

  // 不合格時のルート分岐
  // failCount: 今回の不合格後の累計不合格回数
  const canRetestDirectly = failCount <= 2; // 1回目・2回目はテストのみ再受講可

  const handleRetestOnly = () => {
    sessionStorage.removeItem('result');
    router.push('/test');
  };

  const handleRetestWithVideo = () => {
    sessionStorage.removeItem('result');
    router.push('/video');
  };

  return (
    <Layout title={passed ? '合格' : '不合格'}>
      <div className="max-w-2xl mx-auto">
        {/* ステッパー */}
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-400 mb-5">
          <span className="text-green-700 font-medium">① 基本情報 ✓</span>
          <span className="mx-1">›</span>
          <span className="text-green-700 font-medium">② 動画視聴 ✓</span>
          <span className="mx-1">›</span>
          <span className="text-green-700 font-medium">③ 確認テスト ✓</span>
          <span className="mx-1">›</span>
          <span className={passed ? 'font-bold text-green-800' : 'text-gray-400'}>④ 修了証</span>
        </div>

        {/* 合否バナー */}
        {passed ? (
          <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 mb-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h1 className="text-2xl font-bold text-green-800 mb-1">合格</h1>
            <p className="text-green-700 text-sm">おめでとうございます！確認テストに合格しました。</p>
          </div>
        ) : (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6 text-center">
            <div className="text-4xl mb-2">📋</div>
            <h1 className="text-2xl font-bold text-red-800 mb-1">不合格</h1>
            <p className="text-red-700 text-sm">
              合格基準（16問以上正解）に届きませんでした。
            </p>
            {/* 不合格回数表示 */}
            <p className="text-xs text-red-500 mt-1">
              不合格回数：{failCount} 回目
              {failCount <= 2
                ? '（あと1回はテストのみ再受講できます）'
                : '（次回から動画視聴が必要です）'}
            </p>
          </div>
        )}

        {/* スコアカード */}
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">採点結果</h2>
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 mb-1">正答数</p>
              <p className="text-2xl font-bold text-gray-900">
                {correctCount} <span className="text-base font-normal text-gray-400">/ {totalQuestions}</span>
              </p>
            </div>
            <div className="w-px h-12 bg-gray-200" />
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 mb-1">得点率</p>
              <p className={`text-2xl font-bold ${passed ? 'text-green-700' : 'text-red-700'}`}>
                {score}<span className="text-base font-normal">%</span>
              </p>
            </div>
            <div className="w-px h-12 bg-gray-200" />
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 mb-1">合格基準</p>
              <p className="text-2xl font-bold text-gray-400">80<span className="text-sm font-normal">%</span></p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div className={`h-3 rounded-full transition-all ${passed ? 'bg-green-500' : 'bg-red-400'}`}
              style={{ width: `${score}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span className="text-gray-600 font-medium">合格ライン 80%（16問）</span>
            <span>100%</span>
          </div>
        </div>

        {/* 解答レビュー */}
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">解答の確認</h2>
          <div className="space-y-3">
            {answerDetails.map((detail, idx) => (
              <div key={detail.questionId}
                className={`rounded-lg border p-3 ${detail.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-start gap-2 mb-1">
                  <span className={`text-sm font-bold flex-shrink-0 ${detail.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    {detail.isCorrect ? '○' : '✗'}
                  </span>
                  <p className="text-xs font-medium text-gray-700 leading-relaxed">
                    問 {idx + 1}：{detail.questionText}
                  </p>
                </div>
                {!detail.isCorrect && (
                  <div className="ml-5 space-y-0.5">
                    <p className="text-xs text-red-700">あなたの回答：<span className="line-through">{detail.selectedText}</span></p>
                    <p className="text-xs text-green-700 font-medium">正解：{detail.correctText}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* アクションボタン */}
        {passed ? (
          <button onClick={() => router.push('/certificate')}
            className="w-full bg-green-800 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            修了証を確認する →
          </button>
        ) : (
          <div className="space-y-3">
            {canRetestDirectly ? (
              /* 1〜2回目：テストのみ再受講 */
              <div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-3">
                  <p className="font-semibold mb-1">再受講について（{failCount}回目の不合格）</p>
                  <p>
                    今回を含め2回目までは、<strong>動画を視聴せずにテストのみ再受講</strong>できます。<br />
                    3回目以降は動画の再視聴が必要になります。
                  </p>
                </div>
                <button onClick={handleRetestOnly}
                  className="w-full bg-green-800 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                  テストのみ再受講する →
                </button>
              </div>
            ) : (
              /* 3回目以降：動画視聴から再受講 */
              <div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-3">
                  <p className="font-semibold mb-1">動画の再視聴が必要です（{failCount}回目の不合格）</p>
                  <p>
                    3回目以降の不合格は、<strong>研修動画を再度視聴</strong>してから確認テストを受講してください。
                    動画内容をよく確認してテストに臨んでください。
                  </p>
                </div>
                <button onClick={handleRetestWithVideo}
                  className="w-full bg-green-800 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                  動画を再視聴して再受講する →
                </button>
              </div>
            )}
            <button
              onClick={() => { sessionStorage.clear(); router.push('/'); }}
              className="w-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-3 px-6 rounded-lg transition-colors">
              最初から受講し直す
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
