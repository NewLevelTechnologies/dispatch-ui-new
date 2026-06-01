import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import TagPicker from './TagPicker';
import apiClient from '../api/client';
import type { Tag } from '../api';

vi.mock('../api/client');

const TAGS: Tag[] = [
  { id: '1', name: 'VIP', color: 'ACCENT_1', archivedAt: null, createdAt: '', updatedAt: '' },
  { id: '2', name: 'Roof access', color: 'WARNING', archivedAt: null, createdAt: '', updatedAt: '' },
];

function setup(props: Partial<React.ComponentProps<typeof TagPicker>> = {}) {
  const onApply = vi.fn();
  const onCreate = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <TagPicker
      appliedTagIds={[]}
      onApply={onApply}
      onCreate={onCreate}
      onClose={onClose}
      canCreate
      {...props}
    />
  );
  return { onApply, onCreate, onClose };
}

describe('TagPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: TAGS } as never);
  });

  it('lists the tenant tags as options', async () => {
    setup();
    expect(await screen.findByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('Roof access')).toBeInTheDocument();
  });

  it('filters options by the typed query', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('VIP');
    await user.type(screen.getByRole('textbox'), 'roof');
    expect(screen.getByText('Roof access')).toBeInTheDocument();
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
  });

  it('excludes already-applied tags', async () => {
    setup({ appliedTagIds: ['1'] });
    expect(await screen.findByText('Roof access')).toBeInTheDocument();
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
  });

  it('applies an existing tag on click', async () => {
    const user = userEvent.setup();
    const { onApply } = setup();
    await user.click(await screen.findByText('Roof access'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
  });

  it('offers a create row for a novel name and calls onCreate', async () => {
    const user = userEvent.setup();
    const { onCreate } = setup();
    await screen.findByText('VIP');
    await user.type(screen.getByRole('textbox'), 'Gate code');
    const createRow = await screen.findByText(/Create "Gate code"/);
    await user.click(createRow);
    expect(onCreate).toHaveBeenCalledWith('Gate code');
  });

  it('does not offer create when the name already exists (case-insensitive)', async () => {
    const user = userEvent.setup();
    const { onCreate } = setup();
    await screen.findByText('VIP');
    await user.type(screen.getByRole('textbox'), 'vip');
    expect(screen.queryByText(/Create "vip"/)).not.toBeInTheDocument();
    // Enter should apply the matching existing tag, not create a duplicate.
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('hides the create row when the user cannot create tags', async () => {
    const user = userEvent.setup();
    setup({ canCreate: false });
    await screen.findByText('VIP');
    await user.type(screen.getByRole('textbox'), 'Gate code');
    expect(screen.queryByText(/Create "Gate code"/)).not.toBeInTheDocument();
    expect(screen.getByText('No matching tags.')).toBeInTheDocument();
  });
});
