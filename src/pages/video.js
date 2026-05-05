import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

/**
 * 研修動画画面
 *
 * 早送り防止ロジック:
 *   - 1秒ごとに getCurrentTime() をポーリングし、前回値との差分を計測
 *   - 差分が MAX_DELTA_PER_SEC (2.5秒) を超える場合は「早送り」とみなし加算しない
 *   - 差分 ≤ 2.5 → 通常再生 or 2倍速までは許容してカウント
 *   - 実視聴秒数が 動画尺 × MIN_WATCH_FRACTION (95%) に達したらボタン解除
 *   - 進捗は sessionStorage に保存し、リロード後も引き継ぐ
 */

// 研修動画のYouTube ID（正式版）
const VIDEO_ID_GENERAL = 'SrbbEOVDmtg'; // 従事者向け研修
const VIDEO_ID_MANAGER = 'VBlpKSpyVWY'; // 情報管理責任者向け研修

const MIN_WATCH_FRACTION = 0.95; // 95%以上で解除
const MAX_DELTA_PER_SEC  = 2.5;  // 1秒あたりこれ以上の進みは早送りとみなす（2倍速まで許容）

export default function VideoPage() {
  const router = useRouter();
  const [trainee, setTrainee]           = useState(null);
  const [canProceed, setCanProceed]     = useState(false);
  const [playerState, setPlayerState]   = useState('waiting'); // waiting | playing | paused | ended
  const [videoDuration, setVideoDuration] = useState(0);
  const [watchProgress, setWatchProgress] = useState(0); // 0–100 (%)

  const playerRef      = useRef(null);
  const lastTimeRef    = useRef(0);
  const intervalRef    = useRef(null);
  const playedSecsRef  = useRef(0);   // 累積実視聴秒（setStateより先に使うため ref）
  const videoDurRef    = useRef(0);
  const videoIdRef     = useRef('');
  const completionNotifiedRef = useRef(false); // 95%到達時のサーバー通知を一度だけ実行

  /** 95%到達時にサーバー側へ視聴完了を通知（改ざん耐性向上） */
  const notifyCompletion = async () => {
    if (completionNotifiedRef.current) return;
    completionNotifiedRef.current = true;
    try {
      const t = JSON.parse(sessionStorage.getItem('trainee') || '{}');
      await fetch('/api/video-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorCode: t.operatorCode,
          classroomCode: t.classroomCode,
          companyName: t.companyName,
          classroomName: t.classroomName,
          fullName: t.fullName,
          track: t.track,
          videoId: videoIdRef.current,
          watchedSeconds: playedSecsRef.current,
          durationSeconds: videoDurRef.current,
        }),
      });
    } catch (e) {
      console.warn('video-complete 通知失敗:', e);
      completionNotifiedRef.current = false; // 再試行可能にする
    }
  };

  useEffect(() => {
    const stored = sessionStorage.getItem('trainee');
    if (!stored) { router.replace('/register'); return; }
    const parsedTrainee = JSON.parse(stored);
    setTrainee(parsedTrainee);

    const videoId = parsedTrainee.track === 'manager' ? VIDEO_ID_MANAGER : VIDEO_ID_GENERAL;
    videoIdRef.current = videoId;

    // ---- 前回の視聴進捗を復元 ----
    const saved = parseFloat(sessionStorage.getItem(`videoPlayed_${videoId}`) || '0');
    if (saved > 0) playedSecsRef.current = saved;

    // ---- YouTube IFrame API プレーヤー生成 ----
    const createPlayer = () => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player('yt-player', {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, fs: 1 },
        events: {
          onReady: (event) => {
            const dur = event.target.getDuration();
            videoDurRef.current = dur;
            setVideoDuration(dur);
            // 復元した進捗で解除条件チェック
            if (dur > 0) {
              const pct = Math.min(100, Math.round(playedSecsRef.current / dur * 100));
              setWatchProgress(pct);
              if (playedSecsRef.current >= dur * MIN_WATCH_FRACTION) {
                setCanProceed(true);
                notifyCompletion();
              }
            }
          },

          onStateChange: (event) => {
            const S = window.YT.PlayerState;

            if (event.data === S.PLAYING) {
              setPlayerState('playing');
              lastTimeRef.current = playerRef.current.getCurrentTime();

              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                if (!playerRef.current) return;
                const current = playerRef.current.getCurrentTime();
                const dur     = videoDurRef.current || playerRef.current.getDuration();
                const delta   = current - lastTimeRef.current;
                lastTimeRef.current = current;

                // 早送り検出: 1秒ポーリングで差分が MAX_DELTA_PER_SEC 以下のみ加算
                if (delta > 0 && delta <= MAX_DELTA_PER_SEC && dur > 0) {
                  playedSecsRef.current = Math.min(playedSecsRef.current + delta, dur);
                  const pct = Math.min(100, Math.round(playedSecsRef.current / dur * 100));
                  setWatchProgress(pct);
                  sessionStorage.setItem(`videoPlayed_${videoIdRef.current}`, String(playedSecsRef.current));
                  if (playedSecsRef.current >= dur * MIN_WATCH_FRACTION) {
                    setCanProceed(true);
                    notifyCompletion();
                  }
                }
              }, 1000);

            } else {
              if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

              if (event.data === S.PAUSED) {
                setPlayerState('paused');
              } else if (event.data === S.ENDED) {
                setPlayerState('ended');
                // 終了時にも解除条件を再チェック（通常視聴ならここで通過する）
                const dur = videoDurRef.current;
                if (dur > 0 && playedSecsRef.current >= dur * MIN_WATCH_FRACTION) {
                  setCanProceed(true);
                  notifyCompletion();
                }
              }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  if (!trainee) return null;

  const isManager = trainee.track === 'manager';

  const courseConfig = isManager
    ? {
        title: '情報管理責任者研修動画の視聴',
        videoTitle: 'こども性暴力防止法（日本版DBS）情報管理責任者向け研修',
        badge: { label: '情報管理責任者研修', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
      }
    : {
        title: '研修動画の視聴',
        videoTitle: 'こども性暴力防止法（日本版DBS）従事者向け研修',
        badge: null,
      };

  // ---- ステータスメッセージ ----
  const statusMessage = () => {
    if (canProceed)
      return { text: '✓ 視聴完了！確認テストへ進んでください。', cls: 'bg-green-50 border-green-300 text-green-800' };
    if (playerState === 'ended' && !canProceed)
      return { text: `早送りが検出されました。視聴済み ${watchProgress}% — 動画を通常速度（最大2倍速）で視聴してください。`, cls: 'bg-red-50 border-red-300 text-red-800' };
    if (playerState === 'playing')
      return { text: `▶ 視聴中... 視聴進捗 ${watchProgress}%（早送りはカウントされません）`, cls: 'bg-blue-50 border-blue-200 text-blue-800' };
    if (playerState === 'paused')
      return { text: `⏸ 一時停止中 — 視聴進捗 ${watchProgress}%`, cls: 'bg-amber-50 border-amber-200 text-amber-800' };
    return { text: `動画を通常速度で視聴してください。早送りはカウントされません。（視聴進捗 ${watchProgress}%）`, cls: 'bg-gray-50 border-gray-200 text-gray-600' };
  };
  const status = statusMessage();

  const needPct = Math.round(MIN_WATCH_FRACTION * 100); // 表示用 95

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

        {/* 情報管理責任者バッジ */}
        {isManager && (
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border mb-4 ${courseConfig.badge.cls}`}>
            📋 情報管理責任者研修コース
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-900 mb-1">{courseConfig.title}</h1>
        <p className="text-sm text-gray-500 mb-4">
          動画を<strong>通常速度で {needPct}% 以上視聴</strong>すると確認テストへ進めます。早送りはカウントされません。
        </p>

        {/* 受講者確認 */}
        <div className="bg-white border border-green-200 rounded-lg p-3 mb-5 text-sm">
          <span className="text-gray-500">受講者：</span>
          <span className="font-medium text-gray-800">
            {trainee.companyName} ／ {trainee.classroomName} ／ {trainee.fullName} 様
          </span>
        </div>

        {/* YouTube 動画 */}
        <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden mb-4">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <div id="yt-player" className="absolute inset-0 w-full h-full" />
          </div>
          <div className="p-4 border-t border-green-100">
            <p className="text-sm font-bold text-gray-800">{courseConfig.videoTitle}</p>
            <p className="text-xs text-gray-500 mt-0.5">公益社団法人全国学習塾協会（JJA）制作</p>
          </div>
        </div>

        {/* 視聴進捗バー */}
        <div className="bg-white rounded-xl border border-green-200 px-4 pt-3 pb-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">視聴進捗</span>
            <span className={`text-xs font-bold ${canProceed ? 'text-green-700' : watchProgress >= needPct * 0.6 ? 'text-blue-600' : 'text-gray-500'}`}>
              {watchProgress}% / {needPct}%
              {canProceed && ' ✓'}
            </span>
          </div>
          {/* 背景バー */}
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            {/* 達成ライン（95%位置） */}
            <div
              className="absolute top-0 bottom-0 w-px bg-green-400 z-10"
              style={{ left: `${needPct}%` }}
            />
            {/* 進捗バー */}
            <div
              className={`h-full rounded-full transition-all duration-700 ${canProceed ? 'bg-green-500' : 'bg-blue-400'}`}
              style={{ width: `${watchProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {canProceed
              ? '視聴条件を達成しました。'
              : `残り約 ${videoDuration > 0 ? Math.max(0, Math.ceil((videoDuration * MIN_WATCH_FRACTION - playedSecsRef.current) / 60)) : '—'} 分以上の視聴が必要です。`}
          </p>
        </div>

        {/* 視聴ステータス */}
        <div className={`border rounded-lg p-3 mb-5 text-sm ${status.cls}`}>
          {status.text}
        </div>

        {/* 次へボタン */}
        <button
          onClick={() => router.push('/test')}
          disabled={!canProceed}
          className="w-full bg-green-800 hover:bg-green-700 active:bg-green-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {canProceed ? '確認テストへ進む →' : `動画を ${needPct}% 以上視聴してください（現在 ${watchProgress}%）`}
        </button>
      </div>
    </Layout>
  );
}
