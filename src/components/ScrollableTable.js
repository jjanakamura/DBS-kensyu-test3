import { useEffect, useRef, useState } from 'react';

/**
 * 横スクロール可能なテーブルラッパー
 *
 * 機能：
 *   - スマホ・タブレットで横スクロールが必要な時だけ「← →」ヒントを表示
 *   - スクロール位置に応じて、「← もっと左へ」「もっと右へ →」のフェードインジケーターを表示
 *   - 横スクロール可能な領域には控えめな緑のスクロールバーを当てて視認性UP
 *
 * 使い方：
 *   <ScrollableTable>
 *     <table>...</table>
 *   </ScrollableTable>
 */
export default function ScrollableTable({ children, className = '' }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const overflow = max > 4; // 4px のマージン（端数誤差吸収）
      setShowHint(overflow);
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(overflow && el.scrollLeft < max - 4);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });

    // ResizeObserver で画面サイズ変化にも対応
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [children]);

  return (
    <div className={`relative ${className}`}>
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>

      {/* スクロール可能な時だけ表示 */}
      {showHint && (
        <>
          {/* 左フェード（左に隠れているコンテンツがある時） */}
          {canScrollLeft && (
            <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
          )}
          {/* 右フェード（右に隠れているコンテンツがある時） */}
          {canScrollRight && (
            <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
          )}
          {/* スマホでのみ「← スワイプで横へ →」ヒントを下に表示 */}
          <p className="sm:hidden mt-1 text-center text-xs text-gray-400 select-none">
            <span className={canScrollLeft ? 'text-green-700 font-medium' : ''}>←</span>
            <span className="mx-2">スワイプで横にスクロール</span>
            <span className={canScrollRight ? 'text-green-700 font-medium' : ''}>→</span>
          </p>
        </>
      )}
    </div>
  );
}
