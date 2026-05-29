import apiClient from './client';

// Tenant tag list. Endpoint lives under /customers because the customer service
// owns the resource today, but the same tags apply to both customers and
// service locations via the ?tags= filter on each list endpoint.
//
// Default response: active tags only, sorted by name. Tenant counts are
// typically <50 (hard cap 200), so client-side filtering in pickers is fine —
// the `q` param is available for server-side typeahead if a future picker
// needs it.
export interface Tag {
  id: string;
  name: string;
  color: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const tagApi = {
  getAll: async (params?: {
    q?: string;
    includeArchived?: boolean;
  }): Promise<Tag[]> => {
    const apiParams: Record<string, string | boolean | undefined> = {
      q: params?.q,
      includeArchived: params?.includeArchived || undefined,
    };
    for (const key of Object.keys(apiParams)) {
      const v = apiParams[key];
      if (v === undefined || v === '') delete apiParams[key];
    }
    const response = await apiClient.get<Tag[]>('/customers/tags', { params: apiParams });
    return response.data;
  },
};

export default tagApi;
