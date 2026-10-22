import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PopoverProps {
  id: string;
  isOpen: boolean;
  onClose: (returnFocus?: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  width?: number;
  align?: 'start' | 'center' | 'end';
  widthClassName?: string;
  role?: 'listbox' | 'menu' | 'dialog';
  ariaLabel?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

type PopoverSide = 'bottom' | 'top';
type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'bottom-center' | 'top-start' | 'top-end' | 'top-center';

interface PopoverPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  caretX: number;
  showCaret: boolean;
  side: PopoverSide;
  placement: PopoverPlacement;
  ready: boolean;
}

const GAP = 8;
const VIEWPORT_PADDING = 12;
const MAX_HEIGHT_CAP = 560;
const POPOVER_OPEN_EVENT = 'cfx:popover-open';

export const Popover: React.FC<PopoverProps> = ({
  id,
  isOpen,
  onClose,
  triggerRef,
  width = 380,
  align,
  widthClassName,
  role = 'listbox',
  ariaLabel,
  onKeyDown,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState<PopoverPosition>({
    top: 0,
    left: 0,
    width,
    maxHeight: 400,
    caretX: 32,
    showCaret: true,
    side: 'bottom',
    placement: 'bottom-start',
    ready: false,
  });

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    const panelEl = panelRef.current;
    const scrollEl = scrollRef.current;
    if (!triggerEl || typeof window === 'undefined') return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;

    const availableWidth = Math.max(180, vw - VIEWPORT_PADDING * 2);
    const actualWidth = Math.round(Math.min(width, availableWidth));

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;

    // Respect explicit align prop; otherwise default to 'start' (bottom-start)
    // and use 'end' (bottom-end) for triggers in the right half when needed.
    const resolvedAlign: 'start' | 'center' | 'end' =
      align ??
      (triggerCenterX > vw / 2 &&
      (triggerRect.left + actualWidth > vw - VIEWPORT_PADDING ||
        triggerCenterX > vw * 0.72)
        ? 'end'
        : 'start');

    let preferredLeft: number;
    if (resolvedAlign === 'end') {
      preferredLeft = triggerRect.right - actualWidth;
    } else if (resolvedAlign === 'center') {
      preferredLeft = triggerCenterX - actualWidth / 2;
    } else {
      preferredLeft = triggerRect.left;
    }

    const left = Math.round(
      Math.max(
        VIEWPORT_PADDING,
        Math.min(preferredLeft, vw - actualWidth - VIEWPORT_PADDING)
      )
    );

    const spaceBelow = Math.max(0, vh - triggerRect.bottom - GAP - VIEWPORT_PADDING);
    const spaceAbove = Math.max(0, triggerRect.top - GAP - VIEWPORT_PADDING);
    const viewportCap = Math.min(Math.round(vh * 0.75), MAX_HEIGHT_CAP);

    if (panelEl) {
      panelEl.style.width = `${actualWidth}px`;
    }

    const naturalContentHeight = scrollEl
      ? scrollEl.scrollHeight + 2
      : panelEl?.scrollHeight || 260;
    const desiredHeight = Math.min(naturalContentHeight, viewportCap);

    const shouldFlipTop = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const side: PopoverSide = shouldFlipTop ? 'top' : 'bottom';
    const placement: PopoverPlacement = `${side}-${resolvedAlign}`;

    const availableSideHeight = side === 'top' ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(
      96,
      Math.round(Math.min(viewportCap, availableSideHeight))
    );

    if (scrollEl) {
      scrollEl.style.maxHeight = `${Math.max(80, maxHeight - 2)}px`;
    }

    const measuredPanelHeight = panelEl
      ? panelEl.offsetHeight || Math.min(naturalContentHeight, maxHeight)
      : Math.min(naturalContentHeight, maxHeight);
    const actualHeight = Math.min(measuredPanelHeight, maxHeight);

    let top: number;
    if (side === 'top') {
      top = Math.round(
        Math.max(VIEWPORT_PADDING, triggerRect.top - GAP - actualHeight)
      );
    } else {
      top = Math.round(
        Math.max(
          VIEWPORT_PADDING,
          Math.min(
            triggerRect.bottom + GAP,
            vh - VIEWPORT_PADDING - actualHeight
          )
        )
      );
    }

    const rawCaretX = triggerCenterX - left;
    const caretX = Math.round(
      Math.max(20, Math.min(rawCaretX, actualWidth - 20))
    );
    const showCaret =
      rawCaretX >= 14 &&
      rawCaretX <= actualWidth - 14 &&
      triggerRect.bottom >= 0 &&
      triggerRect.top <= vh;

    setPos((prev) => {
      if (
        prev.ready &&
        prev.top === top &&
        prev.left === left &&
        prev.width === actualWidth &&
        prev.maxHeight === maxHeight &&
        prev.caretX === caretX &&
        prev.showCaret === showCaret &&
        prev.side === side &&
        prev.placement === placement
      ) {
        return prev;
      }
      return {
        top,
        left,
        width: actualWidth,
        maxHeight,
        caretX,
        showCaret,
        side,
        placement,
        ready: true,
      };
    });
  }, [triggerRef, width, align]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPos((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }
    updatePosition();
    const rafId = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, updatePosition, children]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    // Coordinate across independent Popover instances so a second menu never stays open over the first
    window.dispatchEvent(
      new CustomEvent(POPOVER_OPEN_EVENT, { detail: { id } })
    );

    const handleOtherPopoverOpen = (e: Event) => {
      const custom = e as CustomEvent<{ id?: string }>;
      if (custom.detail?.id && custom.detail.id !== id) {
        onClose(false);
      }
    };

    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updatePosition();
      });
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose(false);
    };

    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        e.stopPropagation();
        onClose(true);
        requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
      }
    };

    window.addEventListener(POPOVER_OPEN_EVENT, handleOtherPopoverOpen);
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('scroll', scheduleUpdate, {
      capture: true,
      passive: true,
    });
    const vv = window.visualViewport;
    vv?.addEventListener('resize', scheduleUpdate, { passive: true });
    vv?.addEventListener('scroll', scheduleUpdate, { passive: true });

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, {
      passive: true,
    });
    document.addEventListener('keydown', handleDocumentKeyDown, true);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleUpdate);
      if (triggerRef.current) ro.observe(triggerRef.current);
      if (panelRef.current) ro.observe(panelRef.current);
      if (scrollRef.current) ro.observe(scrollRef.current);
      if (document.documentElement) ro.observe(document.documentElement);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener(POPOVER_OPEN_EVENT, handleOtherPopoverOpen);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      vv?.removeEventListener('resize', scheduleUpdate);
      vv?.removeEventListener('scroll', scheduleUpdate);
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
      ro?.disconnect();
    };
  }, [id, isOpen, onClose, triggerRef, updatePosition]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const isInsideModal = Boolean(triggerRef.current?.closest?.('[role="dialog"]'));

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      data-open={pos.ready ? 'true' : 'false'}
      data-side={pos.side}
      data-placement={pos.placement}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        zIndex: (isInsideModal
          ? 'var(--z-modal-popover, 65)'
          : 'var(--z-dropdown, 40)') as unknown as number,
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        width: `${pos.width}px`,
        maxWidth: `calc(100vw - ${VIEWPORT_PADDING * 2}px)`,
        visibility: pos.ready ? 'visible' : 'hidden',
        pointerEvents: pos.ready ? 'auto' : 'none',
        transformOrigin: `${pos.caretX}px ${pos.side === 'top' ? 'bottom' : 'top'}`,
      }}
      className={`cf-pop focus:outline-none ${widthClassName || ''}`.trim()}
    >
      {pos.showCaret && (
        <span
          aria-hidden="true"
          className="cf-pop-caret pointer-events-none"
          style={{ left: `${pos.caretX - 7}px` }}
        />
      )}
      <div
        ref={scrollRef}
        style={{ maxHeight: `${Math.max(80, pos.maxHeight - 2)}px` }}
        className="overflow-y-auto p-2.5"
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Popover;

