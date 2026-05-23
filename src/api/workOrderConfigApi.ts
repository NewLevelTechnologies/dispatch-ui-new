import apiClient from './client';

// ===== Work Order Type (curated palette) =====
// Mirrors the roles shape: persisted `accentId` token, server-computed
// `colorsInUse` map on list/detail responses, 409 ACCENT_ID_TAKEN on
// conflicting writes. Description column is retained on the BE but no
// longer surfaced — omit it from request bodies on FE writes.
export interface WorkOrderType {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  accentId: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderTypeColorOwner {
  typeId: string;
  typeName: string;
}

export interface WorkOrderTypeListResponse {
  types: WorkOrderType[];
  colorsInUse: Record<string, WorkOrderTypeColorOwner>;
}

export interface CreateWorkOrderTypeRequest {
  name: string;
  code: string;
  accentId: string;
  sortOrder?: number;
}

export interface UpdateWorkOrderTypeRequest {
  name?: string;
  accentId?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface AccentConflictBody {
  code?: 'ACCENT_ID_TAKEN';
  field?: 'accentId';
  conflictingTypeId?: string;
  conflictingTypeName?: string;
}

// ===== Work Item Status =====
export type StatusCategory =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'CANCELLED';

export const STATUS_CATEGORIES: StatusCategory[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
  'CANCELLED',
];

export interface WorkItemStatus {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  statusCategory: StatusCategory;
  isTerminal: boolean;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkItemStatusRequest {
  name: string;
  code: string;
  statusCategory: StatusCategory;
  isTerminal?: boolean;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
}

export interface UpdateWorkItemStatusRequest {
  name?: string;
  statusCategory?: StatusCategory;
  isTerminal?: boolean;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

// ===== Status Workflow =====
export interface StatusWorkflowRule {
  id: string;
  tenantId: string;
  fromStatusId: string;
  toStatusId: string;
  isAllowed: boolean;
  requiresApproval: boolean;
  approvalRole?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStatusWorkflowRequest {
  fromStatusId: string;
  toStatusId: string;
  isAllowed?: boolean;
  requiresApproval?: boolean;
  approvalRole?: string | null;
}

// ===== Workflow Config (per-tenant settings) =====
export type DispatchBoardType = 'STATUS_BASED' | 'SCHEDULE_BASED';

export interface WorkflowConfig {
  id: string;
  tenantId: string;
  enforceStatusWorkflow: boolean;
  defaultWorkOrderTypeId?: string | null;
  defaultWorkItemStatusId?: string | null;
  dispatchBoardType: DispatchBoardType;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWorkflowConfigRequest {
  enforceStatusWorkflow?: boolean;
  defaultWorkOrderTypeId?: string | null;
  defaultWorkItemStatusId?: string | null;
  dispatchBoardType?: DispatchBoardType;
}

const BASE = '/work-orders/config';

// ===== Work Order Types =====
// `list()` is the canonical envelope (carries colorsInUse for the picker).
// `getAll()` flattens to just the array for non-settings consumers that only
// need names/ids (work order forms, dispatch board, reports, etc.).
export const workOrderTypesApi = {
  list: async (): Promise<WorkOrderTypeListResponse> => {
    const response = await apiClient.get<WorkOrderTypeListResponse>(`${BASE}/types`);
    return response.data;
  },
  getAll: async (): Promise<WorkOrderType[]> => {
    const envelope = await workOrderTypesApi.list();
    return envelope.types;
  },
  create: async (request: CreateWorkOrderTypeRequest): Promise<WorkOrderType> => {
    const response = await apiClient.post<WorkOrderType>(`${BASE}/types`, request);
    return response.data;
  },
  update: async (id: string, request: UpdateWorkOrderTypeRequest): Promise<WorkOrderType> => {
    const response = await apiClient.patch<WorkOrderType>(`${BASE}/types/${id}`, request);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/types/${id}`);
  },
  reorder: async (orderedIds: string[]): Promise<WorkOrderType[]> => {
    const response = await apiClient.post<WorkOrderType[]>(`${BASE}/types/reorder`, { orderedIds });
    return response.data;
  },
};

// ===== Division (name + code only) =====
// Description and color were dropped — divisions are a view-scope switcher,
// not a visual differentiator. If cross-division distinction is ever needed
// (rare), add a fresh `accentId` rather than reviving the column.
export interface Division {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDivisionRequest {
  name: string;
  code: string;
  sortOrder?: number;
}

export interface UpdateDivisionRequest {
  name?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export const divisionsApi = {
  getAll: async (): Promise<Division[]> => {
    const response = await apiClient.get<Division[]>(`${BASE}/divisions`);
    return response.data;
  },
  create: async (request: CreateDivisionRequest): Promise<Division> => {
    const response = await apiClient.post<Division>(`${BASE}/divisions`, request);
    return response.data;
  },
  update: async (id: string, request: UpdateDivisionRequest): Promise<Division> => {
    const response = await apiClient.patch<Division>(`${BASE}/divisions/${id}`, request);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/divisions/${id}`);
  },
  reorder: async (orderedIds: string[]): Promise<Division[]> => {
    const response = await apiClient.post<Division[]>(`${BASE}/divisions/reorder`, { orderedIds });
    return response.data;
  },
};

// ===== Work Item Statuses =====
export const workItemStatusesApi = {
  getAll: async (): Promise<WorkItemStatus[]> => {
    const response = await apiClient.get<WorkItemStatus[]>(`${BASE}/item-statuses`);
    return response.data;
  },
  create: async (request: CreateWorkItemStatusRequest): Promise<WorkItemStatus> => {
    const response = await apiClient.post<WorkItemStatus>(`${BASE}/item-statuses`, request);
    return response.data;
  },
  update: async (id: string, request: UpdateWorkItemStatusRequest): Promise<WorkItemStatus> => {
    const response = await apiClient.patch<WorkItemStatus>(`${BASE}/item-statuses/${id}`, request);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/item-statuses/${id}`);
  },
  reorder: async (orderedIds: string[]): Promise<WorkItemStatus[]> => {
    const response = await apiClient.post<WorkItemStatus[]>(`${BASE}/item-statuses/reorder`, { orderedIds });
    return response.data;
  },
};

// ===== Status Workflows =====
export const statusWorkflowsApi = {
  getAll: async (): Promise<StatusWorkflowRule[]> => {
    const response = await apiClient.get<StatusWorkflowRule[]>(`${BASE}/status-workflows`);
    return response.data;
  },
  create: async (request: CreateStatusWorkflowRequest): Promise<StatusWorkflowRule> => {
    const response = await apiClient.post<StatusWorkflowRule>(`${BASE}/status-workflows`, request);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/status-workflows/${id}`);
  },
};

// ===== Workflow Config =====
export const workflowConfigApi = {
  get: async (): Promise<WorkflowConfig> => {
    const response = await apiClient.get<WorkflowConfig>(`${BASE}/workflow`);
    return response.data;
  },
  update: async (request: UpdateWorkflowConfigRequest): Promise<WorkflowConfig> => {
    const response = await apiClient.patch<WorkflowConfig>(`${BASE}/workflow`, request);
    return response.data;
  },
};
