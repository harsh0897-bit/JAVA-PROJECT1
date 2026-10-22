import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

// Reference-counted scroll lock so multiple or overlapping modals restore body styles reliably
let openModalCount = 0;
let savedBodyOverflow = '';
let savedBodyPaddingRight = '';

function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (openModalCount === 0) {
    const scrollBarWidth = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth
    );
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
  }
  openModalCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined' || openModalCount <= 0) return;
  openModalCount -= 1;
  if (openModalCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.paddingRight = savedBodyPaddingRight;
  }
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  maxWidthClass = 'max-w-lg',
  children,
  triggerRef,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus preservation and background scroll lock with layout-shift compensation
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();

    // Move initial focus to dialog's first input/control or dialog itself
    const focusTimer = window.setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelector<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([aria-label="Close dialog"]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
          focusable.focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 30);

    return () => {
      window.clearTimeout(focusTimer);
      unlockBodyScroll();
      // Restore focus to trigger element or previous focus target
      const returnTarget = triggerRef?.current || previousActiveElementRef.current;
      if (returnTarget && typeof returnTarget.focus === 'function') {
        requestAnimationFrame(() => {
          returnTarget.focus();
        });
      }
    };
  }, [isOpen, triggerRef]);

  // Escape key handler (closes modal only if an inner popover/menu did not already consume Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap inside modal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;

    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || document.activeElement === dialogRef.current) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal-backdrop, 50)' as unknown as number,
      }}
      className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`cf-card w-full ${maxWidthClass} flex flex-col shadow-2xl transition-all duration-200 outline-none`}
        style={{
          position: 'relative',
          zIndex: 'var(--z-modal, 60)' as unknown as number,
          width: 'min(100%, calc(100vw - 2rem))',
          maxHeight: 'min(calc(100vh - 2rem), calc(100dvh - 2rem))',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Sticky Header so Title & Close Button stay reachable at short viewport heights */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 sticky top-0 bg-white/95 backdrop-blur-xs z-10 rounded-t-[20px] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <h3 id={titleId} className="text-base font-bold text-slate-900 truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Dialog Body */}
        <div className="p-6 pt-4 space-y-4 min-w-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

