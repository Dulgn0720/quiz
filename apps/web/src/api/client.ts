import type { ApiErrorBody, ImportIssue } from '@quiz/shared';
import { authToken } from '@/auth/token';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: ImportIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request never reached the server. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export function apiUrl(path: string): string {
  return `${API_URL}/api${path}`;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = authToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new ApiError(0, 'Network error');
  }
  if (!response.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await response.json()) as Partial<ApiErrorBody>;
    } catch {
      // Non-JSON error body.
    }
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(response.status, message ?? response.statusText, body.issues ?? []);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
