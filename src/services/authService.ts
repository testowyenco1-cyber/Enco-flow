import { AuthBootstrapStatus, AuthDepartmentId, AuthUser } from '../types/auth';

export class AuthApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new AuthApiError('Nie można połączyć się z serwerem ENCO Flow.', 0);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthApiError(
      typeof body?.error === 'string' ? body.error : 'Wystąpił błąd komunikacji z serwerem.',
      response.status
    );
  }
  return body as T;
}

export async function getBootstrapStatus(): Promise<AuthBootstrapStatus> {
  return request<AuthBootstrapStatus>('/api/auth/bootstrap-status');
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const result = await request<{ user: AuthUser }>('/api/auth/me');
    return result.user;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return null;
    throw error;
  }
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return result.user;
}

export async function bootstrapAdmin(username: string, displayName: string, password: string): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>('/api/auth/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ username, displayName, password }),
  });
  return result.user;
}

export async function logout(): Promise<void> {
  await request<{ success: boolean }>('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
}

export async function getAdminUsers(): Promise<AuthUser[]> {
  const result = await request<{ users: AuthUser[] }>('/api/admin/users');
  return result.users;
}

export async function createAdminUser(input: {
  username: string;
  displayName: string;
  password: string;
  departments: AuthDepartmentId[];
  isAdmin: boolean;
}): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.user;
}

export async function updateAdminUser(
  userId: string,
  updates: { displayName: string; departments: AuthDepartmentId[]; isAdmin: boolean; active: boolean }
): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return result.user;
}

export async function resetAdminUserPassword(userId: string, password: string): Promise<void> {
  await request<{ success: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}
