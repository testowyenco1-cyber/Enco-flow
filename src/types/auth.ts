import { UserRoleId } from './userRole';

export type AuthDepartmentId = Exclude<UserRoleId, 'admin' | 'ogolny'>;

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  departments: AuthDepartmentId[];
  isAdmin: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthBootstrapStatus {
  needsSetup: boolean;
}

export const AUTH_DEPARTMENTS: Array<{ id: AuthDepartmentId; label: string; description: string }> = [
  { id: 'dzial_handlowy', label: 'Dział Handlowy', description: 'Zlecenia, dane handlowe i pełna edycja operacyjna.' },
  { id: 'logistyka', label: 'Logistyka', description: 'Rozdzielnice, drzwi, dostawy i transport.' },
  { id: 'pyskowice', label: 'Produkcja – Pyskowice', description: 'Obudowa, wyposażenie, montaż i elementy produkcyjne.' },
  { id: 'plochocinska', label: 'Produkcja – Płochocińska', description: 'Rozdzielnice NN i przypisane elementy produkcyjne.' },
];
