'use client';

import Cookies from 'js-cookie';
import { AuthUser } from './types';

const ACCESS_TOKEN_KEY = 'autoprime_access_token';
const REFRESH_TOKEN_KEY = 'autoprime_refresh_token';
const USER_KEY = 'autoprime_user';

export function saveSession(accessToken: string, refreshToken: string, user: AuthUser) {
  Cookies.set(ACCESS_TOKEN_KEY, accessToken, { expires: 1, sameSite: 'lax' });
  Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 7, sameSite: 'lax' });
  Cookies.set(USER_KEY, JSON.stringify(user), { expires: 7, sameSite: 'lax' });
}

export function clearSession() {
  Cookies.remove(ACCESS_TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
  Cookies.remove(USER_KEY);
}

export function getAccessToken(): string | undefined {
  return Cookies.get(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  const raw = Cookies.get(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  EMPLOYEE: 'Funcionário',
  WASHER: 'Lavador',
  DETAILER: 'Detalhador',
  FINANCE: 'Financeiro',
  CLIENT: 'Cliente',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
