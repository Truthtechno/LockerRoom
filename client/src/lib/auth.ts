import { queryClient } from "./queryClient";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId?: string | null;
  profilePicUrl?: string | null;
  requiresPasswordReset?: boolean;
  is_one_time_password?: boolean; // Added for OTP users
}

export interface LoginResult {
  user: AuthUser;
  requiresPasswordReset?: boolean;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.message || "Login failed");
  }

  const { token, user, profile, requiresPasswordReset } = await response.json();
  
  // Merge user with profile data to include profilePicUrl and schoolId
  const userWithProfile = {
    ...user,
    profilePicUrl: profile?.profilePicUrl || null,
    schoolId: profile?.schoolId || user.schoolId || null
  };
  
  // CRITICAL: Clear React Query cache before storing new user data
  // This prevents stale data from previous user sessions
  try {
    queryClient.clear();
  } catch (error) {
    console.warn("Failed to clear React Query cache on login:", error);
  }
  
  // Store token, user, and schoolId in localStorage
  localStorage.setItem("token", token);
  localStorage.setItem("auth_user", JSON.stringify(userWithProfile));
  localStorage.setItem("auth_user_timestamp", Date.now().toString());
  
  // Store schoolId separately for easy access
  if (userWithProfile.schoolId) {
    localStorage.setItem("schoolId", userWithProfile.schoolId);
  }
  
  // Trigger custom event to notify auth state change
  window.dispatchEvent(new Event('auth-change'));
  
  return {
    user: userWithProfile,
    requiresPasswordReset: requiresPasswordReset || false
  };
}

export async function register(userData: {
  name: string;
  email: string;
  password: string;
  role: string;
  schoolId?: string;
}): Promise<AuthUser> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.message || "Registration failed");
  }

  const { token, user, profile } = await response.json();
  
  // Merge user with profile data to include profilePicUrl and schoolId
  const userWithProfile = {
    ...user,
    profilePicUrl: profile?.profilePicUrl || null,
    schoolId: profile?.schoolId || user.schoolId || null
  };
  
  // CRITICAL: Clear React Query cache before storing new user data
  // This prevents stale data from previous user sessions
  try {
    queryClient.clear();
  } catch (error) {
    console.warn("Failed to clear React Query cache on register:", error);
  }
  
  // Store token, user, and schoolId in localStorage
  localStorage.setItem("token", token);
  localStorage.setItem("auth_user", JSON.stringify(userWithProfile));
  localStorage.setItem("auth_user_timestamp", Date.now().toString());
  
  // Store schoolId separately for easy access
  if (userWithProfile.schoolId) {
    localStorage.setItem("schoolId", userWithProfile.schoolId);
  }
  
  // Trigger custom event to notify auth state change
  window.dispatchEvent(new Event('auth-change'));
  
  return userWithProfile;
}

export function logout(): void {
  // CRITICAL: Clear React Query cache FIRST to prevent stale data
  // This ensures all cached user data, posts, profiles, etc. are cleared
  try {
    queryClient.clear();
  } catch (error) {
    console.warn("Failed to clear React Query cache:", error);
  }
  
  // Clear ALL auth-related data from localStorage
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('auth') || key === 'token' || key === 'schoolId' || key === 'auth_user')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  localStorage.removeItem("auth_user_timestamp");
  
  // Clear ALL data from sessionStorage
  sessionStorage.clear();
  
  // Also manually clear the specific keys as backup
  localStorage.removeItem("auth_user");
  localStorage.removeItem("token");
  localStorage.removeItem("schoolId");
  
  // Clear any cookies related to auth
  document.cookie.split(";").forEach((c) => {
    const eqPos = c.indexOf("=");
    const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  });
  
  // Trigger custom event to notify auth state change
  window.dispatchEvent(new Event('auth-change'));
  
  // Force hard page reload to clear all React state and cache
  // Using window.location.href instead of replace to bypass cache
  const timestamp = Date.now();
  window.location.href = '/login?_=' + timestamp + '&nocache=' + timestamp;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = localStorage.getItem("token");
  if (!token) {
    // If no token, make sure auth_user is also cleared
    localStorage.removeItem("auth_user");
    localStorage.removeItem("schoolId");
    return null;
  }

  // First, try to get cached user data for immediate response
  const cachedUserStr = localStorage.getItem("auth_user");
  let cachedUser: AuthUser | null = null;
  if (cachedUserStr) {
    try {
      cachedUser = JSON.parse(cachedUserStr);
    } catch (e) {
      console.warn("Failed to parse cached user data");
    }
  }

  // Check if we have a recent cache (less than 5 minutes old)
  const cacheTimestamp = parseInt(localStorage.getItem("auth_user_timestamp") || "0");
  const now = Date.now();
  const cacheAge = now - cacheTimestamp;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // If cache is still fresh, return cached data immediately
  // Don't fetch in background to prevent loops and excessive API calls
  if (cachedUser && cacheAge < CACHE_TTL) {
    return cachedUser;
  }

  // Cache is stale or doesn't exist, fetch fresh data
  try {
    const response = await fetch(`/api/users/me?t=${Date.now()}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store"
    });

    if (response.ok) {
      const userData = await response.json();
      // Update localStorage with fresh data
      localStorage.setItem("auth_user", JSON.stringify(userData));
      localStorage.setItem("auth_user_timestamp", Date.now().toString());
      if (userData.schoolId) {
        localStorage.setItem("schoolId", userData.schoolId);
      }
      // Return fresh data
      return userData;
    } else if (response.status === 401) {
      // Token is invalid, clear everything
      console.warn("Token is invalid, clearing auth data");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("token");
      localStorage.removeItem("schoolId");
      sessionStorage.clear();
      // Return null - no authenticated user
      return null;
    } else if (response.status === 403) {
      // Check if account is deactivated
      try {
        const errorData = await response.json();
        if (errorData.error?.code === 'account_deactivated') {
          console.warn("Account deactivated, clearing auth data");
          localStorage.removeItem("auth_user");
          localStorage.removeItem("token");
          localStorage.removeItem("schoolId");
          sessionStorage.clear();
          // Redirect to login with error message
          window.location.href = `/login?error=${encodeURIComponent(errorData.error.message || 'Account deactivated')}`;
          return null;
        }
      } catch {
        // If JSON parsing fails, treat as generic 403
      }
      // For other 403 errors, clear auth and redirect
      localStorage.removeItem("auth_user");
      localStorage.removeItem("token");
      localStorage.removeItem("schoolId");
      sessionStorage.clear();
      return null;
    } else {
      // For other errors, use cached data if available
      console.warn("Failed to fetch current user from API, using cached data");
      return cachedUser;
    }
  } catch (error) {
    console.warn("Failed to fetch current user from API, using cached data:", error);
    // Use cached data on error for better UX
    return cachedUser;
  }
}

export function isAuthenticated(): boolean {
  const token = localStorage.getItem("token");
  return !!token;
}

export function hasRole(requiredRole: string): boolean {
  const stored = localStorage.getItem("auth_user");
  if (!stored) return false;
  const user = JSON.parse(stored);
  return user?.role === requiredRole;
}

export function hasAnyRole(roles: string[]): boolean {
  const stored = localStorage.getItem("auth_user");
  if (!stored) return false;
  const user = JSON.parse(stored);
  return user ? roles.includes(user.role) : false;
}
