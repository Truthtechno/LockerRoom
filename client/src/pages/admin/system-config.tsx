import { useState, useRef, useEffect } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { uploadBrandingAsset } from "@/lib/cloudinary";
import { Settings, Palette, CreditCard, Upload, Image as ImageIcon, Phone, Mail, Globe, MapPin, Link2, X, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

type SystemBranding = {
  name?: string;
  logoUrl?: string;
  faviconUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyCountry?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialLinkedin?: string;
};

type SystemAppearance = {
  themeMode?: string;
  lightModePrimaryColor?: string;
  lightModeSecondaryColor?: string;
  lightModeAccentColor?: string;
  lightModeBackground?: string;
  lightModeForeground?: string;
  lightModeMuted?: string;
  lightModeBorder?: string;
  darkModePrimaryColor?: string;
  darkModeSecondaryColor?: string;
  darkModeAccentColor?: string;
  darkModeBackground?: string;
  darkModeForeground?: string;
  darkModeMuted?: string;
  darkModeBorder?: string;
  fontFamily?: string;
  fontSizeBase?: string;
};

type SystemPayment = {
  mockModeEnabled?: boolean;
  provider?: string;
  stripePublishableKey?: string;
  stripeSecretKeyEncrypted?: string;
  stripeWebhookSecretEncrypted?: string;
  paypalClientId?: string;
  paypalClientSecretEncrypted?: string;
  paypalMode?: string;
  currency?: string;
  xenScoutPriceCents?: number;
  enableSubscriptions?: boolean;
  subscriptionMonthlyPriceCents?: number;
  subscriptionYearlyPriceCents?: number;
};

export default function SystemConfig() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("branding");
  const [previewColors, setPreviewColors] = useState<any>({});
  
  // File upload refs and state
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  
  // Local form state for branding - separate from query cache
  const [brandingFormData, setBrandingFormData] = useState<SystemBranding>({});
  const [hasBrandingChanges, setHasBrandingChanges] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  // Track if form has been initialized
  const formInitializedRef = React.useRef(false);
  const justSavedRef = React.useRef(false);

  // Fetch branding configuration
  const { data: branding, isLoading: brandingLoading, refetch: refetchBranding } = useQuery<SystemBranding>({
    queryKey: ["/api/admin/system-config/branding"],
    queryFn: async () => {
      console.log("📖 [QUERY] Fetching branding from server...");
      try {
        const response = await apiRequest("GET", "/api/admin/system-config/branding");
        const data = await response.json();
        console.log("✅ [QUERY] Fetched branding data from server:", JSON.stringify(data, null, 2));
        const fetchedData = data || {};
        
        // Only initialize form data on first load, not on refetch
        // Form data should only be updated via useEffect when not just saved
        if (!formInitializedRef.current) {
          console.log("🔄 [QUERY] Initializing form data on first load");
          setBrandingFormData(fetchedData);
          setHasBrandingChanges(false);
          formInitializedRef.current = true;
        }
        
        return fetchedData;
      } catch (error) {
        console.error("❌ [QUERY] Failed to fetch branding:", error);
        return {};
      }
    },
    staleTime: 0, // Always consider stale to force fresh fetches
    gcTime: 0, // Don't cache old data
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
  
  // Track the last saved logoUrl to prevent restoring it if it was intentionally cleared
  const lastClearedLogoUrlRef = React.useRef<string | undefined>(undefined);
  
  // Update form data when branding changes (but only if user hasn't made changes and we just saved)
  React.useEffect(() => {
    // CRITICAL: Skip if we just saved - NEVER override form state after save
    if (justSavedRef.current) {
      console.log("⏭️ [EFFECT] Skipping update - just saved, preserving form state");
      return;
    }
    
    // Skip if user has unsaved changes
    if (hasBrandingChanges) {
      console.log("⏭️ [EFFECT] Skipping update - user has unsaved changes");
      return;
    }
    
    // Update form data from fetched branding only if form is initialized
    if (branding !== undefined && formInitializedRef.current) {
      console.log("🔄 [EFFECT] Updating form data from fetched branding:", JSON.stringify(branding, null, 2));
      
      // Normalize null values to undefined for consistency
      const normalizedBranding: SystemBranding = {
        ...branding,
        logoUrl: normalizeUrl(branding.logoUrl), // Use normalizeUrl function
        faviconUrl: normalizeUrl(branding.faviconUrl),
      };
      
      // CRITICAL: If logoUrl was intentionally cleared, NEVER restore it from branding
      // This prevents the logo from reappearing after save
      // Check if the branding's logoUrl matches the one we cleared OR if we cleared ANY logo
      if (lastClearedLogoUrlRef.current !== undefined && normalizedBranding.logoUrl) {
        // If the logo URL matches what we cleared, OR if we cleared something and branding still has a logo
        // (might be the same file or a different one, but user explicitly cleared it)
        if (normalizedBranding.logoUrl === lastClearedLogoUrlRef.current) {
          console.log("⚠️ [EFFECT] Logo was cleared, preventing restore of same logo:", normalizedBranding.logoUrl);
          normalizedBranding.logoUrl = undefined; // Force to undefined to prevent restore
        } else {
          // Different logo URL - this might be a new upload, allow it
          console.log("✅ [EFFECT] Different logo URL detected, allowing update:", normalizedBranding.logoUrl, "(cleared:", lastClearedLogoUrlRef.current, ")");
          // Clear the tracking since we're accepting a new logo
          lastClearedLogoUrlRef.current = undefined;
        }
      }
      
      // Only update if values actually changed to prevent unnecessary re-renders
      setBrandingFormData(prev => {
        // CRITICAL: If current form state has no logo but branding has logo, check if we should restore
        // Only restore if logo wasn't intentionally cleared
        if (!prev.logoUrl && normalizedBranding.logoUrl) {
          // If this exact logo was cleared before, don't restore it
          if (lastClearedLogoUrlRef.current === normalizedBranding.logoUrl) {
            console.log("⚠️ [EFFECT] Preventing restore of cleared logo:", normalizedBranding.logoUrl);
            return prev; // Keep current state (no logo)
          }
        }
        
        if (prev.logoUrl === normalizedBranding.logoUrl && 
            prev.faviconUrl === normalizedBranding.faviconUrl &&
            prev.name === normalizedBranding.name) {
          return prev; // No change, keep existing state
        }
        console.log("🔄 [EFFECT] Form data changed, updating from:", prev.logoUrl, "to:", normalizedBranding.logoUrl);
        return normalizedBranding;
      });
    }
  }, [branding, hasBrandingChanges]);

  // Fetch appearance configuration
  const { data: appearance, isLoading: appearanceLoading } = useQuery<SystemAppearance>({
    queryKey: ["/api/admin/system-config/appearance"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/system-config/appearance");
      return response.json();
    },
  });

  // Fetch payment configuration
  const { data: payment, isLoading: paymentLoading } = useQuery<SystemPayment>({
    queryKey: ["/api/admin/system-config/payment"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/system-config/payment");
      return response.json();
    },
  });

  // Branding mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async (data: SystemBranding) => {
      try {
        console.log("🔄 [MUTATION] Sending branding update to server:", JSON.stringify(data, null, 2));
        const response = await apiRequest("PUT", "/api/admin/system-config/branding", data);
        const result = await response.json();
        console.log("✅ [MUTATION] Server response received:", JSON.stringify(result, null, 2));
        return result;
      } catch (error: any) {
        console.error("❌ [MUTATION] Request failed:", error);
        console.error("❌ [MUTATION] Error details:", {
          message: error?.message,
          stack: error?.stack,
          response: error?.response
        });
        throw error;
      }
    },
    onSuccess: async (data) => {
      console.log("✅ [MUTATION SUCCESS] Updating cache and invalidating queries");
      console.log("✅ [MUTATION SUCCESS] Data from server:", JSON.stringify(data, null, 2));
      
      // Server already normalizes null to undefined, but ensure consistency
      const normalizedData: SystemBranding = {
        ...data,
        logoUrl: (data.logoUrl && data.logoUrl.trim() !== "") ? data.logoUrl : undefined,
        faviconUrl: (data.faviconUrl && data.faviconUrl.trim() !== "") ? data.faviconUrl : undefined,
      };
      
      console.log("✅ [MUTATION SUCCESS] Normalized data:", JSON.stringify(normalizedData, null, 2));
      console.log("✅ [MUTATION SUCCESS] Logo URL:", normalizedData.logoUrl, "Type:", typeof normalizedData.logoUrl);
      
      // CRITICAL: First, remove all queries to force complete refresh
      queryClient.removeQueries({ 
        queryKey: ["/api/admin/system-config/branding"]
      });
      
      // Set the new data in cache
      queryClient.setQueryData<SystemBranding>(["/api/admin/system-config/branding"], normalizedData);
      
      // Invalidate to mark as stale (even though we just set it, this ensures all observers refresh)
      queryClient.invalidateQueries({ 
        queryKey: ["/api/admin/system-config/branding"],
        refetchType: 'all'
      });
      
      // Force immediate refetch for ALL active queries
      await queryClient.refetchQueries({ 
        queryKey: ["/api/admin/system-config/branding"],
        type: 'active'
      });
      
      // Dispatch custom event for any components not using React Query
      window.dispatchEvent(new CustomEvent('branding-updated', { 
        detail: normalizedData 
      }));
      
      // Verify cache
      const cached = queryClient.getQueryData<SystemBranding>(["/api/admin/system-config/branding"]);
      console.log("✅ [MUTATION SUCCESS] Final cache state:", JSON.stringify(cached, null, 2));
      
      // Note: Toast shown in handleSaveBranding after all refetches complete
    },
    onError: (error: any, variables: SystemBranding, context: any) => {
      console.error("❌ [MUTATION ERROR] Branding update failed:", error);
      console.error("❌ [MUTATION ERROR] Attempted data:", JSON.stringify(variables, null, 2));
      
      // Revert to previous data if available
      if (context?.previousData) {
        console.log("🔄 [MUTATION ERROR] Reverting to previous data");
        queryClient.setQueryData<SystemBranding>(["/api/admin/system-config/branding"], context.previousData);
      }
      
      toast({
        title: "Error",
        description: error?.message || "Failed to update branding. Please try again.",
        variant: "destructive",
      });
    },
    onMutate: async (newData: SystemBranding) => {
      console.log("🔄 [MUTATION MUTATE] Starting optimistic update");
      console.log("🔄 [MUTATION MUTATE] New data:", JSON.stringify(newData, null, 2));
      
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["/api/admin/system-config/branding"] });
      
      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<SystemBranding>(["/api/admin/system-config/branding"]);
      console.log("🔄 [MUTATION MUTATE] Previous data:", JSON.stringify(previousData, null, 2));
      
      // Optimistically update UI (will be overwritten by server response in onSuccess)
      queryClient.setQueryData<SystemBranding>(["/api/admin/system-config/branding"], newData);
      console.log("🔄 [MUTATION MUTATE] Optimistic update applied");
      
      // Return context with previous data for rollback
      return { previousData };
    },
  });

  // Appearance mutation
  const updateAppearanceMutation = useMutation({
    mutationFn: async (data: SystemAppearance) => {
      const response = await apiRequest("PUT", "/api/admin/system-config/appearance", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-config/appearance"] });
      toast({
        title: "Appearance Updated",
        description: "System appearance has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update appearance.",
        variant: "destructive",
      });
    },
  });

  // Payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (data: SystemPayment) => {
      const response = await apiRequest("PUT", "/api/admin/system-config/payment", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-config/payment"] });
      toast({
        title: "Payment Settings Updated",
        description: "Payment settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update payment settings.",
        variant: "destructive",
      });
    },
  });

  // Normalize URL values (convert null/empty to undefined)
  const normalizeUrl = (url: string | null | undefined): string | undefined => {
    if (!url || url === null || url.trim() === "") return undefined;
    return url.trim();
  };
  
  // Save all branding changes at once
  const handleSaveBranding = async () => {
    if (!hasBrandingChanges) {
      toast({
        title: "No Changes",
        description: "No changes to save.",
      });
      return;
    }

    setIsSavingBranding(true);
    try {
      // Prepare update data - ALWAYS include all fields explicitly, even if undefined
      // This ensures we can clear fields by setting them to undefined (backend converts to null)
      const getFieldValue = (value: string | undefined): string | undefined => {
        if (value === undefined || value === null) return undefined;
        const trimmed = value.trim();
        return trimmed === "" ? undefined : trimmed;
      };

      // CRITICAL: Build update data object, explicitly including ALL fields
      // If a field is undefined, it means "don't change it"
      // If a field is explicitly set to undefined (via getFieldValue), it means "clear it"
      const updateData: Partial<SystemBranding> & { name: string } = {
        name: brandingFormData.name?.trim() || "LockerRoom",
      };
      
      // CRITICAL: Include ALL fields that exist in brandingFormData OR original branding
      // If a field is in brandingFormData (even if undefined), use that value to allow clearing
      // If a field is only in original branding, preserve it
      const allFields: (keyof SystemBranding)[] = [
        'logoUrl', 'faviconUrl', 'companyName', 'companyAddress', 
        'companyCity', 'companyState', 'companyZip', 'companyCountry',
        'contactEmail', 'contactPhone', 'websiteUrl', 
        'socialFacebook', 'socialTwitter', 'socialInstagram', 'socialLinkedin'
      ];
      
      const originalBranding = branding || {};
      
      allFields.forEach((field) => {
        // If field is explicitly in brandingFormData, include it
        // CRITICAL: Convert undefined to null so JSON.stringify includes it
        // JSON.stringify removes undefined properties, but keeps null properties!
        if (field in brandingFormData) {
          const formValue = brandingFormData[field];
          const value = getFieldValue(formValue);
          
          // CRITICAL: Use null (not undefined) so JSON.stringify includes it in the request
          // Server will recognize null as "clear this field"
          (updateData as any)[field] = value === undefined ? null : value;
          
          console.log(`📝 [SAVE] Field ${field}: formValue="${formValue}", normalized="${value}", sending as "${value === undefined ? 'null' : value}"`);
        } 
        // Otherwise, if field exists in original branding, preserve it
        else if (field in originalBranding && originalBranding[field]) {
          const value = getFieldValue(originalBranding[field]);
          if (value !== undefined) {
            (updateData as any)[field] = value;
          }
        }
      });
      
      console.log("💾 [SAVE] All fields in updateData:", Object.keys(updateData));
      console.log("💾 [SAVE] logoUrl explicitly in brandingFormData:", 'logoUrl' in brandingFormData);
      console.log("💾 [SAVE] logoUrl value in brandingFormData:", brandingFormData.logoUrl);

      console.log("💾 [SAVE] Saving branding changes:", JSON.stringify(updateData, null, 2));
      console.log("💾 [SAVE] Logo URL value:", updateData.logoUrl, "Type:", typeof updateData.logoUrl);
      
      const savedData = await updateBrandingMutation.mutateAsync(updateData);
      
      console.log("✅ [SAVE] Save successful, received:", JSON.stringify(savedData, null, 2));
      console.log("✅ [SAVE] Logo URL in saved data:", savedData?.logoUrl, "Type:", typeof savedData?.logoUrl);
      
      // CRITICAL: Normalize the saved data IMMEDIATELY
      const normalizedSavedData: SystemBranding = {
        ...savedData,
        logoUrl: normalizeUrl(savedData?.logoUrl), // Convert null/empty to undefined
        faviconUrl: normalizeUrl(savedData?.faviconUrl),
      };
      
      console.log("✅ [SAVE] Normalized saved data:", JSON.stringify(normalizedSavedData, null, 2));
      console.log("✅ [SAVE] Normalized logoUrl:", normalizedSavedData.logoUrl, "Type:", typeof normalizedSavedData.logoUrl);
      
      // CRITICAL: Track the old logo URL if it's being cleared
      // This prevents useEffect from restoring it later
      if (updateData.logoUrl === undefined && branding?.logoUrl) {
        lastClearedLogoUrlRef.current = branding.logoUrl;
        console.log("🔒 [SAVE] Tracking cleared logo URL to prevent restore:", branding.logoUrl);
      } else if (normalizedSavedData.logoUrl) {
        // Logo is set, clear the tracking
        lastClearedLogoUrlRef.current = undefined;
      }
      
      // CRITICAL: Set flag to prevent useEffect from overriding form state
      justSavedRef.current = true;
      
      // CRITICAL: Update form state IMMEDIATELY with normalized server response
      // This MUST happen before any refetch
      setBrandingFormData(normalizedSavedData);
      console.log("✅ [SAVE] Form state updated immediately with:", JSON.stringify(normalizedSavedData, null, 2));
      
      // Mark as no changes
      setHasBrandingChanges(false);
      
      // Wait for mutation's cache updates to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Refetch to update cache everywhere, but form state is already set correctly
      const refetchResult = await refetchBranding();
      
      // CRITICAL: After refetch, FORCE form state to match what we saved
      // Use the saved data (not refetched) to ensure consistency
      // The refetch might return stale data in some edge cases
      const finalNormalized: SystemBranding = {
        ...normalizedSavedData,
        logoUrl: normalizedSavedData.logoUrl, // Use the saved value, not refetched
        faviconUrl: normalizedSavedData.faviconUrl,
      };
      
      // ALWAYS update form state with what we KNOW was saved (not what was refetched)
      setBrandingFormData(finalNormalized);
      console.log("✅ [SAVE] Form state FORCED to saved data:", JSON.stringify(finalNormalized, null, 2));
      console.log("✅ [SAVE] Final logoUrl:", finalNormalized.logoUrl);
      console.log("✅ [SAVE] logoUrl is falsy:", !finalNormalized.logoUrl);
      
      // Reset the flag after a longer delay to ensure useEffect doesn't interfere
      // BUT: Keep the cleared logo tracking indefinitely until a new logo is set
      setTimeout(() => {
        justSavedRef.current = false;
        console.log("✅ [SAVE] Reset justSavedRef flag (cleared logo tracking remains)");
      }, 5000); // Increased to 5 seconds to give more time for all refetches to complete
      
      toast({
        title: "Saved Successfully",
        description: "All branding changes have been saved.",
      });
    } catch (error: any) {
      console.error("❌ [SAVE] Failed to save branding:", error);
      toast({
        title: "Save Failed",
        description: error?.message || "Failed to save branding changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingBranding(false);
    }
  };

  // Update form field
  const updateBrandingField = (field: keyof SystemBranding, value: string) => {
    setBrandingFormData(prev => ({
      ...prev,
      [field]: value === "" ? undefined : value, // Convert empty strings to undefined for cleaner state
    }));
    setHasBrandingChanges(true);
  };


  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file (JPG, PNG, GIF, etc.).",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);
    try {
      console.log("📤 Starting logo upload:", { fileName: file.name, fileSize: file.size, fileType: file.type });
      const result = await uploadBrandingAsset(file, "logo");
      console.log("✅ Logo uploaded locally:", result);
      
      // Update form data with logo URL
      updateBrandingField("logoUrl", result.secure_url);
      
      toast({
        title: "Logo Uploaded",
        description: "Logo has been uploaded. Click 'Save Changes' to apply.",
      });
    } catch (error) {
      console.error("❌ Logo upload error:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleFaviconUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file (ICO, PNG, etc.).",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 1 * 1024 * 1024; // 1MB for favicon
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 1MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingFavicon(true);
    try {
      console.log("📤 Starting favicon upload:", { fileName: file.name, fileSize: file.size, fileType: file.type });
      const result = await uploadBrandingAsset(file, "favicon");
      console.log("✅ Favicon uploaded locally:", result);
      
      // Update form data with favicon URL
      updateBrandingField("faviconUrl", result.secure_url);
      
      toast({
        title: "Favicon Uploaded",
        description: "Favicon has been uploaded. Click 'Save Changes' to apply.",
      });
    } catch (error) {
      console.error("❌ Favicon upload error:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload favicon. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFavicon(false);
      if (faviconInputRef.current) {
        faviconInputRef.current.value = '';
      }
    }
  };

  const handleLogoRemove = () => {
    console.log("🗑️ [REMOVE LOGO] Current logoUrl:", brandingFormData.logoUrl);
    
    // CRITICAL: Explicitly set to undefined (not empty string) so it's clearly falsy
    // This ensures the field is included in updateData and the UI updates immediately
    setBrandingFormData(prev => {
      const updated = {
        ...prev,
        logoUrl: undefined, // Set to undefined (not "") so it's clearly removed
      };
      console.log("🗑️ [REMOVE LOGO] Updated form data:", updated);
      console.log("🗑️ [REMOVE LOGO] logoUrl after update:", updated.logoUrl);
      return updated;
    });
    
    setHasBrandingChanges(true);
    
    // Force a re-render by logging
    console.log("🗑️ [REMOVE LOGO] Form state after setState:", brandingFormData);
    
    toast({
      title: "Logo Removed",
      description: "Logo will be removed when you save changes.",
    });
  };

  const handleFaviconRemove = () => {
    updateBrandingField("faviconUrl", "");
    toast({
      title: "Favicon Removed",
      description: "Favicon will be removed when you save changes.",
    });
  };

  const handleAppearanceUpdate = (field: string, value: string) => {
    updateAppearanceMutation.mutate({
      ...appearance,
      [field]: value,
    });
  };

  const handlePaymentUpdate = (field: string, value: any) => {
    updatePaymentMutation.mutate({
      ...payment,
      [field]: value,
    });
  };

  // Show loading state
  if (brandingLoading || appearanceLoading || paymentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  // Ensure branding data is loaded (can be empty object, that's fine)
  const brandingData = branding || {};

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Header */}
        <div className="bg-card border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">System Configuration</h1>
                  <p className="text-sm text-muted-foreground mt-1">Configure branding, appearance, and payment settings</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-4 sm:mb-6 gap-1 sm:gap-2">
            <TabsTrigger value="branding" className="flex items-center justify-center gap-2 text-xs sm:text-sm">
              <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Branding</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center justify-center gap-2 text-xs sm:text-sm">
              <Palette className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center justify-center gap-2 text-xs sm:text-sm">
              <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
              Payment
            </TabsTrigger>
          </TabsList>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Brand Identity</CardTitle>
                <CardDescription className="text-sm">Configure your platform's brand identity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                {/* Platform Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Platform Name</Label>
                    <Input
                      id="name"
                    value={brandingFormData.name || ""}
                    onChange={(e) => updateBrandingField("name", e.target.value)}
                      placeholder="LockerRoom"
                    className="w-full"
                    />
                  <p className="text-xs text-muted-foreground">
                    This name will appear throughout the platform (navigation, headers, etc.)
                  </p>
                  </div>

                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Logo</Label>
                  {/* DEBUG: Show current logoUrl value */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-muted-foreground mb-2">
                      Debug: logoUrl = "{String(brandingFormData.logoUrl)}" (type: {typeof brandingFormData.logoUrl}, truthy: {String(!!brandingFormData.logoUrl)})
                    </div>
                  )}
                  {brandingFormData.logoUrl && typeof brandingFormData.logoUrl === 'string' && brandingFormData.logoUrl.trim() !== "" ? (
                    <div className="relative border border-border rounded-lg overflow-hidden bg-muted/50">
                      <div className="p-4 flex items-center gap-4">
                        <img
                          src={brandingFormData.logoUrl}
                          alt="Platform logo"
                          className="h-16 w-auto max-w-[200px] object-contain rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">Current Logo</p>
                          <p className="text-xs text-muted-foreground mt-1">Logo is set and will be used throughout the system</p>
                  </div>
                        <div className="flex flex-col gap-2">
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleLogoUpload(file);
                            }}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadingLogo}
                            className="text-xs"
                          >
                            {uploadingLogo ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-3 h-3 mr-1" />
                                Replace
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleLogoRemove}
                            disabled={uploadingLogo}
                            className="text-xs"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 sm:p-8 text-center bg-muted/30">
                      <ImageIcon className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1">No logo uploaded</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        System will use the default "LR" icon when no logo is set
                      </p>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file);
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="w-full sm:w-auto"
                      >
                        {uploadingLogo ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Logo
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">Recommended: PNG or SVG, max 5MB</p>
                    </div>
                  )}
                </div>

                {/* Favicon Upload */}
                  <div className="space-y-2">
                  <Label>Favicon</Label>
                  {branding?.faviconUrl ? (
                    <div className="relative border border-border rounded-lg overflow-hidden bg-muted/50">
                      <div className="p-4 flex items-center gap-4">
                        <img
                          src={branding.faviconUrl}
                          alt="Platform favicon"
                          className="h-10 w-10 object-contain rounded border border-border bg-background"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">Current Favicon</p>
                          <p className="text-xs text-muted-foreground mt-1">Favicon is set and will appear in browser tabs</p>
                  </div>
                        <div className="flex flex-col gap-2">
                          <input
                            ref={faviconInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFaviconUpload(file);
                            }}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => faviconInputRef.current?.click()}
                            disabled={uploadingFavicon}
                            className="text-xs"
                          >
                            {uploadingFavicon ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-3 h-3 mr-1" />
                                Replace
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleFaviconRemove}
                            disabled={uploadingFavicon}
                            className="text-xs"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 sm:p-8 text-center bg-muted/30">
                      <ImageIcon className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1">No favicon uploaded</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Favicon appears in browser tabs and bookmarks
                      </p>
                      <input
                        ref={faviconInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFaviconUpload(file);
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => faviconInputRef.current?.click()}
                        disabled={uploadingFavicon || uploadingLogo}
                        className="w-full sm:w-auto"
                      >
                        {uploadingFavicon ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Favicon
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">Recommended: ICO or PNG (16x16 or 32x32), max 1MB</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Company Information</CardTitle>
                <CardDescription className="text-sm">Set up your company's contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={brandingFormData.companyName || ""}
                      onChange={(e) => updateBrandingField("companyName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Address</Label>
                    <Input
                      id="companyAddress"
                      value={brandingFormData.companyAddress || ""}
                      onChange={(e) => updateBrandingField("companyAddress", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyCity">City</Label>
                    <Input
                      id="companyCity"
                      value={brandingFormData.companyCity || ""}
                      onChange={(e) => updateBrandingField("companyCity", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyState">State/Province</Label>
                    <Input
                      id="companyState"
                      value={brandingFormData.companyState || ""}
                      onChange={(e) => updateBrandingField("companyState", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyZip">ZIP/Postal Code</Label>
                    <Input
                      id="companyZip"
                      value={brandingFormData.companyZip || ""}
                      onChange={(e) => updateBrandingField("companyZip", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyCountry">Country</Label>
                    <Input
                      id="companyCountry"
                      value={brandingFormData.companyCountry || ""}
                      onChange={(e) => updateBrandingField("companyCountry", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Contact Information</CardTitle>
                <CardDescription className="text-sm">Configure contact details for your platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={brandingFormData.contactEmail || ""}
                      onChange={(e) => updateBrandingField("contactEmail", e.target.value)}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={brandingFormData.contactPhone || ""}
                      onChange={(e) => updateBrandingField("contactPhone", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website URL</Label>
                    <Input
                      id="websiteUrl"
                      type="url"
                      value={brandingFormData.websiteUrl || ""}
                      onChange={(e) => updateBrandingField("websiteUrl", e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Social Media</CardTitle>
                <CardDescription className="text-sm">Connect your social media accounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="socialFacebook">Facebook</Label>
                    <Input
                      id="socialFacebook"
                      value={brandingFormData.socialFacebook || ""}
                      onChange={(e) => updateBrandingField("socialFacebook", e.target.value)}
                      placeholder="https://facebook.com/yourpage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="socialTwitter">Twitter</Label>
                    <Input
                      id="socialTwitter"
                      value={brandingFormData.socialTwitter || ""}
                      onChange={(e) => updateBrandingField("socialTwitter", e.target.value)}
                      placeholder="https://twitter.com/yourhandle"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="socialInstagram">Instagram</Label>
                    <Input
                      id="socialInstagram"
                      value={brandingFormData.socialInstagram || ""}
                      onChange={(e) => updateBrandingField("socialInstagram", e.target.value)}
                      placeholder="https://instagram.com/yourhandle"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="socialLinkedin">LinkedIn</Label>
                    <Input
                      id="socialLinkedin"
                      value={brandingFormData.socialLinkedin || ""}
                      onChange={(e) => updateBrandingField("socialLinkedin", e.target.value)}
                      placeholder="https://linkedin.com/company/yourcompany"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Changes Button */}
            <Card className="border-primary/50">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex-1">
                    {hasBrandingChanges && (
                      <p className="text-sm text-muted-foreground">
                        You have unsaved changes. Click "Save Changes" to apply them.
                      </p>
                    )}
                    {!hasBrandingChanges && (
                      <p className="text-sm text-muted-foreground">
                        All changes have been saved.
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSaveBranding}
                    disabled={!hasBrandingChanges || isSavingBranding || brandingLoading}
                    size="lg"
                    className="w-full sm:w-auto min-w-[150px]"
                  >
                    {isSavingBranding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme Mode</CardTitle>
                <CardDescription>Configure default theme settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="themeMode">Theme Mode</Label>
                  <Select
                    value={appearance?.themeMode || "auto"}
                    onValueChange={(value) => handleAppearanceUpdate("themeMode", value)}
                  >
                    <SelectTrigger id="themeMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (System Default)</SelectItem>
                      <SelectItem value="light">Light Mode</SelectItem>
                      <SelectItem value="dark">Dark Mode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Light Mode Colors</CardTitle>
                <CardDescription>Configure light mode color scheme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.lightModePrimaryColor || "#FFD700"}
                        onChange={(e) => handleAppearanceUpdate("lightModePrimaryColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.lightModePrimaryColor || "#FFD700"}
                        onChange={(e) => handleAppearanceUpdate("lightModePrimaryColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.lightModeSecondaryColor || "#000000"}
                        onChange={(e) => handleAppearanceUpdate("lightModeSecondaryColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.lightModeSecondaryColor || "#000000"}
                        onChange={(e) => handleAppearanceUpdate("lightModeSecondaryColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.lightModeAccentColor || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("lightModeAccentColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.lightModeAccentColor || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("lightModeAccentColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.lightModeBackground || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("lightModeBackground", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.lightModeBackground || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("lightModeBackground", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dark Mode Colors</CardTitle>
                <CardDescription>Configure dark mode color scheme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.darkModePrimaryColor || "#FFD700"}
                        onChange={(e) => handleAppearanceUpdate("darkModePrimaryColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.darkModePrimaryColor || "#FFD700"}
                        onChange={(e) => handleAppearanceUpdate("darkModePrimaryColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.darkModeSecondaryColor || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("darkModeSecondaryColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.darkModeSecondaryColor || "#FFFFFF"}
                        onChange={(e) => handleAppearanceUpdate("darkModeSecondaryColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.darkModeAccentColor || "#000000"}
                        onChange={(e) => handleAppearanceUpdate("darkModeAccentColor", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.darkModeAccentColor || "#000000"}
                        onChange={(e) => handleAppearanceUpdate("darkModeAccentColor", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={appearance?.darkModeBackground || "#0A0A0A"}
                        onChange={(e) => handleAppearanceUpdate("darkModeBackground", e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={appearance?.darkModeBackground || "#0A0A0A"}
                        onChange={(e) => handleAppearanceUpdate("darkModeBackground", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
                <CardDescription>Configure font settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fontFamily">Font Family</Label>
                    <Input
                      id="fontFamily"
                      value={appearance?.fontFamily || "Inter"}
                      onChange={(e) => handleAppearanceUpdate("fontFamily", e.target.value)}
                      placeholder="Inter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fontSizeBase">Base Font Size</Label>
                    <Input
                      id="fontSizeBase"
                      value={appearance?.fontSizeBase || "1rem"}
                      onChange={(e) => handleAppearanceUpdate("fontSizeBase", e.target.value)}
                      placeholder="1rem"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>Configure payment providers and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mockMode">Mock Payment Mode</Label>
                    <p className="text-sm text-muted-foreground">Enable mock payments for development and testing</p>
                  </div>
                  <Switch
                    id="mockMode"
                    checked={payment?.mockModeEnabled !== false}
                    onCheckedChange={(checked) => handlePaymentUpdate("mockModeEnabled", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider">Payment Provider</Label>
                  <Select
                    value={payment?.provider || "none"}
                    onValueChange={(value) => handlePaymentUpdate("provider", value)}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {payment?.provider === "stripe" && (
              <Card>
                <CardHeader>
                  <CardTitle>Stripe Configuration</CardTitle>
                  <CardDescription>Configure your Stripe payment integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stripePublishableKey">Publishable Key</Label>
                    <Input
                      id="stripePublishableKey"
                      type="password"
                      value={payment?.stripePublishableKey || ""}
                      onChange={(e) => handlePaymentUpdate("stripePublishableKey", e.target.value)}
                      placeholder="pk_test_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripeSecretKey">Secret Key</Label>
                    <Input
                      id="stripeSecretKey"
                      type="password"
                      value={payment?.stripeSecretKeyEncrypted || ""}
                      onChange={(e) => handlePaymentUpdate("stripeSecretKeyEncrypted", e.target.value)}
                      placeholder="sk_test_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripeWebhookSecret">Webhook Secret</Label>
                    <Input
                      id="stripeWebhookSecret"
                      type="password"
                      value={payment?.stripeWebhookSecretEncrypted || ""}
                      onChange={(e) => handlePaymentUpdate("stripeWebhookSecretEncrypted", e.target.value)}
                      placeholder="whsec_..."
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {payment?.provider === "paypal" && (
              <Card>
                <CardHeader>
                  <CardTitle>PayPal Configuration</CardTitle>
                  <CardDescription>Configure your PayPal payment integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paypalClientId">Client ID</Label>
                    <Input
                      id="paypalClientId"
                      type="password"
                      value={payment?.paypalClientId || ""}
                      onChange={(e) => handlePaymentUpdate("paypalClientId", e.target.value)}
                      placeholder="PayPal Client ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paypalClientSecret">Client Secret</Label>
                    <Input
                      id="paypalClientSecret"
                      type="password"
                      value={payment?.paypalClientSecretEncrypted || ""}
                      onChange={(e) => handlePaymentUpdate("paypalClientSecretEncrypted", e.target.value)}
                      placeholder="PayPal Client Secret"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paypalMode">PayPal Mode</Label>
                    <Select
                      value={payment?.paypalMode || "sandbox"}
                      onValueChange={(value) => handlePaymentUpdate("paypalMode", value)}
                    >
                      <SelectTrigger id="paypalMode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                        <SelectItem value="live">Live (Production)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Pricing Configuration</CardTitle>
                <CardDescription>Set up pricing for your services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={payment?.currency || "USD"}
                    onChange={(e) => handlePaymentUpdate("currency", e.target.value)}
                    placeholder="USD"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="xenScoutPrice">XEN Scout Review Price (cents)</Label>
                  <Input
                    id="xenScoutPrice"
                    type="number"
                    value={payment?.xenScoutPriceCents || 1000}
                    onChange={(e) => handlePaymentUpdate("xenScoutPriceCents", parseInt(e.target.value))}
                    placeholder="1000"
                  />
                  <p className="text-sm text-muted-foreground">Current price: ${((payment?.xenScoutPriceCents || 1000) / 100).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Settings</CardTitle>
                <CardDescription>Configure subscription options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableSubscriptions">Enable Subscriptions</Label>
                    <p className="text-sm text-muted-foreground">Allow monthly and yearly subscriptions</p>
                  </div>
                  <Switch
                    id="enableSubscriptions"
                    checked={payment?.enableSubscriptions || false}
                    onCheckedChange={(checked) => handlePaymentUpdate("enableSubscriptions", checked)}
                  />
                </div>

                {payment?.enableSubscriptions && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="monthlyPrice">Monthly Price (cents)</Label>
                      <Input
                        id="monthlyPrice"
                        type="number"
                        value={payment?.subscriptionMonthlyPriceCents || 0}
                        onChange={(e) => handlePaymentUpdate("subscriptionMonthlyPriceCents", parseInt(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="yearlyPrice">Yearly Price (cents)</Label>
                      <Input
                        id="yearlyPrice"
                        type="number"
                        value={payment?.subscriptionYearlyPriceCents || 0}
                        onChange={(e) => handlePaymentUpdate("subscriptionYearlyPriceCents", parseInt(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
