import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';

// ── Helpers ───────────────────────────────────────────────────────────────────

function dispatchKey(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  act(() => { document.dispatchEvent(event); });
  return event;
}

// ── Test components ───────────────────────────────────────────────────────────

function TrapModal({ onEscape, count = 3 }: { onEscape?: () => void; count?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, onEscape);
  return (
    <div ref={containerRef}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          data-testid={i === 0 ? 'btn-first' : i === count - 1 ? 'btn-last' : `btn-mid-${i}`}
        >
          Button {i + 1}
        </button>
      ))}
    </div>
  );
}

function EmptyModal() {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef);
  return <div ref={containerRef}><span>no buttons</span></div>;
}

function NullRefModal() {
  // ref is intentionally not attached to any DOM element
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef);
  return <div>no ref attached</div>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  // Clean up any lingering focus
  (document.activeElement as HTMLElement | null)?.blur?.();
});

describe('useFocusTrap', () => {
  it('focuses first focusable element on mount', () => {
    const { getByTestId } = render(<TrapModal />);
    expect(document.activeElement).toBe(getByTestId('btn-first'));
  });

  it('calls onEscape when Escape is pressed', () => {
    const onEscape = vi.fn();
    render(<TrapModal onEscape={onEscape} />);
    dispatchKey('Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does not throw when Escape pressed without an onEscape handler', () => {
    render(<TrapModal />);
    expect(() => dispatchKey('Escape')).not.toThrow();
  });

  it('ignores non-Tab, non-Escape keys', () => {
    const onEscape = vi.fn();
    render(<TrapModal onEscape={onEscape} />);
    dispatchKey('ArrowDown');
    dispatchKey('Enter');
    dispatchKey('Space');
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('wraps Tab forward from last element to first', () => {
    const { getByTestId } = render(<TrapModal count={3} />);
    act(() => getByTestId('btn-last').focus());
    dispatchKey('Tab');
    expect(document.activeElement).toBe(getByTestId('btn-first'));
  });

  it('wraps Shift+Tab backward from first element to last', () => {
    const { getByTestId } = render(<TrapModal count={3} />);
    act(() => getByTestId('btn-first').focus());
    dispatchKey('Tab', true);
    expect(document.activeElement).toBe(getByTestId('btn-last'));
  });

  it('does not intercept Tab when not at the last element', () => {
    const { getByTestId } = render(<TrapModal count={3} />);
    act(() => getByTestId('btn-first').focus());
    const event = dispatchKey('Tab');
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not intercept Shift+Tab when not at the first element', () => {
    const { getByTestId } = render(<TrapModal count={3} />);
    act(() => getByTestId('btn-last').focus());
    const event = dispatchKey('Tab', true);
    expect(event.defaultPrevented).toBe(false);
  });

  it('prevents default on Tab when container has no focusable elements', () => {
    render(<EmptyModal />);
    const event = dispatchKey('Tab');
    expect(event.defaultPrevented).toBe(true);
  });

  it('restores focus to previously active element on unmount', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    act(() => outside.focus());
    expect(document.activeElement).toBe(outside);

    const { unmount } = render(<TrapModal />);
    unmount();

    expect(document.activeElement).toBe(outside);
    document.body.removeChild(outside);
  });

  it('does nothing when containerRef is null — no error thrown', () => {
    expect(() => render(<NullRefModal />)).not.toThrow();
  });
});
