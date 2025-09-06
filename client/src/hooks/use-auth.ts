import { useState, useEffect } from "react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
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
