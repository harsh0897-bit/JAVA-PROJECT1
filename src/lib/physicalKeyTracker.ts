/**
 * Physical modifier key tracker for reliable trackpad pinch vs Ctrl+Wheel separation.
 * macOS and browser trackpad pinch gestures report e.ctrlKey === true on wheel events
 * even when no physical Ctrl/Meta key is held down.
 */

let physicalCtrlOrMeta = false;
let listenersAttached = false;

export function initPhysicalKeyTracker(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        physicalCtrlOrMeta = true;
      }
    },
    { capture: true, passive: true }
  );

  window.addEventListener(
    'keyup',
    (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        physicalCtrlOrMeta = false;
      } else if (!e.ctrlKey && !e.metaKey) {
        physicalCtrlOrMeta = false;
      }
    },
    { capture: true, passive: true }
  );

  window.addEventListener(
    'blur',
    () => {
      physicalCtrlOrMeta = false;
    },
    { passive: true }
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        physicalCtrlOrMeta = false;
      }
    },
    { passive: true }
  );
}

export function isPhysicalCtrlOrMetaPressed(): boolean {
  initPhysicalKeyTracker();
  return physicalCtrlOrMeta;
}

/**
 * Scrolls the active workspace scroller or window by normalized deltaY.
 */
export function scrollWorkspaceBy(deltaY: number): void {
  const panel = document.querySelector('[role="tabpanel"]') as HTMLElement | null;
  let owner: HTMLElement | Window = window;
  let curr = panel?.parentElement;

  while (curr && curr !== document.body && curr !== document.documentElement) {
    const style = window.getComputedStyle(curr);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      curr.scrollHeight > curr.clientHeight
    ) {
      owner = curr;
      break;
    }
    curr = curr.parentElement;
  }

  if (owner instanceof Window) {
    window.scrollBy({ top: deltaY, behavior: 'auto' });
  } else {
    owner.scrollBy({ top: deltaY, behavior: 'auto' });
  }
}
