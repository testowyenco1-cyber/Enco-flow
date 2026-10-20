import { AuthUser } from '../types/auth';
import { USER_PROFILES, UserRoleProfile } from '../types/userRole';

export function profileForAuthUser(user: AuthUser): UserRoleProfile {
  if (user.isAdmin) {
    return {
      ...USER_PROFILES.admin,
      name: user.displayName,
      shortName: 'Administrator',
      department: 'Administracja systemem',
      avatar: '👑',
      description: 'Indywidualne konto administratora ENCO Flow.',
      editScopeSummary: 'Pełny dostęp do aplikacji i zarządzania kontami.',
      canResetDemo: true,
      hasPassword: true,
    };
  }

  const departmentProfiles = user.departments
    .filter((id) => id in USER_PROFILES)
    .map((id) => USER_PROFILES[id]);

  if (departmentProfiles.length === 0) {
    return {
      ...USER_PROFILES.ogolny,
      name: user.displayName,
      shortName: 'Bez uprawnień',
      department: 'Brak przypisanych działów',
      avatar: '👤',
      description: 'Konto może przeglądać dane, ale nie ma uprawnień do edycji.',
      editScopeSummary: 'Tylko podgląd — administrator nie przypisał jeszcze żadnego działu.',
      hasPassword: true,
    };
  }

  const names = departmentProfiles.map((profile) => profile.name);
  const canEditAll = departmentProfiles.some((profile) => profile.canEditAll);
  const all = (key: keyof UserRoleProfile) => departmentProfiles.some((profile) => Boolean(profile[key]));

  return {
    ...departmentProfiles[0],
    name: user.displayName,
    shortName: departmentProfiles.map((profile) => profile.shortName).join(' / '),
    department: departmentProfiles.map((profile) => profile.department).join(' · '),
    avatar: departmentProfiles.length === 1 ? departmentProfiles[0].avatar : '👤',
    description: `Konto indywidualne z uprawnieniami działów: ${names.join(', ')}.`,
    editScopeSummary: canEditAll
      ? `Pełna edycja — przydzielono: ${names.join(', ')}.`
      : `Uprawnienia łączone dla działów: ${names.join(', ')}.`,
    canEditAll,
    canCreateOrders: all('canCreateOrders'),
    canDeleteOrders: all('canDeleteOrders'),
    canEditOrderMetadata: all('canEditOrderMetadata'),
    canManageDoors: all('canManageDoors'),
    canDownload: all('canDownload'),
    allowedItemTypes: [...new Set(departmentProfiles.flatMap((profile) => profile.allowedItemTypes))],
    canEditDepartureDate: all('canEditDepartureDate'),
    canEditGeneralNotes: all('canEditGeneralNotes'),
    canEditAdditionalInfo: all('canEditAdditionalInfo'),
    canResetDemo: false,
    hasPassword: true,
  };
}
