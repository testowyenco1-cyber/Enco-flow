import { StandardItemType } from './enco';

export type UserRoleId =
  | 'admin'
  | 'dzial_handlowy'
  | 'logistyka'
  | 'pyskowice'
  | 'plochocinska'
  | 'ogolny';

export interface UserRoleProfile {
  id: UserRoleId;
  name: string;
  department: string;
  shortName: string;
  avatar: string;
  badgeBg: string;
  badgeText: string;
  borderCol: string;
  description: string;
  editScopeSummary: string;
  canEditAll: boolean;
  canCreateOrders: boolean;
  canDeleteOrders: boolean;
  canEditOrderMetadata: boolean;
  canManageDoors: boolean; // Drzwi: dodawanie, edycja, usuwanie, potwierdzanie
  canDownload: boolean; // Pobieranie plików i PDF
  allowedItemTypes: StandardItemType[]; // Elementy stacji dozwolone do edycji
  canEditDepartureDate: boolean;
  canEditGeneralNotes: boolean;
  canEditAdditionalInfo: boolean;
  canResetDemo: boolean;
  hasPassword: boolean;
}

export const USER_PROFILES: Record<UserRoleId, UserRoleProfile> = {
  admin: {
    id: 'admin',
    name: 'Admin',
    department: 'Zarząd i Administracja Systemem',
    shortName: 'Admin',
    avatar: '👑',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-purple-100',
    borderCol: 'border-purple-400',
    description: 'Pełny dostęp do wszystkich modułów, edycja danych, tworzenie i usuwanie zleceń, eksport/pobieranie.',
    editScopeSummary: 'Dostęp do wszystkiego (edycja, tworzenie, usuwanie, podgląd, pobieranie)',
    canEditAll: true,
    canCreateOrders: true,
    canDeleteOrders: true,
    canEditOrderMetadata: true,
    canManageDoors: true,
    canDownload: true,
    allowedItemTypes: [
      'OBUDOWA',
      'ROZDZIELNICA_SN',
      'ROZDZIELNICA_NN',
      'MOST',
      'RYS_AKCEPTACJA',
      'KOLORY',
      'OPISY',
      'DRZWI',
      'ZAP_SERWISPOL',
      'ZAM_SERWISPOL',
      'ZAP_JK',
      'ZAM_JK',
      'ZLECENIE_MONTAZU',
      'SZAFKA_TELEMECHANIKI',
      'TABLICA_POMIAROWA',
      'RPW',
      'TRANSFORMATOR_POTRZEB_WLASNYCH',
      'WSKAZNIKI_ZWARC',
      'POWYKONAWCZA',
      'DATA_WYJAZDU',
      'DODATKOWE',
    ],
    canEditDepartureDate: true,
    canEditGeneralNotes: true,
    canEditAdditionalInfo: true,
    canResetDemo: true,
    hasPassword: true,
  },
  dzial_handlowy: {
    id: 'dzial_handlowy',
    name: 'Dział Handlowy',
    department: 'Sprzedaż i Realizacja Zleceń',
    shortName: 'Dział Handlowy',
    avatar: '💼',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-blue-100',
    borderCol: 'border-blue-400',
    description: 'Dostęp do wszystkiego: pełna edycja danych, tworzenie zleceń, modyfikacje parametrów, podgląd i pobieranie.',
    editScopeSummary: 'Dostęp do wszystkiego (edycja danych, tworzenie, podgląd i pobieranie)',
    canEditAll: true,
    canCreateOrders: true,
    canDeleteOrders: true,
    canEditOrderMetadata: true,
    canManageDoors: true,
    canDownload: true,
    allowedItemTypes: [
      'OBUDOWA',
      'ROZDZIELNICA_SN',
      'ROZDZIELNICA_NN',
      'MOST',
      'RYS_AKCEPTACJA',
      'KOLORY',
      'OPISY',
      'DRZWI',
      'ZAP_SERWISPOL',
      'ZAM_SERWISPOL',
      'ZAP_JK',
      'ZAM_JK',
      'ZLECENIE_MONTAZU',
      'SZAFKA_TELEMECHANIKI',
      'TABLICA_POMIAROWA',
      'RPW',
      'TRANSFORMATOR_POTRZEB_WLASNYCH',
      'WSKAZNIKI_ZWARC',
      'POWYKONAWCZA',
      'DATA_WYJAZDU',
      'DODATKOWE',
    ],
    canEditDepartureDate: true,
    canEditGeneralNotes: true,
    canEditAdditionalInfo: true,
    canResetDemo: false,
    hasPassword: true,
  },
  logistyka: {
    id: 'logistyka',
    name: 'Logistyka',
    department: 'Zaopatrzenie, Transport i Magazyn',
    shortName: 'Logistyka',
    avatar: '🚚',
    badgeBg: 'bg-amber-600',
    badgeText: 'text-amber-100',
    borderCol: 'border-amber-400',
    description: 'Edycja: drzwi, most, SN i NN, telemechanika, wyjazd i dodatkowe. Pozostałe elementy tylko podgląd.',
    editScopeSummary: 'Drzwi, Most, SN i NN, Telemechanika, Wyjazd, Dodatkowe (edycja); reszta podgląd',
    canEditAll: false,
    canCreateOrders: false,
    canDeleteOrders: false,
    canEditOrderMetadata: false,
    canManageDoors: true, // Pełne zarządzanie modułem drzwi
    canDownload: true,
    allowedItemTypes: [
      'DRZWI',
      'MOST',
      'ROZDZIELNICA_SN',
      'ROZDZIELNICA_NN',
      'SZAFKA_TELEMECHANIKI',
      'TABLICA_POMIAROWA',
      'RPW',
      'TRANSFORMATOR_POTRZEB_WLASNYCH',
      'WSKAZNIKI_ZWARC',
      'DATA_WYJAZDU',
      'DODATKOWE',
    ],
    canEditDepartureDate: true,
    canEditGeneralNotes: false,
    canEditAdditionalInfo: true,
    canResetDemo: false,
    hasPassword: true,
  },
  plochocinska: {
    id: 'plochocinska',
    name: 'Produkcja - Płochocińska',
    department: 'Wydział Aparaturowy Warszawa-Płochocińska',
    shortName: 'Płochocińska',
    avatar: '⚡',
    badgeBg: 'bg-cyan-700',
    badgeText: 'text-cyan-100',
    borderCol: 'border-cyan-400',
    description: 'Edycja: NN, telemechanika, dodatkowe. Pozostałe elementy tylko podgląd.',
    editScopeSummary: 'NN, Telemechanika, Dodatkowe (edycja); reszta podgląd',
    canEditAll: false,
    canCreateOrders: false,
    canDeleteOrders: false,
    canEditOrderMetadata: false,
    canManageDoors: false,
    canDownload: true,
    allowedItemTypes: [
      'ROZDZIELNICA_NN',
      'SZAFKA_TELEMECHANIKI',
      'TABLICA_POMIAROWA',
      'RPW',
      'TRANSFORMATOR_POTRZEB_WLASNYCH',
      'WSKAZNIKI_ZWARC',
      'DODATKOWE',
    ],
    canEditDepartureDate: false,
    canEditGeneralNotes: false,
    canEditAdditionalInfo: true,
    canResetDemo: false,
    hasPassword: true,
  },
  pyskowice: {
    id: 'pyskowice',
    name: 'Produkcja - Pyskowice',
    department: 'Zakład Produkcyjny Pyskowice',
    shortName: 'Pyskowice',
    avatar: '🏭',
    badgeBg: 'bg-emerald-700',
    badgeText: 'text-emerald-100',
    borderCol: 'border-emerald-400',
    description: 'Edycja: obudowa, montaż, wyjazd, kolory, opisy. Pozostałe elementy tylko podgląd.',
    editScopeSummary: 'Obudowa, Montaż, Wyjazd, Kolory, Opisy (edycja); reszta podgląd',
    canEditAll: false,
    canCreateOrders: false,
    canDeleteOrders: false,
    canEditOrderMetadata: false,
    canManageDoors: false,
    canDownload: true,
    allowedItemTypes: [
      'OBUDOWA',
      'ROZDZIELNICA_SN',
      'ROZDZIELNICA_NN',
      'MOST',
      'ZLECENIE_MONTAZU',
      'SZAFKA_TELEMECHANIKI',
      'TABLICA_POMIAROWA',
      'RPW',
      'TRANSFORMATOR_POTRZEB_WLASNYCH',
      'WSKAZNIKI_ZWARC',
      'POWYKONAWCZA',
      'DATA_WYJAZDU',
      'KOLORY',
      'OPISY',
    ],
    canEditDepartureDate: true,
    canEditGeneralNotes: true, // Opisy i uwagi
    canEditAdditionalInfo: false,
    canResetDemo: false,
    hasPassword: true,
  },
  ogolny: {
    id: 'ogolny',
    name: 'Ogólny',
    department: 'Podgląd Ogólny / Gość',
    shortName: 'Ogólny',
    avatar: '👁️',
    badgeBg: 'bg-slate-600',
    badgeText: 'text-slate-100',
    borderCol: 'border-slate-400',
    description: 'Tylko podgląd: brak możliwości edycji danych i brak możliwości pobierania plików.',
    editScopeSummary: 'Tylko podgląd (brak edycji i pobierania)',
    canEditAll: false,
    canCreateOrders: false,
    canDeleteOrders: false,
    canEditOrderMetadata: false,
    canManageDoors: false,
    canDownload: false,
    allowedItemTypes: [],
    canEditDepartureDate: false,
    canEditGeneralNotes: false,
    canEditAdditionalInfo: false,
    canResetDemo: false,
    hasPassword: false,
  },
};

export const USER_PROFILES_LIST: UserRoleProfile[] = Object.values(USER_PROFILES);

/**
 * Informacja opisowa dla starszych komponentów. Uwierzytelnianie jest
 * obsługiwane wyłącznie przez API serwera — hasła nie są przechowywane w kodzie klienta.
 */
export function hasPasswordProtection(roleId: UserRoleId): boolean {
  return roleId !== 'ogolny';
}

/** Zgodność ze starszym modalem; logowanie klientowe jest celowo wyłączone. */
export function verifyUserPassword(_roleId: UserRoleId, _passwordAttempt: string): boolean {
  return false;
}

/**
 * Sprawdza, czy dany profil ma uprawnienie do edycji określonego typu elementu
 */
export function canEditItemType(profile: UserRoleProfile, itemType: string): boolean {
  if (profile.canEditAll) return true;
  return profile.allowedItemTypes.includes(itemType as StandardItemType);
}

/**
 * Zwraca czytelne wyjaśnienie uprawnień dla danego profilu i elementu
 */
export function getItemPermissionHint(profile: UserRoleProfile, itemType: string, itemName: string): {
  canEdit: boolean;
  reason: string;
} {
  const canEdit = canEditItemType(profile, itemType);
  if (canEdit) {
    return {
      canEdit: true,
      reason: `Profil „${profile.name}” ma pełne uprawnienia do edycji elementu: ${itemName}.`,
    };
  }

  if (profile.id === 'ogolny') {
    return {
      canEdit: false,
      reason: 'Profil „Ogólny” ma wyłącznie uprawnienia do podglądu (brak edycji i pobierania).',
    };
  }

  return {
    canEdit: false,
    reason: `Profil „${profile.name}” nie posiada uprawnień do edycji tego elementu (tylko podgląd). Dozwolone do edycji: ${profile.editScopeSummary}.`,
  };
}
