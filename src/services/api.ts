import type { AccountUser, LinkPreviewData, PlayerSaveData } from '../game/types';

const TOKEN_KEY = 'nightfall_auth_token_v1';
const LOCAL_SAVE_KEY = 'nightfall_local_save_v1';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage quota errors
  }
}

export function loadLocalSave(): PlayerSaveData | null {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerSaveData;
  } catch {
    return null;
  }
}

export function writeLocalSave(save: PlayerSaveData): void {
  try {
    localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(save));
  } catch {
    // ignore storage errors
  }
}

async function jsonFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function registerAccount(
  email: string,
  password: string,
  progress: PlayerSaveData
): Promise<{
  token: string;
  user: AccountUser;
  verificationDispatch: { channel: string; expiresInMinutes: number; verificationCodePreview?: string };
}> {
  return jsonFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, progress }),
  });
}

export async function verifyEmailCode(token: string, code: string): Promise<{ user: AccountUser }> {
  return jsonFetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
}

export async function resendVerificationCode(token: string): Promise<{
  verificationDispatch: { channel: string; expiresInMinutes: number; verificationCodePreview?: string };
}> {
  return jsonFetch('/api/auth/resend-code', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function loginAccount(
  email: string,
  password: string
): Promise<{ token: string; user: AccountUser; progress: PlayerSaveData | null }> {
  return jsonFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logoutAccount(token: string): Promise<void> {
  await jsonFetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchCurrentAccount(
  token: string
): Promise<{ user: AccountUser; progress: PlayerSaveData | null }> {
  return jsonFetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function changeAccountPassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean }> {
  return jsonFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function saveCloudProgress(token: string, progress: PlayerSaveData): Promise<void> {
  await jsonFetch('/api/progress', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ progress }),
  });
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const res = await jsonFetch<{ preview: LinkPreviewData }>('/api/link-preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  return res.preview;
}
