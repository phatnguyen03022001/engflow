// @lifecycle ACTIVE — Auth helpers

import { api } from './axios';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  accessToken: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<{ data: AuthResponse }>('/auth/login', { email, password });
  const { accessToken, user } = res.data.data;
  localStorage.setItem('floweng_token', accessToken);
  localStorage.setItem('floweng_user', JSON.stringify(user));
  return res.data.data;
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await api.post<{ data: AuthResponse }>('/auth/register', {
    email,
    password,
    name,
  });
  const { accessToken, user } = res.data.data;
  localStorage.setItem('floweng_token', accessToken);
  localStorage.setItem('floweng_user', JSON.stringify(user));
  return res.data.data;
}

export function logout() {
  localStorage.removeItem('floweng_token');
  localStorage.removeItem('floweng_user');
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('floweng_token');
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
