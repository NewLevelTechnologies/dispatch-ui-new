import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleSwitch } from './ToggleSwitch';

describe('ToggleSwitch', () => {
  it('renders as a switch role with aria-checked false when off', () => {
    render(<ToggleSwitch on={false} ariaLabel="Notifications" />);
    const sw = screen.getByRole('switch', { name: 'Notifications' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects the on state via aria-checked', () => {
    render(<ToggleSwitch on={true} ariaLabel="Notifications" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles via onChange when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleSwitch on={false} onChange={onChange} ariaLabel="x" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('sends the inverse value on click when currently on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleSwitch on={true} onChange={onChange} ariaLabel="x" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not fire onChange when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ToggleSwitch on={false} onChange={onChange} disabled ariaLabel="x" />,
    );
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses small dimensions when size=sm', () => {
    const { container } = render(
      <ToggleSwitch on={false} size="sm" ariaLabel="x" />,
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('w-7');
    expect(btn.className).toContain('h-4');
  });

  it('uses medium dimensions by default', () => {
    const { container } = render(<ToggleSwitch on={false} ariaLabel="x" />);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('w-9');
    expect(btn.className).toContain('h-5');
  });
});
