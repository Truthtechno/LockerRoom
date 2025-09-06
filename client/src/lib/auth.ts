export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId?: string | null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Login failed");
  }

  const { user } = await response.json();
  
  // Store user in localStorage for demo purposes
  localStorage.setItem("auth_user", JSON.stringify(user));
  
  return user;
}

export async function register(userData: {
  name: string;
  email: string;
  password: string;
  role: string;
  schoolId?: string;
}): Promise<AuthUser> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Registration failed");
  }

  const { user } = await response.json();
  
  // Store user in localStorage for demo purposes
  localStorage.setItem("auth_user", JSON.stringify(user));
  
  return user;
}

export function logout(): void {
  localStorage.removeItem("auth_user");
}

export function getCurrentUser(): AuthUser | null {
  const stored = localStorage.getItem("auth_user");
  return stored ? JSON.parse(stored) : null;
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function hasRole(requiredRole: string): boolean {
  const user = getCurrentUser();
  return user?.role === requiredRole;
}

export function hasAnyRole(roles: string[]): boolean {
  const user = getCurrentUser();
  return user ? roles.includes(user.role) : false;
}
