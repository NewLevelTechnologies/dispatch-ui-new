// Scheduling API Client
import apiClient from './client';

// ========== DISPATCHES ==========

export type DispatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// Per WORK_ORDER_DETAIL_DESIGN.md / PHASE_6_FINAL_PLAN.md: dispatches commit a
// customer-facing arrival WINDOW (e.g. "Tue 8–10 AM") rather than a single
// scheduled point. The window is two timestamps; estimatedDuration is a
// separate, optional internal capacity estimate (used for utilization metrics
// and conflict detection on the dispatch board), not a customer commitment.
export interface Dispatch {
  id: string;
  workOrderId: string;
  assignedUserId: string;
  arrivalWindowStart: string;
  arrivalWindowEnd: string;
  estimatedDuration: number | null;
  status: DispatchStatus;
  arrivedAt: string | null;
  departedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDispatchRequest {
  workOrderId: string;
  assignedUserId: string;
  arrivalWindowStart: string;
  arrivalWindowEnd: string;
  estimatedDuration?: number;
  notes?: string;
  // Opt-in SMS to the assigned technician on create. Default workflow is to
  // schedule silently and notify later from the dispatch row, so this defaults
  // to false / omitted.
  notifyAssignedUser?: boolean;
}

export interface UpdateDispatchRequest {
  // Reassignment mid-flight is rare but supported by the backend (e.g. tech
  // calls in sick before arrival). Editable only while SCHEDULED in the UI.
  assignedUserId?: string;
  arrivalWindowStart?: string;
  arrivalWindowEnd?: string;
  estimatedDuration?: number;
  status?: DispatchStatus;
  notes?: string;
}

// ---- Resolved technician view (location detail) ----
// Read-only summary that resolves "which tech matters" per work order at a
// location, plus who's physically on site right now. The backend picks one
// primary tech per WO: on-site wins → next upcoming SCHEDULED → most recent
// historical lead (DONE). `extra` is a COUNT of additional distinct techs on
// that WO, not a list — surfacing their names is a future backend follow-up.
export type TechState = 'ON_SITE' | 'SCHEDULED' | 'DONE';

export interface OnSiteTech {
  name: string | null; // null while the user-cache name resolves — render a fallback
  workOrderId: string;
  workOrderNumber: string;
  since: string; // arrived-at (ISO) — show as "on site since …"
  eta: string; // scheduled arrival window start (ISO)
}

export interface WorkOrderTech {
  name: string | null; // null → fallback (e.g. "Tech assigned"); never blank the row
  state: TechState;
  extra: number; // count of OTHER distinct techs on this WO (0 = just this one)
  live: boolean; // true only when state === 'ON_SITE'
}

export interface LocationTechSummaryResponse {
  onSiteTech: OnSiteTech | null; // null when nobody is on site right now
  techByWorkOrder: Record<string, WorkOrderTech>; // keyed by workOrderId; {} is valid
}

export const dispatchesApi = {
  getAll: async (params?: {
    userId?: string;
    workOrderId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Dispatch[]> => {
    const response = await apiClient.get<Dispatch[]>('/scheduling/dispatches', { params });
    return response.data;
  },

  // Resolved technician view for a location detail page (read-only, safe to
  // fire on page load alongside the other location reads). An empty
  // techByWorkOrder ({}) means no dispatches are linked to this location's work
  // orders — not an error.
  getLocationTech: async (serviceLocationId: string): Promise<LocationTechSummaryResponse> => {
    const response = await apiClient.get<LocationTechSummaryResponse>(
      '/scheduling/dispatches/location-tech',
      { params: { serviceLocationId } },
    );
    return response.data;
  },

  getById: async (id: string): Promise<Dispatch> => {
    const response = await apiClient.get<Dispatch>(`/scheduling/dispatches/${id}`);
    return response.data;
  },

  create: async (request: CreateDispatchRequest): Promise<Dispatch> => {
    const response = await apiClient.post<Dispatch>('/scheduling/dispatches', request);
    return response.data;
  },

  update: async (id: string, request: UpdateDispatchRequest): Promise<Dispatch> => {
    const response = await apiClient.put<Dispatch>(`/scheduling/dispatches/${id}`, request);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/scheduling/dispatches/${id}`);
  },

  // Manually trigger an SMS to the assigned technician. Idempotent on the
  // backend, so this safely doubles as a resend when window/notes change.
  notify: async (id: string): Promise<void> => {
    await apiClient.post(`/scheduling/dispatches/${id}/notify`);
  },
};

// ========== AVAILABILITY ==========

export interface Availability {
  id: string;
  tenantId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  reason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityRequest {
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
  reason?: string;
  notes?: string;
}

export interface UpdateAvailabilityRequest {
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  reason?: string;
  notes?: string;
}

export const availabilityApi = {
  getAll: async (params?: {
    userId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Availability[]> => {
    const response = await apiClient.get<Availability[]>('/scheduling/availability', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Availability> => {
    const response = await apiClient.get<Availability>(`/scheduling/availability/${id}`);
    return response.data;
  },

  create: async (request: CreateAvailabilityRequest): Promise<Availability> => {
    const response = await apiClient.post<Availability>('/scheduling/availability', request);
    return response.data;
  },

  update: async (id: string, request: UpdateAvailabilityRequest): Promise<Availability> => {
    const response = await apiClient.put<Availability>(`/scheduling/availability/${id}`, request);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/scheduling/availability/${id}`);
  },
};

// ========== RECURRING ORDERS ==========

export interface RecurringOrder {
  id: string;
  tenantId: string;
  customerId: string;
  equipmentId?: string | null;
  frequency: string;
  nextScheduledDate: string;
  description?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringOrderRequest {
  customerId: string;
  equipmentId?: string | null;
  frequency: string;
  nextScheduledDate: string;
  description?: string;
  notes?: string;
}

export interface UpdateRecurringOrderRequest {
  frequency?: string;
  nextScheduledDate?: string;
  description?: string;
  status?: string;
  notes?: string;
}

export const recurringOrdersApi = {
  getAll: async (params?: {
    customerId?: string;
    equipmentId?: string;
    status?: string;
    dueBefore?: string;
  }): Promise<RecurringOrder[]> => {
    const response = await apiClient.get<RecurringOrder[]>('/scheduling/recurring-orders', { params });
    return response.data;
  },

  getById: async (id: string): Promise<RecurringOrder> => {
    const response = await apiClient.get<RecurringOrder>(`/scheduling/recurring-orders/${id}`);
    return response.data;
  },

  create: async (request: CreateRecurringOrderRequest): Promise<RecurringOrder> => {
    const response = await apiClient.post<RecurringOrder>('/scheduling/recurring-orders', request);
    return response.data;
  },

  update: async (id: string, request: UpdateRecurringOrderRequest): Promise<RecurringOrder> => {
    const response = await apiClient.put<RecurringOrder>(`/scheduling/recurring-orders/${id}`, request);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/scheduling/recurring-orders/${id}`);
  },
};

// Export combined API
export const allSchedulingApis = {
  dispatches: dispatchesApi,
  availability: availabilityApi,
  recurringOrders: recurringOrdersApi,
};

export default allSchedulingApis;
