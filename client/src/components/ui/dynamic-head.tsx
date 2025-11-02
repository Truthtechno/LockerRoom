import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";

/**
 * Component to dynamically update document title and favicon based on branding settings
 */
export function DynamicHead() {
  const { platformName, faviconUrl, isLoading } = useBranding();

  useEffect(() => {
    // Only update if branding data is loaded
    if (isLoading) return;

    try {
      // Update document title
      if (platformName) {
        document.title = platformName;
      }

      // Update or create favicon link
      // Check for multiple possible favicon link types
      let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
                       document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]');
      
      if (faviconUrl) {
        if (!faviconLink) {
          faviconLink = document.createElement('link');
          faviconLink.rel = 'icon';
          document.head.appendChild(faviconLink);
        }
        // Add timestamp to prevent caching issues
        const separator = faviconUrl.includes('?') ? '&' : '?';
        faviconLink.href = `${faviconUrl}${separator}_=${Date.now()}`;
        faviconLink.type = 'image/x-icon';
      } else {
        // CRITICAL: Remove custom favicon links when faviconUrl is cleared
        // This ensures the browser falls back to default favicon
        const allFaviconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
        allFaviconLinks.forEach(link => {
          // Remove any custom branding favicon links
          if (link.href.includes('/uploads/branding/') || link.href.includes('favicon')) {
            link.remove();
          }
        });
        
        // Optionally, set a default favicon or let browser use default
        // For now, we'll let the browser use its default
      }
    } catch (error) {
      // Silently fail - don't crash the app
      console.warn("Failed to update document head:", error);
    }
  }, [platformName, faviconUrl, isLoading]);

  return null; // This component doesn't render anything
}

