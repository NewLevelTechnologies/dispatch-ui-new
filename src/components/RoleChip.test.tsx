import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleChip } from './RoleChip';
import { roleColor } from '../utils/roleColor';

describe('RoleChip', () => {
  it('renders the role name', () => {
    render(<RoleChip name="Dispatcher" />);
    expect(screen.getByText('Dispatcher')).toBeInTheDocument();
  });

  it('applies the deterministic role color as the text color', () => {
    render(<RoleChip name="Admin" />);
    const chip = screen.getByText('Admin');
    expect(chip).toHaveStyle({ color: roleColor('Admin') });
  });

  it('renders the leading dot using the same color', () => {
    const { container } = render(<RoleChip name="CSR" />);
    const dot = container.querySelector('span > span');
    expect(dot).not.toBeNull();
    expect(dot).toHaveStyle({ background: roleColor('CSR') });
  });
});
