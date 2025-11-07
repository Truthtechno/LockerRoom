// client/src/hooks/useProfileMedia.ts
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { apiRequest } from "@/lib/queryClient";

type UpdateBody = {
  bio?: string;
  sport?: string;
  position?: string;
  roleNumber?: string;
  profilePicUrl?: string | null;
  coverPhoto?: string | null;
};

// Helper function to convert data URL to Blob
function dataURLToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

const putStudentMe = async (body: UpdateBody) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  console.log('📤 Updating student profile:', body);

  const res = await fetch("/api/students/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  console.log('📥 Update response:', {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok
  });

  // Handle different response types
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData?.message || errorMessage;
    } catch (parseError) {
      // If we can't parse the error response, use the status text
      console.error('Failed to parse error response:', parseError);
    }
    throw new Error(errorMessage);
  }

  // Parse successful response
  try {
    const data = await res.json();
    console.log('✅ Profile updated successfully:', data);
    return data;
  } catch (parseError) {
    console.error('Failed to parse success response:', parseError);
    throw new Error("Invalid response from server - please try again");
  }
};

const putAdminMe = async (body: UpdateBody) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  console.log('📤 Updating admin profile:', body);

  const res = await fetch("/api/admins/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  console.log('📥 Admin update response:', {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok
  });

  // Handle different response types
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData?.error?.message || errorData?.message || errorMessage;
    } catch (parseError) {
      // If we can't parse the error response, use the status text
      console.error('Failed to parse error response:', parseError);
    }
    throw new Error(errorMessage);
  }

  // Parse successful response
  try {
    const data = await res.json();
    console.log('✅ Admin profile updated successfully:', data);
    return data;
  } catch (parseError) {
    console.error('Failed to parse success response:', parseError);
    throw new Error("Invalid response from server - please try again");
  }
};

const putSchoolAdminMe = async (body: UpdateBody) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  console.log('📤 Updating school admin profile:', body);

  const res = await fetch("/api/school-admin/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  console.log('📥 School admin update response:', {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok
  });

  // Handle different response types
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData?.error?.message || errorData?.message || errorMessage;
    } catch (parseError) {
      // If we can't parse the error response, use the status text
      console.error('Failed to parse error response:', parseError);
    }
    throw new Error(errorMessage);
  }

  // Parse successful response
  try {
    const data = await res.json();
    console.log('✅ School admin profile updated successfully:', data);
    return data;
  } catch (parseError) {
    console.error('Failed to parse success response:', parseError);
    throw new Error("Invalid response from server - please try again");
  }
};

const putSystemAdminMe = async (body: UpdateBody) => {
  // Validate token exists before making request
  const token = localStorage.getItem("token");
  if (!token) {
    console.error('❌ No token found in localStorage');
    throw new Error("Not authenticated. Please log in again.");
  }

  console.log('📤 Updating system admin profile:', body);

  try {
    // Use apiRequest utility which handles authentication more reliably
    const res = await apiRequest("PUT", "/api/system-admin/profile", body);

    console.log('📥 System admin update response:', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok
    });

    // Parse successful response
    const data = await res.json();
    console.log('✅ System admin profile updated successfully:', data);
    return data;
  } catch (error: any) {
    console.error('❌ System admin profile update failed:', error);
    
    // Handle specific error cases
    if (error?.message?.includes('Invalid token') || 
        error?.message?.includes('Authentication required') ||
        error?.message?.includes('session token is invalid') ||
        error?.message?.includes('log out and log back in')) {
      // Token might be expired or invalid - suggest re-login
      throw new Error("Your session has expired. Please log out and log back in to refresh your session.");
    }
    
    // Handle profile not found errors
    if (error?.message?.includes('profile not found') || 
        error?.message?.includes('account is properly configured')) {
      // This might be a data issue - suggest re-login to refresh session
      throw new Error("Profile configuration issue detected. Please log out and log back in, then try again.");
    }
    
    // Re-throw the original error with better context
    throw new Error(error?.message || "Failed to update system admin profile. Please try again.");
  }
};

export function useProfileMedia() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { updateUser, user } = useAuth();

  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [coverPhotoPreview, setCoverPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  const [selectedCoverImage, setSelectedCoverImage] = useState<string | null>(null);

  const handleProfilePicChange = useCallback((file: File) => {
    if (!file?.type?.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max size is 5MB.", variant: "destructive" });
      return;
    }

    // Show image cropper
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleCropComplete = useCallback(async (croppedImageBlob: Blob) => {
    // Validate user and token before proceeding
    if (!user) {
      toast({ 
        title: "Authentication required", 
        description: "Please log in to update your profile picture.", 
        variant: "destructive" 
      });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast({ 
        title: "Authentication required", 
        description: "Your session has expired. Please log in again.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      setIsUploading(true);
      
      // CRITICAL: Set optimistic preview IMMEDIATELY before any async operations
      // This ensures the UI shows the new picture instantly
      const previewUrl = URL.createObjectURL(croppedImageBlob);
      setProfilePicPreview(previewUrl);
      console.log('✅ Preview set immediately:', previewUrl);

      console.log('📤 Uploading profile picture:', {
        fileSize: croppedImageBlob.size,
        fileType: croppedImageBlob.type,
        userRole: user.role,
        userId: user.id
      });

      // Upload to Cloudinary with retry logic
      let url: string;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          const result = await uploadToCloudinary(croppedImageBlob as any, "profilePic");
          url = result.url;
          break;
        } catch (uploadError: any) {
          retries++;
          if (retries > maxRetries) {
            throw new Error(uploadError?.message || "Failed to upload image to Cloudinary");
          }
          console.log(`⚠️ Cloudinary upload failed, retrying (${retries}/${maxRetries})...`);
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      setIsUpdating(true);
      
      // Update profile with the Cloudinary URL based on user role
      // Add retry logic for API calls and capture response data
      let responseData: any = null;
      let profileUpdateRetries = 0;
      const maxProfileRetries = 2;
      
      while (profileUpdateRetries <= maxProfileRetries) {
        try {
          // Call the appropriate API based on user role and capture response
          if (user.role === 'school_admin') {
            responseData = await putSchoolAdminMe({ profilePicUrl: url! });
          } else if (user.role === 'system_admin') {
            responseData = await putSystemAdminMe({ profilePicUrl: url! });
          } else if (user.role === 'scout_admin' || user.role === 'xen_scout') {
            responseData = await putAdminMe({ profilePicUrl: url! });
          } else {
            responseData = await putStudentMe({ profilePicUrl: url! });
          }
          break; // Success, exit retry loop
        } catch (apiError: any) {
          profileUpdateRetries++;
          
          // Don't retry on authentication errors - user needs to log in again
          if (apiError?.message?.includes('session has expired') || 
              apiError?.message?.includes('Invalid token') ||
              apiError?.message?.includes('Authentication required')) {
            throw apiError;
          }
          
          if (profileUpdateRetries > maxProfileRetries) {
            throw apiError;
          }
          
          console.log(`⚠️ Profile update failed, retrying (${profileUpdateRetries}/${maxProfileRetries})...`);
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * profileUpdateRetries));
        }
      }
      
      console.log('✅ Profile picture updated successfully:', url);
      
      // CRITICAL: Update user context IMMEDIATELY (synchronously) so UI reflects change instantly
      // This ensures the settings page shows the new picture right away (before query refetch)
      if (responseData && user) {
        updateUser({ 
          ...user, 
          name: responseData.name || user.name, 
          profilePicUrl: responseData.profilePicUrl || url!
        });
        console.log('✅ User context updated IMMEDIATELY:', { 
          name: responseData.name || user.name, 
          profilePicUrl: responseData.profilePicUrl || url!
        });
      } else {
        // Fallback: just update profilePicUrl if response doesn't have full data
        updateUser({ ...user, profilePicUrl: url! });
        console.log('✅ User context updated with fallback profilePicUrl:', url!);
      }
      
      // Trigger auth-change event IMMEDIATELY to refresh sidebar
      window.dispatchEvent(new Event('auth-change'));
      
      // Show success toast
      toast({ 
        title: "Profile photo updated", 
        description: "Your profile picture has been updated successfully!" 
      });
      
      // CRITICAL: Invalidate and refetch queries to ensure all components update
      // We do this synchronously to ensure the UI updates properly
      try {
        // Remove cached queries first
        qc.removeQueries({ queryKey: ['/api/users/me'] });
        qc.removeQueries({ queryKey: ['/api/users/me', user?.id] });
        
        // Invalidate all relevant queries
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['/api/users/me'] }),
          qc.invalidateQueries({ queryKey: ['/api/users/me', user?.id] }),
          qc.invalidateQueries({ queryKey: ['/api/students/me'] }),
          qc.invalidateQueries({ queryKey: ['/api/school-admin/profile'] }),
          qc.invalidateQueries({ queryKey: ['/api/admins/me'] }),
          qc.invalidateQueries({ queryKey: ['/api/system-admin/profile'] })
        ]);
        
        // Force immediate refetch - this ensures sidebar and settings page update
        await Promise.all([
          qc.refetchQueries({ queryKey: ['/api/users/me'], type: 'active' }),
          qc.refetchQueries({ queryKey: ['/api/users/me', user?.id], type: 'active' }),
        ]);
        
        console.log('✅ All queries invalidated and refetched');
      } catch (refetchError) {
        console.warn('⚠️ Query refetch error (non-critical):', refetchError);
        // Don't fail the upload if refetch fails - user context update already happened
      }
      
      // Keep preview visible - it will be cleared when userData refetches
      // This ensures seamless visual transition from preview to actual image
      
      console.log('✅ Profile update complete - UI updated immediately');
    } catch (e: any) {
      // Clear optimistic preview on error
      setProfilePicPreview(null);
      
      console.error('❌ Profile picture upload failed:', e);
      
      // Provide more helpful error messages
      let errorMessage = e.message || "Please try again.";
      if (e.message?.includes('session has expired') || 
          e.message?.includes('Invalid token') ||
          e.message?.includes('session token is invalid') ||
          e.message?.includes('log out and log back in')) {
        errorMessage = "Your session has expired. Please log out and log back in to refresh your session, then try updating your profile picture again.";
      } else if (e.message?.includes('Authentication required')) {
        errorMessage = "Please log in to update your profile picture.";
      } else if (e.message?.includes('profile not found') || 
                 e.message?.includes('account is properly configured')) {
        errorMessage = "Profile configuration issue detected. Please log out and log back in, then try updating your profile picture again.";
      }
      
      toast({ 
        title: "Profile picture upload failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
      setIsUpdating(false);
      setShowCropper(false);
      setSelectedImage(null);
      // Don't clear profilePicPreview here - keep it until query refetches
      // This ensures the UI shows the new picture immediately
    }
  }, [qc, toast, updateUser, user]);

  const handleCoverPhotoChange = useCallback((file: File) => {
    if (!file?.type?.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image.", variant: "destructive" });
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max size is 6MB.", variant: "destructive" });
      return;
    }

    // Show cover photo cropper
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedCoverImage(reader.result as string);
      setShowCoverCropper(true);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleCoverCropComplete = useCallback(async (croppedImageBlob: Blob) => {
    try {
      setIsUploading(true);
      
      // Optimistic preview
      setCoverPhotoPreview(URL.createObjectURL(croppedImageBlob));

      console.log('📤 Uploading cover photo:', {
        fileSize: croppedImageBlob.size,
        fileType: croppedImageBlob.type
      });

      // Upload to Cloudinary
      const { url } = await uploadToCloudinary(croppedImageBlob as any, "coverPhoto");
      
      setIsUpdating(true);
      
      // Update profile with the Cloudinary URL
      await putStudentMe({ coverPhoto: url });
      
      console.log('✅ Cover photo updated successfully:', url);
      
      toast({ 
        title: "Cover photo updated", 
        description: "Your cover photo has been updated successfully!" 
      });
      
      // Refresh current user data everywhere
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['/api/users/me'] }),
        qc.invalidateQueries({ queryKey: ['/api/students/me'] })
      ]);
    } catch (e: any) {
      // Clear optimistic preview on error
      setCoverPhotoPreview(null);
      
      console.error('❌ Cover photo upload failed:', e);
      
      toast({ 
        title: "Cover photo upload failed", 
        description: e.message || "Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
      setIsUpdating(false);
      setShowCoverCropper(false);
      setSelectedCoverImage(null);
    }
  }, [qc, toast]);

  const updateProfile = async (body: UpdateBody) => {
    setIsUpdating(true);
    try {
      // Use appropriate endpoint based on user role
      if (user?.role === 'school_admin') {
        await putSchoolAdminMe(body);
      } else if (user?.role === 'system_admin') {
        await putSystemAdminMe(body);
      } else if (user?.role === 'scout_admin' || user?.role === 'xen_scout') {
        await putAdminMe(body);
      } else {
        await putStudentMe(body);
      }
      
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/students/me"] }),
        qc.invalidateQueries({ queryKey: ["/api/users/me"] }),
        qc.invalidateQueries({ queryKey: ["/api/admins/me"] }),
        qc.invalidateQueries({ queryKey: ["/api/school-admin/profile"] }),
        qc.invalidateQueries({ queryKey: ["/api/system-admin/profile"] }),
      ]);
      return true;
    } finally {
      setIsUpdating(false);
    }
  };

  const clearPreviews = useCallback(() => {
    setProfilePicPreview(null);
    setCoverPhotoPreview(null);
  }, []);

  return {
    profilePicPreview,
    coverPhotoPreview,
    handleProfilePicChange,
    handleCoverPhotoChange,
    updateProfile,
    clearPreviews,
    isUploading,
    isUpdating,
    showCropper,
    selectedImage,
    handleCropComplete,
    setShowCropper,
    showCoverCropper,
    selectedCoverImage,
    handleCoverCropComplete,
    setShowCoverCropper,
  };
}