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

interface PopoverPosition {
  top: number;
  left: number;
  width: number;
  caretX: number;
}

export const Popover: React.FC<PopoverProps> = ({
  id,
  isOpen,
  onClose,
  triggerRef,
  width = 380,
  role = 'listbox',
  ariaLabel,
  onKeyDown,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPosition>({
    top: 96,
    left: 12,
    width,
    caretX: 48,
  });

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl || typeof window === 'undefined') return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const shellEl =
      triggerEl.closest('.cf-liquid-shell') ||
      document.querySelector('.cf-liquid-shell');
    const shellRect = shellEl ? shellEl.getBoundingClientRect() : triggerRect;

    const vw = window.innerWidth;
    const margin = 12;
    const actualWidth = Math.min(width, Math.max(240, vw - margin * 2));

    const top = Math.round(shellRect.bottom + 10);
    const left = Math.round(
      Math.max(margin, Math.min(triggerRect.left, vw - actualWidth - margin))
    );

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const caretX = Math.round(
      Math.max(22, Math.min(triggerCenterX - left, actualWidth - 22))
    );

    setPos({
      top,
      left,
      width: actualWidth,
      caretX,
    });
  }, [triggerRef, width]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const rafId = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      updatePosition();
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose(false);
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, true);
    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleUpdate);
      const shellEl =
        triggerRef.current?.closest('.cf-liquid-shell') ||
        document.querySelector('.cf-liquid-shell');
      if (shellEl) ro.observe(shellEl);
      if (document.documentElement) ro.observe(document.documentElement);
    }

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      ro?.disconnect();
    };
  }, [isOpen, onClose, triggerRef, updatePosition]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      data-open="true"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        width: `${pos.width}px`,
        maxWidth: 'calc(100vw - 24px)',
        transformOrigin: `${pos.caretX}px top`,
      }}
      className="cf-pop focus:outline-none"
    >
      <span
        aria-hidden="true"
        className="cf-pop-caret pointer-events-none"
        style={{ left: `${pos.caretX - 7}px` }}
      />
      <div className="max-h-[min(70vh,560px)] overflow-y-auto p-2.5">
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Popover;
