export const VALID_ROLES = ["admin", "sales", "accountant", "lia", "copywriter"] as const;
export type RoleValue = (typeof VALID_ROLES)[number];
export const MAX_ROLES = 3;

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales: "Sales",
  lia: "LIA",
  accountant: "Accountant",
  copywriter: "Copywriter",
};

type ProfileLike = { roles?: string[] | null; role?: string | null };

/** Check if a profile has a specific role (handles backward compat with single `role` field). */
export function hasRole(profile: ProfileLike | null | undefined, role: string): boolean {
  if (!profile) return false;
  if (profile.roles && Array.isArray(profile.roles)) {
    return profile.roles.includes(role);
  }
  return profile.role === role;
}

/** Check if a profile has any of the given roles. */
export function hasAnyRole(profile: ProfileLike | null | undefined, roles: string[]): boolean {
  if (!profile) return false;
  if (profile.roles && Array.isArray(profile.roles)) {
    return profile.roles.some((r) => roles.includes(r));
  }
  return profile.role ? roles.includes(profile.role) : false;
}

/** Format roles array for display, e.g. "Admin, LIA". */
export function formatRoles(roles: string[] | null | undefined): string {
  if (!roles || roles.length === 0) return "—";
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(", ");
}
