import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoicesApi, quotesApi } from './financialApi';
import apiClient from './client';

vi.mock('./client');

const okSendResponse = {
  data: {
    notificationId: 'n-1',
    queuedAt: '2026-05-16T10:00:00Z',
    shareUrl: 'https://app.example/p/invoice/abc',
    lastSentToEmails: 'alice@example.com',
  },
};

describe('invoicesApi.send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.post).mockResolvedValue(okSendResponse);
  });

  it('POSTs with no body when called without recipientEmails (default-resolver path)', async () => {
    await invoicesApi.send('inv-1');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/financial/invoices/inv-1/send',
      undefined,
    );
  });

  it('POSTs the recipientEmails array as body when an override list is provided', async () => {
    await invoicesApi.send('inv-1', ['alice@example.com', 'bob@example.com']);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/financial/invoices/inv-1/send',
      { recipientEmails: ['alice@example.com', 'bob@example.com'] },
    );
  });

  it('omits the body when given an empty array (does NOT send recipientEmails: [])', async () => {
    // Empty array must collapse to "no body" so the backend resolver runs.
    // Sending { recipientEmails: [] } would be interpreted as an explicit
    // zero-recipient override and 422 NO_RECIPIENT.
    await invoicesApi.send('inv-1', []);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/financial/invoices/inv-1/send',
      undefined,
    );
  });
});

describe('quotesApi.send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.post).mockResolvedValue(okSendResponse);
  });

  it('POSTs with no body when called without recipientEmails', async () => {
    await quotesApi.send('q-1');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/financial/quotes/q-1/send',
      undefined,
    );
  });

  it('POSTs the recipientEmails array as body when an override list is provided', async () => {
    await quotesApi.send('q-1', ['alice@example.com']);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/financial/quotes/q-1/send',
      { recipientEmails: ['alice@example.com'] },
    );
  });

  it('omits the body when given an empty array', async () => {
    await quotesApi.send('q-1', []);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/financial/quotes/q-1/send',
      undefined,
    );
  });
});
