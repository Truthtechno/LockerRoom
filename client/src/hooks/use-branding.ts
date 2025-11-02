import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

export type SystemBranding = {
  name?: string;
  logoUrl?: string;
  faviconUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyCountry?: string;
  companyDescription?: string;
  companyLogoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialTiktok?: string;
};

const DEFAULT_PLATFORM_NAME = "LockerRoom";

/**
 * Hook to fetch and use system branding configuration
 * Provides default values when branding is not set
 */
export function useBranding() {
  const queryClient = useQueryClient();
  
  const { data: branding, isLoading, refetch } = useQuery<SystemBranding | null>({
    queryKey: ["/api/admin/system-config/branding"],
    queryFn: async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = {};
        
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch("/api/admin/system-config/branding", {
          headers,
          credentials: "include",
        });

        if (!response.ok) {
          // If endpoint fails, return null so defaults are used
          return null;
        }
        
        const data = await response.json();
        console.log("🔄 [useBranding] Fetched branding data:", JSON.stringify(data, null, 2));
        return data;
      } catch (error) {
        // Silently fail - return null so defaults are used
        console.warn("Failed to fetch branding:", error);
        return null;
      }
    },
    staleTime: 0, // Always consider stale - fetch fresh data
    gcTime: 0, // Don't cache stale data
    retry: false, // Don't retry on failure - just use defaults
    refetchOnWindowFocus: true, // Refetch when window gains focus to catch updates
    refetchOnMount: true, // Always refetch on mount
    refetchInterval: false, // Don't auto-refetch on interval
  });

  // Listen for branding update events and refetch immediately
  React.useEffect(() => {
    const handleBrandingUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const updatedBranding = customEvent.detail;
      console.log("📢 [useBranding] Branding update event received:", JSON.stringify(updatedBranding, null, 2));
      
      // Immediately update the cache with the new data
      if (updatedBranding) {
        queryClient.setQueryData<SystemBranding>(["/api/admin/system-config/branding"], updatedBranding);
      }
      
      // Force refetch to ensure we have the latest from server
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-config/branding"] });
      refetch();
    };
    
    window.addEventListener('branding-updated', handleBrandingUpdate);
    return () => {
      window.removeEventListener('branding-updated', handleBrandingUpdate);
    };
  }, [queryClient, refetch]);

  // Normalize logoUrl and faviconUrl - convert null/empty to undefined for consistent handling
  const normalizeUrl = (url: string | null | undefined): string | undefined => {
    if (!url || url === null || (typeof url === 'string' && url.trim() === "")) {
      return undefined;
    }
    return url;
  };

  return {
    branding: branding || {},
    isLoading,
    platformName: branding?.name || DEFAULT_PLATFORM_NAME,
    // Return undefined (not null) when logo is not set, so components can easily check with truthy/falsy
    logoUrl: normalizeUrl(branding?.logoUrl),
    faviconUrl: normalizeUrl(branding?.faviconUrl),
  };
}

