import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ErrorState } from '../../components/ErrorState';

describe('ErrorState', () => {
  it('renders the default message', () => {
    render(<ErrorState />);
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText('Unable to load')).toBeInTheDocument();
  });

  it('renders a custom message when provided', () => {
    render(<ErrorState message="Could not fetch aurora data." />);
    expect(screen.getByText('Could not fetch aurora data.')).toBeInTheDocument();
  });

  it('renders the retry button and calls onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not render a retry button when onRetry is not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('wraps content in a card div when standalone=true (default)', () => {
    const { container } = render(<ErrorState />);
    // The outer div carries both "card" and "p-6" classes
    expect(container.querySelector('.card.p-6')).not.toBeNull();
  });

  it('uses a plain padding wrapper when standalone=false', () => {
    const { container } = render(<ErrorState standalone={false} />);
    expect(container.querySelector('.card')).toBeNull();
    expect(container.querySelector('.py-6')).not.toBeNull();
  });

  it('applies extra className to the wrapper in standalone mode', () => {
    const { container } = render(<ErrorState className="my-custom-class" />);
    expect(container.querySelector('.my-custom-class')).not.toBeNull();
  });

  it('applies extra className to the wrapper in non-standalone mode', () => {
    const { container } = render(<ErrorState standalone={false} className="my-custom-class" />);
    expect(container.querySelector('.my-custom-class')).not.toBeNull();
  });
});
