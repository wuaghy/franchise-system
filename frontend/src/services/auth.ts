/**
 * Authentication and Shift Management Service
 * Supports JWT authentication, refresh token storage, and POS user session
 */

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'HQ_SuperAdmin' | 'Franchise_Owner' | 'Store_Manager' | 'POS_Cashier' | 'Supply_Chain_Officer' | string;
  storeId?: string | null;
  franchiseeId?: string | null;
  isActive: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export function getTokenFromLocalStorage(): string | null {
  const raw = localStorage.getItem('token');
  return raw ? raw : null;
}

export function getCurrentUser(): User | null {
  const userJson = localStorage.getItem('user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as User;
  } catch {
    return null;
  }
}

export function saveAuthData(auth: AuthResponse): void {
  localStorage.setItem('token', auth.accessToken);
  localStorage.setItem('refreshToken', auth.refreshToken);
  localStorage.setItem('user', JSON.stringify(auth.user));
}

export function clearAuthData(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMsg = 'Đăng nhập thất bại';
    try {
      const err = await response.json();
      errorMsg = err.detail || err.title || errorMsg;
    } catch {
      errorMsg = await response.text();
    }
    throw new Error(errorMsg);
  }

  const data = (await response.json()) as AuthResponse;
  saveAuthData(data);
  return data;
}

export function logout(): void {
  clearAuthData();
  window.location.reload();
}

export async function googleLogin(idToken: string, storeId?: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, storeId }),
  });

  if (!response.ok) {
    let errorMsg = 'Đăng nhập Google thất bại';
    try {
      const err = await response.json();
      errorMsg = err.detail || err.title || errorMsg;
    } catch {
      errorMsg = await response.text();
    }
    throw new Error(errorMsg);
  }

  const data = (await response.json()) as AuthResponse;
  saveAuthData(data);
  return data;
}

export async function sendOtp(email: string): Promise<boolean> {
  const response = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    let errorMsg = 'Không thể gửi mã OTP';
    try {
      const err = await response.json();
      errorMsg = err.detail || err.title || errorMsg;
    } catch {
      errorMsg = await response.text();
    }
    throw new Error(errorMsg);
  }

  return true;
}

export async function verifyOtpLogin(email: string, otpCode: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otpCode }),
  });

  if (!response.ok) {
    let errorMsg = 'Xác thực OTP thất bại';
    try {
      const err = await response.json();
      errorMsg = err.detail || err.title || errorMsg;
    } catch {
      errorMsg = await response.text();
    }
    throw new Error(errorMsg);
  }

  const data = (await response.json()) as AuthResponse;
  saveAuthData(data);
  return data;
}

