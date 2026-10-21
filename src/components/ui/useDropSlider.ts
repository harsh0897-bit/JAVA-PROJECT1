import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export function useDropSlider(activeId: string) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const readyRef = useRef(false);

  const reduced = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const measure = useCallback(
    (animate: boolean) => {
      const track = trackRef.current;
      const pill = pillRef.current;
      if (!track || !pill) return;

      const el = track.querySelector<HTMLElement>(
        `[data-drop-item="${CSS.escape(activeId)}"]`
      );
      if (!el) return;

      const x = el.offsetLeft;
      const y = el.offsetTop;
      const w = el.offsetWidth;
      const h = el.offsetHeight;

      const shouldAnimate = readyRef.current && animate && !reduced();

      if (!shouldAnimate) {
        pill.removeAttribute('data-animated');
        pill.style.transition = 'none';
      } else {
        pill.setAttribute('data-animated', 'true');
        pill.style.transition =
          'transform 550ms var(--spring), width 550ms var(--spring)';
      }

      pill.style.width = `${w}px`;
      pill.style.height = `${h}px`;
      pill.style.transform = `translateX(${x}px) translateY(${y}px)`;
      pill.style.opacity = '1';

      if (bodyRef.current) {
        bodyRef.current.style.transform = 'none';
      }

      if (!readyRef.current) {
        // Force layout before enabling future spring transitions so first paint never flickers
        void pill.offsetWidth;
        readyRef.current = true;
      }
    },
    [activeId]
  );

  // Active tab change -> animate with 550ms --spring
  useLayoutEffect(() => {
    measure(true);
  }, [measure]);

  // Re-measure with ResizeObserver and on font load without triggering spring bounce
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const ro = new ResizeObserver(() => measure(false));
    ro.observe(track);
    track
      .querySelectorAll<HTMLElement>('[data-drop-item]')
      .forEach((el) => ro.observe(el));

    document.fonts?.ready.then(() => measure(false));

    return () => ro.disconnect();
  }, [measure]);

  const pulse = useCallback(() => {
    // No scale squash or jelly wobble per Section 2
  }, []);

  return { trackRef, pillRef, bodyRef, pulse };
}

export default useDropSlider;

