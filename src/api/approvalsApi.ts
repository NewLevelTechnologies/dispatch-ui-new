import apiClient from './client';

// Work-item transition approval requests created by the workflow engine
// (see dispatch-api workflow engine handoff). The list endpoint embeds the
// transition, workItem, workOrder, and requester context so the inbox UI
// can render rows without N+1 fetches.

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ApprovalStatusRef {
  id: string;
  name: string;
  accentId: string;
}

export interface ApprovalTransitionRef {
  id: string;
  fromStatus: ApprovalStatusRef;
  toStatus: ApprovalStatusRef;
  workflowName: string;
  /** Capabilities allowed to approve; embedded so the FE can decide whether
   *  to render the inline approve/reject affordance without a second fetch. */
  approverCapabilities?: string[];
}

export interface ApprovalWorkItemRef {
  id: string;
  name: string;
}

export interface ApprovalWorkOrderRef {
  id: string;
  displayId: string;
  customerName: string;
  serviceLocation?: string;
}

export interface ApprovalUserRef {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
}

export interface ApprovalRequest {
  id: string;
  status: ApprovalStatus;
  transition: ApprovalTransitionRef;
  workItem: ApprovalWorkItemRef;
  workOrder: ApprovalWorkOrderRef;
  requester: ApprovalUserRef;
  requestedAt: string;
  expiresAt: string;
  reason?: string;
  respondedAt?: string;
  respondedBy?: { id: string; firstName: string; lastName: string };
  responseNote?: string;
}

export interface ListApprovalsParams {
  status?: ApprovalStatus | ApprovalStatus[];
  assignedToMe?: boolean;
  requestedByMe?: boolean;
  workOrderId?: string;
}

export interface ApprovalCountParams {
  status?: ApprovalStatus | ApprovalStatus[];
  assignedToMe?: boolean;
  requestedByMe?: boolean;
}

export interface ApprovalCountResponse {
  count: number;
}

export interface ApproveApprovalRequest {
  reason?: string;
}

export interface RejectApprovalRequest {
  reason: string;
}

function toQuery(params: ListApprovalsParams | ApprovalCountParams | undefined): Record<string, string | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | boolean> = {};
  if (params.status) {
    out.status = Array.isArray(params.status) ? params.status.join(',') : params.status;
  }
  if (params.assignedToMe) out.assignedToMe = true;
  if (params.requestedByMe) out.requestedByMe = true;
  const wo = (params as ListApprovalsParams).workOrderId;
  if (wo) out.workOrderId = wo;
  return out;
}

export const approvalsApi = {
  list: async (params?: ListApprovalsParams): Promise<ApprovalRequest[]> => {
    const response = await apiClient.get<ApprovalRequest[]>('/approvals', { params: toQuery(params) });
    return response.data;
  },
  getById: async (id: string): Promise<ApprovalRequest> => {
    const response = await apiClient.get<ApprovalRequest>(`/approvals/${id}`);
    return response.data;
  },
  // Lightweight count for the topbar bell. Backend may not expose this yet —
  // callers should fall back to `list(...).length` if the endpoint 404s.
  getCount: async (params?: ApprovalCountParams): Promise<number> => {
    const response = await apiClient.get<ApprovalCountResponse>('/approvals/count', {
      params: toQuery(params),
    });
    return response.data.count;
  },
  approve: async (id: string, request: ApproveApprovalRequest = {}): Promise<ApprovalRequest> => {
    const response = await apiClient.post<ApprovalRequest>(`/approvals/${id}/approve`, request);
    return response.data;
  },
  reject: async (id: string, request: RejectApprovalRequest): Promise<ApprovalRequest> => {
    const response = await apiClient.post<ApprovalRequest>(`/approvals/${id}/reject`, request);
    return response.data;
  },
};

export default approvalsApi;
