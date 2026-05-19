import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userApi } from './userApi';
import apiClient from './client';

vi.mock('./client');

function makeUser(over: Record<string, unknown> = {}) {
  return {
    id: 'u-1',
    tenantId: 't-1',
    cognitoSub: 'sub',
    email: 'me@example.com',
    firstName: 'Tenant',
    lastName: 'Two',
    phoneNumber: '6783624291',
    photoUrl: null,
    enabled: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...over,
  };
}

describe('userApi self-service endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateMyProfile PUTs /users/me with the patch body', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: makeUser({ firstName: 'Updated' }) });

    const result = await userApi.updateMyProfile({
      firstName: 'Updated',
      lastName: 'Two',
      phoneNumber: '6783624291',
    });

    expect(apiClient.put).toHaveBeenCalledWith('/users/me', {
      firstName: 'Updated',
      lastName: 'Two',
      phoneNumber: '6783624291',
    });
    expect(result.firstName).toBe('Updated');
  });

  it('uploadMyPhoto POSTs multipart to /users/me/photo with the file field', async () => {
    const updated = makeUser({ photoUrl: 'https://cdn/x.png' });
    vi.mocked(apiClient.post).mockResolvedValue({ data: updated });

    const file = new File(['fake'], 'me.png', { type: 'image/png' });
    const result = await userApi.uploadMyPhoto(file);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(url).toBe('/users/me/photo');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect((config as { headers?: Record<string, string> })?.headers).toMatchObject({
      'Content-Type': 'multipart/form-data',
    });
    expect(result.photoUrl).toBe('https://cdn/x.png');
  });

  it('deleteMyPhoto DELETEs /users/me/photo and returns the updated user', async () => {
    const updated = makeUser({ photoUrl: null });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: updated });

    const result = await userApi.deleteMyPhoto();

    expect(apiClient.delete).toHaveBeenCalledWith('/users/me/photo');
    expect(result.photoUrl).toBeNull();
  });
});
