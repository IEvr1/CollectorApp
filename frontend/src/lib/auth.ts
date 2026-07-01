const SESSION_KEY = "app-session";

export function getAccessToken(): string | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

export function setSession(accessToken: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: accessToken }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
