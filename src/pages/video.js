import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

/**
 * 研修動画画面
 * - YouTube IFrame API を使用し、動画再生終了を検知して「次へ」ボタンを有効化
 * - 動画が終了するまで確認テストへは進めない
 */

const VIDEO_ID = '6h4PtePGsEw';

export default function VideoPage() {
  const router = useRouter();
  const [trainee, setTrainee] = useState(null);
  const [canProceed, setCanProceed] = useState(false);
  const [playerState, setPlayerState] = useState('waiting'); // waiting | playing | paused | ended
  const playerRef = useRef(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('trainee');
    if (!stored) { router.replace('/register'); return; }
    setTrainee(JSON.parse(stored));

    // YouTube IFrame API のプレーヤーを生成する関数
    const createPlayer = () => {
      if (playerRef.current) return; // 二重生成防止

      playerRef.current = new window.YT.Player('yt-player', {
        videoId: VIDEO_ID,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 1,
        },
        events: {
          onStateChange: (event) => {
            const YT = window.YT;
            if (event.data === YT.PlayerState.PLAYING) {
              setPlayerState('playing');
            } else if (event.data === YT.PlayerState.PAUSED) {
              setPlayerState('paused');
            } else if (event.data === YT.PlayerState.ENDED) {
              // 動画再生終了 → 次へ進むボタンを有効化
              setPlayerState('ended');
              setCanProceed(true);
            }
          },
        },
      });
    };

    // API がすでに読み込まれている場合はそのまま生成
    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      // グローバルコールバックを設定してから API スクリプトを読み込む
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      // クリーンアップ：プレーヤー破棄
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  if (!trainee) return null;

  // 再生状態に応じたメッセージ
  const statusMessage = () => {
    if (playerState === 'ended') return { text: '✓ 動画の視聴が完了しました。確認テストへ進んでください。', cls: 'bg-green-50 border-green-300 text-green-800' };
    if (playerState === 'playing') return { text: '▶ 動画を再生中です...', cls: 'bg-blue-50 border-blue-200 text-blue-800' };
    if (playerState === 'paused') return { text: '⏸ 一時停止中です。最後まで視聴してください。', cls: 'bg-amber-50 border-amber-200 text-amber-800' };
    return { text: '動画を最後まで視聴すると「確認テストへ進む」ボタンが有効になります。', cls: 'bg-gray-50 border-gray-200 text-gray-600' };
  };

  const status = statusMessage();

  return (
    <Layout title="研修動画">
      <div className="max-w-2xl mx-auto">
        {/* ステッパー */}
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-400 mb-5">
          <span className="text-green-700 font-medium">① 基本情報 ✓</span>
          <span className="mx-1">›</span>
          <span className="font-bold text-green-800">② 研修動画</span>
          <span className="mx-1">›</span>
          <span>③ 確認テスト</span>
          <span className="mx-1">›</span>
          <span>④ 修了証</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">研修動画の視聴</h1>
        <p className="text-sm text-gray-500 mb-4">
          動画を<strong>最後まで視聴</strong>すると確認テストへ進めます。
        </p>

        {/* 受講者確認 */}
        <div className="bg-white border border-green-200 rounded-lg p-3 mb-5 text-sm">
          <span className="text-gray-500">受講者：</span>
          <span className="font-medium text-gray-800">
            {trainee.companyName} ／ {trainee.classroomName} ／ {trainee.fullName} 様
          </span>
        </div>

        {/* YouTube 動画 */}
        <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden mb-5">
          {/* IFrame API はこの div を置き換えてプレーヤーを生成する */}
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <div
              id="yt-player"
              className="absolute inset-0 w-full h-full"
            />
          </div>
          <div className="p-4 border-t border-green-100">
            <p className="text-sm font-bold text-gray-800">こども性暴力防止法（日本版DBS）対応研修</p>
            <p className="text-xs text-gray-500 mt-0.5">公益社団法人全国学習塾協会（JJA）制作</p>
          </div>
        </div>

        {/* 視聴ステータス */}
        <div className={`border rounded-lg p-3 mb-5 text-sm ${status.cls}`}>
          {status.text}
        </div>

        {/* 研修内容サマリー */}
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-5 mb-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">研修内容</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              '日本版DBS（こども性暴力防止法）の目的と概要',
              '確認申請の対象者（雇用形態を問わず子どもと接する全ての者）',
              '申請のタイミングと手続きの流れ',
              '義務不履行の場合の行政措置（改善命令・事業者名公表）',
              '現場での実務対応ポイントとケーススタディ',
            ].map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-green-700 font-bold flex-shrink-0">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 次へボタン */}
        <button
          onClick={() => router.push('/test')}
          disabled={!canProceed}
          className="w-full bg-green-800 hover:bg-green-700 active:bg-green-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {canProceed ? '確認テストへ進む →' : '動画を最後まで視聴してください'}
        </button>
      </div>
    </Layout>
  );
}
