import React, { useEffect, useRef, useState } from 'react';
import { useDropSlider } from './useDropSlider';

const clsx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export interface DropletTabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  badge?: number | string;
  sublabel?: string;
  disabled?: boolean;
}

export interface DropletTabsProps {
  items: DropletTabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'stepper' | 'compact' | 'nav' | 'dark';
  connectors?: boolean;
  renderItem?: (item: DropletTabItem, isActive: boolean) => React.ReactNode;
  ariaLabel?: string;
  className?: string;
  idPrefix?: string;
}

function renderTabIcon(
  icon: DropletTabItem['icon'],
  iconClassName: string
): React.ReactNode {
  if (!icon) return null;
  if (React.isValidElement(icon)) {
    return icon;
  }
  const IconComp = icon as React.ComponentType<{ className?: string }>;
  return <IconComp className={iconClassName} />;
}

export const DropletTabs: React.FC<DropletTabsProps> = ({
  items,
  value,
  onChange,
  variant = 'compact',
  connectors = false,
  renderItem,
  ariaLabel,
  className = '',
  idPrefix,
}) => {
  const isStepper = variant === 'stepper';
  const isDark = variant === 'dark';
  const isNav = variant === 'nav';

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const effectiveValue = isNav && hoveredId ? hoveredId : value;

  const { trackRef, pillRef, bodyRef, pulse } = useDropSlider(effectiveValue);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reducedMotionRef = useRef<boolean>(false);
  const prevValueRef = useRef<string>(value);
  const pulseOverlayRef = useRef<HTMLSpanElement | null>(null);
  const pulseBarRef = useRef<HTMLSpanElement | null>(null);
  const pulseAnimRef = useRef<Animation | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const onChangeMotion = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener('change', onChangeMotion);
    return () => {
      mq.removeEventListener('change', onChangeMotion);
      if (pulseAnimRef.current) {
        pulseAnimRef.current.cancel();
        pulseAnimRef.current = null;
      }
    };
  }, []);

  // F3: Directional flowing blue pulse along stepper connectors on stage change
  useEffect(() => {
    if (!isStepper || !connectors) {
      prevValueRef.current = value;
      return;
    }

    const prevId = prevValueRef.current;
    prevValueRef.current = value;

    if (prevId === value) return;

    // Cancel any running pulse animation immediately on rapid second click
    if (pulseAnimRef.current) {
      pulseAnimRef.current.cancel();
      pulseAnimRef.current = null;
    }

    const track = trackRef.current;
    const overlay = pulseOverlayRef.current;
    const bar = pulseBarRef.current;
    if (!track || !overlay || !bar) return;

    // Under prefers-reduced-motion or narrow horizontal overflow, skip traveling pulse
    if (
      reducedMotionRef.current ||
      track.scrollWidth > track.clientWidth + 4 ||
      typeof bar.animate !== 'function'
    ) {
      overlay.style.opacity = '0';
      return;
    }

    const fromIdx = items.findIndex((it) => it.id === prevId);
    const toIdx = items.findIndex((it) => it.id === value);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) {
      overlay.style.opacity = '0';
      return;
    }

    const fromBtn = itemRefs.current[fromIdx];
    const toBtn = itemRefs.current[toIdx];
    if (!fromBtn || !toBtn) {
      overlay.style.opacity = '0';
      return;
    }

    // Measure connector path geometry once per transition (no per-frame DOM reads)
    const isForward = toIdx > fromIdx;
    const startX = isForward
      ? fromBtn.offsetLeft + fromBtn.offsetWidth * 0.72
      : fromBtn.offsetLeft + fromBtn.offsetWidth * 0.28;
    const endX = isForward
      ? toBtn.offsetLeft + toBtn.offsetWidth * 0.28
      : toBtn.offsetLeft + toBtn.offsetWidth * 0.72;

    const spanLeft = Math.min(startX, endX);
    const spanWidth = Math.max(16, Math.abs(endX - startX));
    const pulseWidth = Math.max(44, Math.min(120, Math.round(spanWidth * 0.36)));

    overlay.style.left = `${Math.round(spanLeft)}px`;
    overlay.style.width = `${Math.round(spanWidth)}px`;
    overlay.style.opacity = '1';

    bar.style.width = `${pulseWidth}px`;
    const travelStart = isForward ? -pulseWidth : spanWidth;
    const travelEnd = isForward ? spanWidth : -pulseWidth;

    const anim = bar.animate(
      [
        { transform: `translate3d(${travelStart}px, 0, 0)`, opacity: 0.2 },
        {
          transform: `translate3d(${Math.round((travelStart + travelEnd) * 0.35)}px, 0, 0)`,
          opacity: 0.95,
          offset: 0.3,
        },
        {
          transform: `translate3d(${Math.round((travelStart + travelEnd) * 0.75)}px, 0, 0)`,
          opacity: 0.9,
          offset: 0.75,
        },
        { transform: `translate3d(${travelEnd}px, 0, 0)`, opacity: 0 },
      ],
      {
        duration: 500,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      }
    );

    anim.finished?.catch(() => {});
    pulseAnimRef.current = anim;
    anim.onfinish = () => {
      if (pulseAnimRef.current === anim) {
        overlay.style.opacity = '0';
        pulseAnimRef.current = null;
      }
    };
    anim.oncancel = () => {
      if (pulseAnimRef.current === anim) {
        overlay.style.opacity = '0';
        pulseAnimRef.current = null;
      }
    };
  }, [value, isStepper, connectors, items, trackRef]);

  // Scroll active item into center when the track overflows horizontally
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (track.scrollWidth <= track.clientWidth + 2) return;

    const idx = items.findIndex((it) => it.id === value);
    const activeBtn = idx >= 0 ? itemRefs.current[idx] : null;
    if (!activeBtn) return;

    activeBtn.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reducedMotionRef.current ? 'auto' : 'smooth',
    });
  }, [value, items, trackRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabledIndices = items
      .map((it, idx) => (it.disabled ? -1 : idx))
      .filter((idx) => idx >= 0);

    if (enabledIndices.length === 0) return;

    const currentPos = enabledIndices.indexOf(index);
    let nextIdx: number | null = null;

    if (e.key === 'ArrowRight') {
      const nextPos = currentPos >= 0 ? (currentPos + 1) % enabledIndices.length : 0;
      nextIdx = enabledIndices[nextPos] ?? null;
    } else if (e.key === 'ArrowLeft') {
      const prevPos =
        currentPos >= 0
          ? (currentPos - 1 + enabledIndices.length) % enabledIndices.length
          : 0;
      nextIdx = enabledIndices[prevPos] ?? null;
    } else if (e.key === 'Home') {
      nextIdx = enabledIndices[0] ?? null;
    } else if (e.key === 'End') {
      nextIdx = enabledIndices[enabledIndices.length - 1] ?? null;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      const targetItem = items[nextIdx];
      if (targetItem && !targetItem.disabled) {
        pulse();
        onChange(targetItem.id);
        itemRefs.current[nextIdx]?.focus();
      }
    }
  };

  // Padding py-1.5 px-1.5 (-my-1.5 -mx-1.5) gives the rounded active pill shadow and focus ring
  // 6px of unclipped clearance inside overflow-x-auto so no rectangular shadow artifact occurs.
  const trackLayoutClasses =
    isStepper && connectors
      ? 'cf-stepper-track relative flex items-center w-full h-[var(--row2,60px)] overflow-visible no-scrollbar'
      : 'relative inline-flex items-center gap-1.5 max-w-full overflow-x-auto snap-x no-scrollbar py-1.5 px-1.5 -my-1.5 -mx-1.5';

  const labelColorStyle: React.CSSProperties = {
    transition: 'color 200ms ease',
  };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      onMouseLeave={() => {
        if (isNav) setHoveredId(null);
      }}
      onBlur={(e) => {
        if (isNav && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setHoveredId(null);
        }
      }}
      className={clsx(trackLayoutClasses, className)}
    >
      {isStepper && (
        <style>{`
          @container shell (max-width:960px){
            .cf-stepper-tab .cf-step-stage-row{display:none!important}
          }
          @container shell (max-width:720px){
            .cf-stepper-track{overflow-x:auto!important;scroll-snap-type:x mandatory!important}
            .cf-stepper-tab{flex:0 0 auto!important; min-width:60px!important}
            .cf-step-connector{flex:0 0 8px!important}
          }
        `}</style>
      )}

      {/* F3: Reusable pointer-events-none directional pulse overlay along stepper connectors */}
      {isStepper && connectors && (
        <span
          ref={pulseOverlayRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: 0,
            height: '4px',
            marginTop: '-2px',
            borderRadius: '9999px',
            overflow: 'hidden',
            pointerEvents: 'none',
            opacity: 0,
            zIndex: 0,
          }}
        >
          <span
            ref={pulseBarRef}
            style={{
              display: 'block',
              height: '100%',
              borderRadius: '9999px',
              background:
                'linear-gradient(90deg, rgba(59,130,246,0) 0%, #3B82F6 35%, #2563EB 65%, rgba(37,99,235,0) 100%)',
              willChange: 'transform, opacity',
            }}
          />
        </span>
      )}

      <span ref={pillRef} data-drop-pill aria-hidden className="cf-drop-slider">
        <span ref={bodyRef} className="cf-drop" />
      </span>

      {items.map((item, idx) => {
        const isActive = item.id === effectiveValue;
        const tabDomId = idPrefix ? `${idPrefix}-tab-${item.id}` : `tab-${item.id}`;
        const panelDomId = idPrefix ? `${idPrefix}-panel-${item.id}` : `panel-${item.id}`;

        const buttonSizeClasses = isStepper
          ? 'cf-stepper-tab flex-1 min-w-0 h-[var(--row2,60px)] px-3 gap-2.5 items-center justify-start'
          : isDark
          ? 'flex-none shrink-0 h-8 px-3 gap-1.5'
          : 'flex-none shrink-0 h-9 px-4 gap-2';

        const buttonSurfaceClasses = isDark
          ? clsx(
              'relative rounded-full border',
              isActive
                ? 'bg-transparent border-transparent'
                : 'bg-white/70 border-slate-200 hover:bg-white'
            )
          : 'cf-droplet-idle';

        return (
          <React.Fragment key={item.id}>
            <button
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={tabDomId}
              aria-selected={isActive}
              aria-current={isStepper && isActive ? 'step' : undefined}
              aria-controls={panelDomId}
              disabled={item.disabled}
              tabIndex={isActive ? 0 : -1}
              data-drop-item={item.id}
              onPointerDown={() => {
                if (!item.disabled) {
                  pulse();
                }
              }}
              onMouseEnter={() => {
                if (isNav && !item.disabled) {
                  setHoveredId(item.id);
                }
              }}
              onFocus={() => {
                if (isNav && !item.disabled) {
                  setHoveredId(item.id);
                }
              }}
              onClick={() => {
                if (!item.disabled) {
                  if (isNav) setHoveredId(item.id);
                  onChange(item.id);
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={clsx(
                'group',
                buttonSurfaceClasses,
                'relative z-10 min-w-0 inline-flex items-center justify-start rounded-full',
                buttonSizeClasses,
                'select-none cursor-pointer snap-center disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1'
              )}
            >
              {renderItem ? (
                renderItem(item, isActive)
              ) : isStepper ? (
                <>
                  {item.icon && (
                    <span style={labelColorStyle} className="cf-bubble shrink-0">
                      {renderTabIcon(item.icon, 'w-5 h-5')}
                    </span>
                  )}

                  <span className="flex flex-col justify-center items-start text-left min-w-0 h-[36px]">
                    {item.sublabel && (
                      <span
                        style={labelColorStyle}
                        className={clsx(
                          'font-mono text-[11px] font-semibold tracking-wider uppercase leading-none tabular-nums truncate',
                          isActive ? 'text-white/90' : 'text-slate-500'
                        )}
                      >
                        {item.sublabel}
                      </span>
                    )}
                    <span className="cf-step-stage-row flex items-center gap-1.5 min-w-0 h-[18px] mt-1">
                      <span
                        style={labelColorStyle}
                        className={clsx(
                          'text-[13.5px] font-semibold tracking-tight leading-none truncate',
                          isActive ? 'text-white' : 'text-slate-800'
                        )}
                      >
                        {item.label}
                      </span>

                      {item.badge !== undefined && (
                        <span
                          style={labelColorStyle}
                          className={clsx(
                            'inline-flex px-1.5 h-[17px] min-w-[17px] rounded-full items-center justify-center text-[11px] font-mono font-bold leading-none tabular-nums shrink-0',
                            isActive
                              ? 'bg-white/25 text-white'
                              : 'bg-slate-900/[0.06] text-slate-600'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  {item.icon && (
                    <span
                      style={labelColorStyle}
                      className={clsx(
                        'shrink-0 flex items-center justify-center',
                        isActive
                          ? 'text-white'
                          : 'text-slate-500 group-hover:text-slate-800'
                      )}
                    >
                      {renderTabIcon(item.icon, 'w-4 h-4')}
                    </span>
                  )}
                  <span
                    style={labelColorStyle}
                    className={clsx(
                      'text-[13px] font-semibold tracking-tight whitespace-nowrap',
                      isActive
                        ? 'text-white'
                        : 'text-slate-700 group-hover:text-slate-900'
                    )}
                  >
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span
                      style={labelColorStyle}
                      className={clsx(
                        'px-1.5 h-4 min-w-[1rem] rounded-full inline-flex items-center justify-center text-[12px] font-mono font-bold tabular-nums shrink-0',
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-slate-900/[0.06] text-slate-600'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>

            {isStepper && connectors && idx < items.length - 1 && (
              <span
                aria-hidden="true"
                className="cf-step-connector flex-[0_0_20px] h-[2px] mx-1 rounded bg-slate-300/60 pointer-events-none select-none"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default DropletTabs;

