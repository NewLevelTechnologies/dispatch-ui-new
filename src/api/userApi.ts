// User API Client
import apiClient from './client';

// Where a user sits in the invitation lifecycle. `ACTIVE` means the user
// has accepted; `INVITED` means an invitation email is outstanding;
// `INVITATION_EXPIRED` means the link aged out and a new one must be
// sent. The detail page surfaces a "Resend Invitation" action on the
// two non-active states.
export type InvitationStatus = 'INVITED' | 'INVITATION_EXPIRED' | 'ACTIVE';

export interface User {
  id: string;
  tenantId: string;
  cognitoSub: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  // Versioned CloudFront URL; cache-immutable. null when the user hasn't
  // uploaded a photo — UI falls back to an initials avatar. Optional so the
  // type stays compatible with older endpoints that don't include it yet.
  photoUrl?: string | null;
  enabled: boolean;
  invitationStatus?: InvitationStatus;
  roles?: Role[];
  capabilities?: string[];
  dispatchRegionIds?: string[];
  createdAt: string;
  updatedAt: string;
}

// Reference to a role that owns a given accent id. Used by `colorsInUse`
// maps on both the list and detail role responses. The form's color picker
// reads this to dim/disable swatches already claimed by other roles.
export interface AccentInUseRef {
  roleId: string;
  roleName: string;
}

// Map of accent id → owning role. Returned by both list and detail role
// endpoints. On the detail response, the role being edited is included; the
// FE filters it out client-side so the user can keep their existing color.
export type ColorsInUseMap = Record<string, AccentInUseRef>;

export interface Role {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  isProtected?: boolean;
  isSystemRole?: boolean;
  systemRoleCode?: string;
  // Persisted accent token id ("orange" | "amber" | "green" | "teal" | "blue"
  // | "indigo" | "violet" | "pink" | "red" | "slate"). Resolves to an oklch
  // value via `utils/roleColor.ts#roleAccent`. Optional because cloned roles
  // may ship with `null` until the admin picks a color on the edit page.
  accentId?: string | null;
  // Present on the detail response (`GET /users/roles/{id}`). Absent on
  // list-response role entries — fetch the list separately to get its map.
  colorsInUse?: ColorsInUseMap;
  createdAt?: string;
  updatedAt?: string;
}

// Roles list response (`GET /users/roles`) — wrapped now that the BE ships
// `totals` and `colorsInUse` alongside the roles array. Older call sites
// that only need the array call `userApi.getRoles()` which unwraps.
export interface RolesListResponse {
  roles: Role[];
  totals?: {
    totalCapabilities?: number;
    totalUsers?: number;
  };
  colorsInUse?: ColorsInUseMap;
}

export interface Capability {
  name: string;
  displayName: string;
  description: string;
}

export interface CapabilityGroup {
  featureArea: string;
  displayName: string;
  capabilities: Capability[];
}

export interface GroupedCapabilitiesResponse {
  groups: CapabilityGroup[];
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  roleIds: string[];
  dispatchRegionIds?: string[];
  phoneNumber?: string | null;
  sendInvite?: boolean;
}

export interface UpdateUserProfileRequest {
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
}

export interface UpdateUserRolesRequest {
  roleIds: string[];
}

export interface UpdateUserRegionsRequest {
  dispatchRegionIds: string[];
}

export interface UpdateUserEnabledRequest {
  enabled: boolean;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  capabilities: string[];
  accentId?: string;
}

export interface UpdateRoleRequest {
  name: string;
  description?: string;
  accentId?: string;
}

export interface UpdateRoleCapabilitiesRequest {
  capabilities: string[];
}

export interface RestoreAllDefaultsResponse {
  restoredRoles: Role[];
  recreatedRoles: Role[];
  preservedCustomRoles: Role[];
}

// Members of a role — surfaces on the role detail page Members card.
// `title` is the user's primary role name (first entry in `User.roles`)
// for now; the backend may add a dedicated job-title field later.
export interface RoleMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  photoUrl?: string | null;
}

export interface RoleMembersResponse {
  users: RoleMember[];
}

// Admin-facing 2FA status for the User Detail Security card. Mirrors the
// shape of Amplify's fetchMFAPreference (self-user) so the rendering code
// can be reused. Pulled on demand — the BE pays the Cognito call only
// when this endpoint is hit.
export interface TwoFactorStatus {
  enabled: ('TOTP' | 'SMS' | 'EMAIL')[];
  preferred: 'TOTP' | 'SMS' | 'EMAIL' | null;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  userId: string;
  changes: Record<string, string>;
  timestamp: string;
}

export const userApi = {
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/me');
    return response.data;
  },

  getAll: async (): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/users');
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  // Flat-array convenience reader for callers that only need the role list
  // (UsersPage, RoleFormPage's Start-from chips, UserFormPage). Unwraps the
  // new envelope. Use `listRoles()` instead when you also need `colorsInUse`
  // or `totals`.
  getRoles: async (): Promise<Role[]> => {
    const response = await apiClient.get<RolesListResponse | Role[]>('/users/roles');
    // BE shipped the wrapped shape, but tolerate the legacy flat array in
    // case a deployment lag puts us on an older server briefly.
    if (Array.isArray(response.data)) return response.data;
    return response.data.roles ?? [];
  },

  // Full envelope for callers that need `colorsInUse` (RoleFormPage color
  // picker in add mode) or future `totals` (RolesPage summary strip).
  listRoles: async (): Promise<RolesListResponse> => {
    const response = await apiClient.get<RolesListResponse | Role[]>('/users/roles');
    if (Array.isArray(response.data)) return { roles: response.data };
    return response.data;
  },

  getGroupedCapabilities: async (): Promise<GroupedCapabilitiesResponse> => {
    const response = await apiClient.get<GroupedCapabilitiesResponse>('/users/capabilities/grouped');
    return response.data;
  },

  create: async (request: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post<User>('/users', request);
    return response.data;
  },

  updateProfile: async (id: string, request: UpdateUserProfileRequest): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${id}`, request);
    return response.data;
  },

  // Self-service variants. /users/me derives the user from the JWT
  // server-side, so call sites don't need to thread the current user id
  // through. Returns the full updated User — swap directly into cache.
  updateMyProfile: async (request: UpdateUserProfileRequest): Promise<User> => {
    const response = await apiClient.put<User>('/users/me', request);
    return response.data;
  },

  uploadMyPhoto: async (file: File): Promise<User> => {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.post<User>('/users/me/photo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteMyPhoto: async (): Promise<User> => {
    const response = await apiClient.delete<User>('/users/me/photo');
    return response.data;
  },

  updateRoles: async (id: string, request: UpdateUserRolesRequest): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${id}/roles`, request);
    return response.data;
  },

  updateRegions: async (id: string, request: UpdateUserRegionsRequest): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${id}/dispatch-regions`, request);
    return response.data;
  },

  // Backend dropped the `enabled` field from PUT /users/{id} — sending it
  // is silently ignored now. Activation/deactivation goes through the
  // dedicated POST endpoints, which also emit the matching activity-feed
  // events (USER_ACTIVATED / USER_DEACTIVATED + cascade GLOBAL_SIGNOUT).
  // The original method names are preserved so call sites stay the same.
  enable: async (id: string): Promise<User> => {
    const response = await apiClient.post<User>(`/users/${id}/activate`);
    return response.data;
  },

  disable: async (id: string): Promise<User> => {
    const response = await apiClient.post<User>(`/users/${id}/deactivate`);
    return response.data;
  },

  // Admin Security-card actions. Each returns 204 on success.
  sendPasswordResetLink: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/reset-password`);
  },

  resetMfa: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/mfa-reset`);
  },

  get2faStatus: async (id: string): Promise<TwoFactorStatus> => {
    const response = await apiClient.get<TwoFactorStatus>(`/users/${id}/2fa/status`);
    return response.data;
  },

  signOutEverywhere: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/sign-out`);
  },

  // Returns 409 if the user is past the invitation state — caller should
  // surface that distinctly from a transient failure.
  resendInvitation: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/invitation/resend`);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },

  // Role management methods
  getRoleById: async (id: string): Promise<Role> => {
    const response = await apiClient.get<Role>(`/users/roles/${id}`);
    return response.data;
  },

  createRole: async (request: CreateRoleRequest): Promise<Role> => {
    const response = await apiClient.post<Role>('/users/roles', request);
    return response.data;
  },

  updateRole: async (id: string, request: UpdateRoleRequest): Promise<Role> => {
    const response = await apiClient.put<Role>(`/users/roles/${id}`, request);
    return response.data;
  },

  updateRoleCapabilities: async (id: string, request: UpdateRoleCapabilitiesRequest): Promise<Role> => {
    const response = await apiClient.put<Role>(`/users/roles/${id}/capabilities`, request);
    return response.data;
  },

  deleteRole: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/roles/${id}`);
  },

  cloneRole: async (id: string, request: { name: string; description?: string }): Promise<Role> => {
    const response = await apiClient.post<Role>(`/users/roles/${id}/clone`, request);
    return response.data;
  },

  restoreRoleDefaults: async (id: string): Promise<Role> => {
    const response = await apiClient.post<Role>(`/users/roles/${id}/restore-defaults`);
    return response.data;
  },

  restoreAllDefaults: async (): Promise<RestoreAllDefaultsResponse> => {
    const response = await apiClient.post<RestoreAllDefaultsResponse>('/users/roles/restore-all-defaults');
    return response.data;
  },

  // TODO: backend not built. Swap the body for
  //   const r = await apiClient.get<RoleMembersResponse>(`/users/roles/${id}/members`);
  //   return r.data;
  // once GET /users/roles/{id}/members lands. UI renders the empty state in the meantime.
  listRoleMembers: async (id: string): Promise<RoleMembersResponse> => {
    void id;
    return { users: [] };
  },

  // Audit log
  getAuditLog: async (userId: string): Promise<AuditLogEntry[]> => {
    const response = await apiClient.get<AuditLogEntry[]>(`/audit/user/${userId}`);
    return response.data;
  },
};

export default userApi;
