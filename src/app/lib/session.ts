/* Admin session + login-attempt throttling (sessionStorage-backed) */
export const ADMIN_USER = "freed";
export const ADMIN_PASS = "pierre2026";
export const SESSION_KEY = "fp_admin_session";
export const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4h de sessão administrativa (renovada com o uso)
export function checkSession(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const exp = Number(raw);
    if (!Number.isFinite(exp) || Date.now() > exp) { sessionStorage.removeItem(SESSION_KEY); return false; }
    return true;
  } catch { return false; }
}
export function startSession() { try { sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS)); } catch {} }
export function renewSession() { try { if (checkSession()) sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_TTL_MS)); } catch {} }
export function endSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch {} }
export const LOGIN_FAIL_KEY = "fp_admin_login_fails";
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MS = 60 * 1000;

export function getLoginFailState(): { count: number; lockUntil: number } {
  try {
    const raw = sessionStorage.getItem(LOGIN_FAIL_KEY);
    if (!raw) return { count: 0, lockUntil: 0 };
    const parsed = JSON.parse(raw);
    return { count: Number(parsed.count) || 0, lockUntil: Number(parsed.lockUntil) || 0 };
  } catch { return { count: 0, lockUntil: 0 }; }
}
export function setLoginFailState(s: { count: number; lockUntil: number }) {
  try { sessionStorage.setItem(LOGIN_FAIL_KEY, JSON.stringify(s)); } catch {}
}
export function clearLoginFailState() { try { sessionStorage.removeItem(LOGIN_FAIL_KEY); } catch {} }
