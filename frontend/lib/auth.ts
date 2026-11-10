import { API_URL } from "./api";
import { extractErrorMessage } from "./utils";
export { extractErrorMessage };

const TOKEN_STORAGE_KEY = "smartvote_session_token";

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "student" | string;
  is_active: boolean;
  student_number?: string | null;
  department_id?: number | null;
  department_name?: string | null;
}

export interface JwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Safely parses the payload of a JWT token on the client side
 * without verifying cryptographic signatures (signature verification is enforced by backend).
 */
export function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    // Ensure proper base64 padding to prevent DOMException in browser atob()
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Checks whether a JWT has expired using its 'exp' claim.
 * Applies a 10-second buffer to guard against clock skew.
 */
export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return nowInSeconds >= payload.exp - 10;
}

/**
 * Get active session token from sessionStorage.
 * Security Note: sessionStorage is tab-isolated and clears upon tab close,
 * reducing the attack surface compared to indefinite localStorage persistence.
 */
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const token =
      sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
      localStorage.getItem("smartvote_admin_token");

    if (!token) return null;

    // Check expiration before returning
    if (isTokenExpired(token)) {
      removeAdminToken();
      return null;
    }

    // Ensure the token has administrative privileges
    const payload = parseJwt(token);
    if (payload && payload.role && payload.role !== "admin") {
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Save active session token to sessionStorage and localStorage.
 */
export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.removeItem("smartvote_admin_token");
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Clear authentication tokens from all client storage.
 */
export function removeAdminToken(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem("smartvote_admin_token");
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Authenticate with the existing FastAPI POST /auth/login endpoint.
 * Note: Never log the returned token.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Authentication failed (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  const data: { access_token: string; token_type: string } =
    await response.json();
  const token = data.access_token;

  if (!token) {
    throw new Error("Server responded without an access token.");
  }

  // Fetch verified user profile using GET /auth/me
  const user = await fetchCurrentUser(token);

  return { token, user };
}

/**
 * Convenient wrapper for administrator login that verifies admin role.
 */
export async function loginAdminUser(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const { token, user } = await loginUser(email, password);

  if (user.role !== "admin") {
    throw new Error(
      `Access Denied: Account '${user.email}' has role '${user.role}'. Administrative privileges are required for governance operations.`
    );
  }

  return { token, user };
}

const STUDENT_TOKEN_STORAGE_KEY = "smartvote_student_token";

/**
 * Get active student session token from sessionStorage or localStorage.
 */
export function getStudentToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const token =
      sessionStorage.getItem(STUDENT_TOKEN_STORAGE_KEY) ||
      localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY);

    if (token) {
      if (isTokenExpired(token)) {
        removeStudentToken();
        return null;
      }
      return token;
    }

    // Fallback: check if the general session token contains a student role
    const sessionToken =
      sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
      localStorage.getItem(TOKEN_STORAGE_KEY);

    if (sessionToken && !isTokenExpired(sessionToken)) {
      const payload = parseJwt(sessionToken);
      if (payload && payload.role === "student") {
        setStudentToken(sessionToken);
        return sessionToken;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Save active student session token to sessionStorage and localStorage
 * so that student sessions remain accessible across tabs and page refreshes.
 */
export function setStudentToken(token: string): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(STUDENT_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(STUDENT_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Clear student session token from client storage.
 */
export function removeStudentToken(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(STUDENT_TOKEN_STORAGE_KEY);
    localStorage.removeItem(STUDENT_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Convenient wrapper for student login that verifies student role.
 * Validates credentials via POST /auth/login and ensures the user possesses the student role.
 */
export async function loginStudentUser(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const { token, user } = await loginUser(email, password);

  if (user.role !== "student") {
    throw new Error(
      `Access Denied: Account '${user.email}' has role '${user.role}'. This portal is exclusively for student voting. Administrators should sign in via the Administrator Portal.`
    );
  }

  setStudentToken(token);
  return { token, user };
}

/**
 * Register a new student account using POST /auth/register.
 * Validates institutional student ID and full name against the eligibility roster.
 */
export async function registerStudentUser(payload: {
  college_id: string;
  full_name: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      college_id: payload.college_id.trim(),
      full_name: payload.full_name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Student registration failed (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  const user: AuthUser = await response.json();
  return user;
}

/**
 * Fetch the currently authenticated user using GET /auth/me.
 * Validates the token against the backend and returns the current user profile.
 */
export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      response.status === 401
        ? "Session expired or invalid. Please sign in again."
        : `User verification failed (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  const user: AuthUser = await response.json();
  return user;
}
