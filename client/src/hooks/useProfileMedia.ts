// client/src/hooks/useProfileMedia.ts
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

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
    try {
      setIsUploading(true);
      
      // Optimistic preview
      setProfilePicPreview(URL.createObjectURL(croppedImageBlob));

      console.log('📤 Uploading profile picture:', {
        fileSize: croppedImageBlob.size,
        fileType: croppedImageBlob.type
      });

      // Upload to Cloudinary
      const { url } = await uploadToCloudinary(croppedImageBlob as any, "profilePic");
      
      setIsUpdating(true);
      
      // Update profile with the Cloudinary URL based on user role
      if (user?.role === 'school_admin') {
        await putSchoolAdminMe({ profilePicUrl: url });
      } else if (user?.role === 'scout_admin' || user?.role === 'xen_scout' || user?.role === 'system_admin') {
        await putAdminMe({ profilePicUrl: url });
      } else {
        await putStudentMe({ profilePicUrl: url });
      }
      
      // Update user context with new profile picture URL
      updateUser({ profilePicUrl: url });
      console.log('✅ Profile picture updated successfully:', url);
      
      toast({ 
        title: "Profile photo updated", 
        description: "Your profile picture has been updated successfully!" 
      });
      
      // Refresh current user data everywhere
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['/api/users/me'] }),
        qc.invalidateQueries({ queryKey: ['/api/students/me'] }),
        qc.invalidateQueries({ queryKey: ['/api/school-admin/profile'] }),
        qc.invalidateQueries({ queryKey: ['/api/admins/me'] })
      ]);
    } catch (e: any) {
      // Clear optimistic preview on error
      setProfilePicPreview(null);
      
      console.error('❌ Profile picture upload failed:', e);
      
      toast({ 
        title: "Profile picture upload failed", 
        description: e.message || "Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
      setIsUpdating(false);
      setShowCropper(false);
      setSelectedImage(null);
    }
  }, [qc, toast, updateUser]);

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
      } else if (user?.role === 'scout_admin' || user?.role === 'system_admin') {
        await putAdminMe(body);
      } else {
        await putStudentMe(body);
      }
      
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/students/me"] }),
        qc.invalidateQueries({ queryKey: ["/api/users/me"] }),
        qc.invalidateQueries({ queryKey: ["/api/admins/me"] }),
        qc.invalidateQueries({ queryKey: ["/api/school-admin/profile"] }),
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