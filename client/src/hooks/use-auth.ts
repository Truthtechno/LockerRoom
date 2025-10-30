import { useState, useEffect } from "react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

export function useAuth() {
  // Initialize with cached user data for immediate rendering
  const cachedUserStr = localStorage.getItem("auth_user");
  const cacheTimestamp = parseInt(localStorage.getItem("auth_user_timestamp") || "0");
  const now = Date.now();
  const cacheAge = now - cacheTimestamp;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  let initialUser: AuthUser | null = null;
  if (cachedUserStr) {
    try {
      initialUser = JSON.parse(cachedUserStr);
    } catch {
      initialUser = null;
    }
  }

  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser); // Only loading if no cached data

  useEffect(() => {
    // If we have fresh cached data, skip the initial fetch to prevent loops
    const hasFreshCache = initialUser && cacheAge < CACHE_TTL;
    
    const fetchUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        // If we get null from API and had a token, redirect to login
        if (!currentUser && localStorage.getItem("token")) {
          // Clear invalid auth (already cleared by getCurrentUser)
          // Redirect to login will happen via ProtectedRoute
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
        // On error, keep cached data if available
        const token = localStorage.getItem("token");
        if (!token) {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if cache is stale or missing
    if (!hasFreshCache) {
      fetchUser();
    } else {
      // We have fresh cache, just set loading to false
      setIsLoading(false);
    }

    // Listen for storage changes to update auth state when token changes
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'auth_user') {
        await fetchUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom storage events from the same tab
    const handleCustomStorageChange = async () => {
      await fetchUser();
    };

    // Listen for 'auth-change' custom events triggered by login/logout
    window.addEventListener('auth-change', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleCustomStorageChange);
    };
  }, []);

  const updateUser = (newUser: AuthUser | null) => {
    setUser(newUser);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    updateUser,
  };
}
