/** The signed-in user's API token, kept in localStorage. */
const KEY = 'quiz-pro:token';

export function authToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the session lasts until the tab closes.
  }
}
