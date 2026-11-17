export type AccessRole = 'ADMIN' | 'PROPERTY_OWNER' | 'AUTHORIZED_DELEGATE' | 'MANAGER' | 'VIEWER';

/** Ownership is checked against the property's stored ownerId, not the JWT role alone. */
export function canManageProperty(role: AccessRole, isStoredOwner: boolean): boolean {
  return role === 'PROPERTY_OWNER' && isStoredOwner;
}

/** System administrators may issue operational device commands; delegates may not. */
export function canControlDevice(role: AccessRole, isStoredOwner: boolean): boolean {
  return role === 'ADMIN' || canManageProperty(role, isStoredOwner);
}

/** Incident resolution is reserved to system administrators and actual property owners. */
export function canResolveIncident(role: AccessRole, isStoredOwner: boolean): boolean {
  return role === 'ADMIN' || canManageProperty(role, isStoredOwner);
}
