import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

/**
 * 修了証画面
 * - 合格者のみアクセス可
 * - A4縦サイズ（210mm × 297mm）に合わせたデザイン
 * - jsPDF + html2canvas で PDF 出力（ダウンロード）
 * - 印鑑スペースなし
 */

// A4 比率: 210 / 297 ≈ 0.7071
const A4_RATIO = 297 / 210;

export default function CertificatePage() {
  const router = useRouter();
  const [trainee, setTrainee] = useState(null);
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const certRef = useRef(null);

  useEffect(() => {
    const storedTrainee = sessionStorage.getItem('trainee');
    const storedResult = sessionStorage.getItem('result');
    if (!storedTrainee || !storedResult) { router.replace('/register'); return; }
    const parsedResult = JSON.parse(storedResult);
    if (!parsedResult.passed) { router.replace('/result'); return; }
    setTrainee(JSON.parse(storedTrainee));
    setResult(parsedResult);
  }, []);

  // PDF出力（jsPDF + html2canvas）
  const handlePDF = async () => {
    if (!certRef.current) return;
    setGenerating(true);
    try {
      // 動的インポート（SSR対策）
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const element = certRef.current;

      // A4: 210mm × 297mm
      const a4W = 210;
      const a4H = 297;

      // 高解像度でキャプチャ
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.97);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // 余白ゼロで A4 全面に貼り付け
      pdf.addImage(imgData, 'JPEG', 0, 0, a4W, a4H);
      pdf.save(`修了証_${trainee.fullName}.pdf`);
    } catch (e) {
      console.error('PDF生成エラー:', e);
      alert('PDF生成に失敗しました。ブラウザをリロードして再試行してください。');
    } finally {
      setGenerating(false);
    }
  };

  if (!trainee || !result) return null;

  const { completionDate, certNumber } = result;

  return (
    <Layout title="修了証">
      <div className="max-w-2xl mx-auto">
        {/* ステッパー */}
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-400 mb-5 no-print">
          <span className="text-green-700 font-medium">① 基本情報 ✓</span>
          <span className="mx-1">›</span>
          <span className="text-green-700 font-medium">② 動画視聴 ✓</span>
          <span className="mx-1">›</span>
          <span className="text-green-700 font-medium">③ 確認テスト ✓</span>
          <span className="mx-1">›</span>
          <span className="font-bold text-green-800">④ 修了証 ✓</span>
        </div>

        <div className="no-print mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">修了証</h1>
          <p className="text-sm text-gray-500">以下の修了証をPDFで保存してください。</p>
        </div>

        {/* ========== 修了証本体（A4 比率固定） ========== */}
        <div
          ref={certRef}
          id="certificate-print"
          className="bg-white border-2 border-green-700 overflow-hidden mb-6"
          style={{
            fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif',
            // A4 縦比率（幅を基準に高さを決定）
            aspectRatio: `210 / 297`,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 上部帯 */}
          <div style={{ height: '14px', background: '#166534', flexShrink: 0 }} />

          {/* 本文エリア（flex で A4 全体に均等配置） */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '5% 8%',
          }}>
            {/* タイトル */}
            <div style={{ textAlign: 'center', paddingTop: '2%' }}>
              <div style={{ display: 'inline-block', borderTop: '2px solid #166534', borderBottom: '2px solid #166534', padding: '8px 48px' }}>
                <h2 style={{ fontSize: 'clamp(22px, 4.5vw, 36px)', fontWeight: 'bold', color: '#14532d', letterSpacing: '0.35em', margin: 0 }}>
                  修 了 証
                </h2>
              </div>
            </div>

            {/* 受講者情報 */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'clamp(14px, 2.4vw, 20px)', color: '#1f2937', fontWeight: 'bold', marginBottom: '4px' }}>
                {trainee.companyName}
              </p>
              <p style={{ fontSize: 'clamp(13px, 2vw, 17px)', color: '#374151', fontWeight: 'bold', marginBottom: '16px' }}>
                {trainee.classroomName}
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '8px', borderBottom: '2px solid #14532d', paddingBottom: '4px', paddingLeft: '32px', paddingRight: '32px' }}>
                <p style={{ fontSize: 'clamp(22px, 4.5vw, 38px)', fontWeight: 'bold', color: '#111827', margin: 0, letterSpacing: '0.1em' }}>
                  {trainee.fullName}
                </p>
                <span style={{ fontSize: 'clamp(13px, 2vw, 18px)', color: '#374151', fontWeight: 'normal' }}>殿</span>
              </div>
            </div>

            {/* 研修名・本文 */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#166534', fontWeight: 'bold', letterSpacing: '0.3em', marginBottom: '6px' }}>
                研　修　名
              </p>
              <div style={{
                display: 'inline-block',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '4px',
                padding: '6px 24px',
                marginBottom: '14px',
              }}>
                <p style={{ fontSize: 'clamp(11px, 1.8vw, 15px)', fontWeight: 'bold', color: '#14532d', margin: 0 }}>
                  こども性暴力防止法（日本版DBS）対応研修
                </p>
              </div>
              <p style={{ fontSize: 'clamp(10px, 1.5vw, 13px)', color: '#374151', lineHeight: '1.8' }}>
                上記の者は、こども性暴力防止法（日本版DBS）に関する研修を受講し、<br />
                所定の確認テストに合格したことを証します。
              </p>
            </div>

            {/* 修了番号・修了日 */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              gap: '10%',
              borderTop: '1px solid #d1fae5',
              paddingTop: '12px',
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '2px' }}>修了番号</p>
                <p style={{ fontSize: 'clamp(10px, 1.4vw, 12px)', fontFamily: 'monospace', color: '#374151', fontWeight: 'bold', margin: 0 }}>
                  {certNumber}
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '2px' }}>修了日</p>
                <p style={{ fontSize: 'clamp(10px, 1.5vw, 13px)', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                  {completionDate}
                </p>
              </div>
            </div>

            {/* 発行者 */}
            <div style={{ textAlign: 'center', borderTop: '1px solid #d1fae5', paddingTop: '12px' }}>
              <p style={{ fontSize: 'clamp(11px, 1.8vw, 15px)', fontWeight: 'bold', color: '#14532d', letterSpacing: '0.05em', margin: 0 }}>
                公益社団法人全国学習塾協会（JJA）
              </p>
              <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>Japan Juku Association</p>
            </div>
          </div>

          {/* 下部帯 */}
          <div style={{ height: '14px', background: '#166534', flexShrink: 0 }} />
        </div>

        {/* PDF出力ボタン（印刷時非表示） */}
        <div className="no-print space-y-3">
          <button
            onClick={handlePDF}
            disabled={generating}
            className="w-full bg-green-800 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>PDF生成中...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>PDF出力</span>
              </>
            )}
          </button>
          <button
            onClick={() => { sessionStorage.clear(); router.push('/'); }}
            className="w-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            トップへ戻る
          </button>
        </div>

        <div className="no-print mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-500">
          <p className="font-semibold mb-1 text-gray-700">PDF出力について</p>
          <p>「PDF出力」ボタンを押すと修了証がA4縦サイズのPDFファイルとして自動でダウンロードされます。</p>
        </div>
      </div>
    </Layout>
  );
}
