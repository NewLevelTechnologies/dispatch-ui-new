// Audit API Client
import apiClient from './client';

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole?: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

// Known action types for the account-activity feed. The contract is
// additive — new values land in this enum over time (failed sign-ins,
// success sign-ins, attempt-collapse rows from the Cognito Lambda
// triggers). Treat the string as freeform when matching and fall back
// to a generic "Activity" rendering for anything unrecognized.
export type ActivityActionType =
  | 'USER_CREATED'
  | 'ROLE_ADDED'
  | 'ROLE_REMOVED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'PASSWORD_RESET_SENT'
  | 'MFA_RESET'
  | 'GLOBAL_SIGNOUT'
  | 'INVITATION_RESENT'
  // Ships once the Cognito Lambda triggers deploy. Payload is
  // { attemptCount, windowSeconds, firstAt, lastAt }; the meta line
  // ("5 attempts · within 2 min") is composed client-side.
  | 'SIGN_IN_FAILED_RUN';

export interface ActivityActor {
  id: string;
  name: string;
}

export interface AccountActivityEvent {
  id: string;
  occurredAt: string;
  // Backend ships a closed enum today but the contract is documented as
  // additive — keep it as `string` at the type level so a newly-shipped
  // value doesn't ts-block the UI. Switch statements should default to a
  // generic glyph + "Activity" label.
  actionType: ActivityActionType | string;
  // jsonb on the backend. Only role events currently populate this with
  // { roleId, roleName }; sign-in events will add their own keys later.
  payload: Record<string, unknown> | null;
  actor: ActivityActor | null;
  ip: string | null;
  userAgent: string | null;
}

export const auditApi = {
  /**
   * Get audit history for a specific entity
   * @param entityType - Entity type (e.g., "Customer", "WorkOrder", "Invoice")
   * @param entityId - Entity UUID
   * @returns Array of audit logs ordered by timestamp DESC
   */
  getEntityHistory: async (entityType: string, entityId: string): Promise<AuditLog[]> => {
    const response = await apiClient.get<AuditLog[]>(`/audit/${entityType}/${entityId}`);
    return response.data;
  },

  /**
   * Get audit history for a specific user
   * @param userId - User UUID
   * @returns Array of audit logs ordered by timestamp DESC
   */
  getUserHistory: async (userId: string): Promise<AuditLog[]> => {
    const response = await apiClient.get<AuditLog[]>(`/audit/user/${userId}`);
    return response.data;
  },

  /**
   * Get recent audit history across all entities (admin only)
   * @param limit - Maximum number of records to return
   * @returns Array of audit logs ordered by timestamp DESC
   */
  getRecentHistory: async (limit: number = 50): Promise<AuditLog[]> => {
    const response = await apiClient.get<AuditLog[]>(`/audit/recent`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get the curated account-activity feed for a user. Returns the latest
   * 20 rows newest-first; no pagination. Backend caps the page size and
   * enforces VIEW_AUDIT_LOGS; 403 surfaces if the caller lacks it.
   */
  getAccountActivity: async (userId: string): Promise<AccountActivityEvent[]> => {
    const response = await apiClient.get<AccountActivityEvent[]>(
      `/audit/account-activity/${userId}`,
    );
    return response.data;
  },
};

export default auditApi;
