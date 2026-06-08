import { useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside `containerRef` while the component is mounted.
 * - Focuses the first focusable element on mount.
 * - Cycles Tab / Shift-Tab within the container.
 * - Calls `onEscape` (if provided) when Escape is pressed.
 * - Restores focus to the previously active element on unmount.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  onEscape?: () => void
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previously = document.activeElement as HTMLElement | null;

    const getFocusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    getFocusables()[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = getFocusables();
      if (focusables.length === 0) { e.preventDefault(); return; }

      const first = focusables[0];
      const last  = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previously?.focus();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
