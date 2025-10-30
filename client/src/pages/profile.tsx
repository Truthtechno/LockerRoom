import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { useToast } from "@/hooks/use-toast";
import { useProfileMedia } from "@/hooks/useProfileMedia";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo } from "@/lib/timeAgo";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import LazyMedia from "@/components/ui/lazy-media";
import { ImageCropper } from "@/components/ui/image-cropper";
import { CoverPhotoCropper } from "@/components/ui/cover-photo-cropper";
import { Heart, Eye, MessageCircle, Bookmark, Edit3, Share, Camera, Save, Copy, ExternalLink, User, Send, Play, X, Trash2, MoreHorizontal } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { StudentWithStats, PostWithDetails, PostCommentWithUser } from "@shared/schema";
import XenWatchSubmitModal from "@/components/xen-watch/submit-modal";
import { ProfileSkeleton } from "@/components/ui/profile-skeleton";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile media handling hook
  const {
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
  } = useProfileMedia();

  // Edit profile state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    bio: "",
    phone: "",
    position: "",
    roleNumber: "",
    sport: "",
    grade: ""
  });

  // Remove post modal state since we're using dedicated pages
  
  // XEN Watch modal state
  const [showXenWatchModal, setShowXenWatchModal] = useState(false);

  // Pagination state - using infinite query instead
  const limit = 12; // Instagram-style grid

  // Auto-create student profile mutation
  const createStudentProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not found");
      
      // Log the full user object to confirm all fields are present
      console.log("🔍 Full user object from useAuth():", user);
      console.log("📋 User fields check:", {
        id: user.id,
        name: user.name,
        email: user.email,
        schoolId: user.schoolId,
        role: user.role
      });
      
      // Validate required fields - no demo defaults allowed
      const missingFields = [];
      if (!user.id) missingFields.push("user ID");
      if (!user.name) missingFields.push("name");
      if (!user.email) missingFields.push("email");
      if (!user.schoolId) missingFields.push("school ID");

      if (missingFields.length > 0) {
        // Defensive check: try to fetch existing student profile first
        try {
          const existingProfileResponse = await apiRequest("GET", "/api/students/me");
          if (existingProfileResponse.ok) {
            const existingProfile = await existingProfileResponse.json();
            console.log("✅ Found existing student profile:", existingProfile);
            // If profile exists, invalidate queries to refresh the UI
            await queryClient.invalidateQueries({ queryKey: ["/api/students/me", user?.id] });
            throw new Error("Profile already exists. Please refresh the page.");
          }
        } catch (profileError: any) {
          if (profileError.message.includes("Profile already exists")) {
            throw profileError;
          }
          // If no existing profile, show the missing fields error
        }

        const errorMessage = "Your account is not linked to a school or missing required info. Ask your school admin to link your account to a school.";
        console.error("❌ Missing required fields:", missingFields.join(", "));
        console.error("📝 User data:", { id: user.id, name: user.name, email: user.email, schoolId: user.schoolId });
        throw new Error(errorMessage);
      }

      // Use only actual user data - no demo defaults
      const profileData = {
        userId: user.id,
        name: user.name,
        email: user.email,
        schoolId: user.schoolId,
        sport: "Soccer", // Default sport
        position: "Player", // Default position
        roleNumber: "0", // Default role number
        phone: "",
        bio: `Hello! I'm ${user.name}, a student athlete.`
      };

      console.log("🚀 Creating student profile with final data:", profileData);
      console.log("📤 Request details:", {
        url: "/api/students",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')?.substring(0, 20)}...`
        },
        body: JSON.stringify(profileData)
      });
      
      try {
        const response = await apiRequest("POST", "/api/students", profileData);
        console.log("📥 Response received:", {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        const data = await response.json();
        console.log("✅ Profile created successfully:", data);
        return data;
      } catch (error: any) {
        console.log("❌ Profile creation failed:", {
          message: error.message,
          status: error.status,
          code: error.code,
          stack: error.stack
        });
        
        // Handle 409 (profile already exists) as success - trigger refetch
        if (error.status === 409) {
          console.log("🔄 Profile already exists, treating as success and refetching");
          // Invalidate and refetch the profile query to load the existing profile
          await queryClient.invalidateQueries({ queryKey: ["/api/students/me", user?.id] });
          await queryClient.refetchQueries({ queryKey: ["/api/students/me", user?.id] });
          
          // Return a success response to trigger onSuccess
          return { success: true, message: "Profile already exists" };
        }
        
        // Enhanced error message based on status code
        let userFriendlyMessage = error.message || "Failed to create profile. Please try again.";
        
        if (error.status === 400) {
          if (error.message.includes("already exists")) {
            userFriendlyMessage = "A profile already exists for this account. Please refresh the page.";
          } else if (error.message.includes("associated with a school")) {
            userFriendlyMessage = "Account must be associated with a school. Please contact support.";
          } else {
            userFriendlyMessage = `Invalid data: ${error.message}`;
          }
        } else if (error.status === 401) {
          userFriendlyMessage = "Authentication failed. Please log in again.";
        } else if (error.status === 500) {
          userFriendlyMessage = "Server error. Please try again or contact support.";
        }
        
        const enhancedError = new Error(userFriendlyMessage);
        (enhancedError as any).status = error.status;
        (enhancedError as any).originalError = error;
        throw enhancedError;
      }
    },
    onSuccess: async (data) => {
      console.log("🎉 Profile creation success, invalidating queries");
      
      // Invalidate and refetch the profile query to load the new profile
      await queryClient.invalidateQueries({ queryKey: ["/api/students/me", user?.id] });
      await queryClient.refetchQueries({ queryKey: ["/api/students/me", user?.id] });
      
      // Also invalidate posts query for when user navigates to feed
      queryClient.invalidateQueries({ queryKey: ["/api/posts/student"] });
      
      toast({
        title: "Profile Created Successfully! 🎉",
        description: "Your student profile is now active. Welcome to LockerRoom!",
      });
    },
    onError: (error: any) => {
      console.log("💥 Profile creation error:", error);
      toast({
        title: "Profile Creation Failed",
        description: error.message || "Failed to create profile. Please try again.",
        variant: "destructive",
      });
    }
  });


  // Query for student profile - always runs
  // IMPORTANT: Include user.id in query key to prevent stale data when switching between students
  const { data: studentProfile, isLoading: profileLoading, error: profileError } = useQuery<StudentWithStats>({
    queryKey: ["/api/students/me", user?.id],
    queryFn: async () => {
      try {
        console.log("🔍 Loading student profile...");
        const response = await apiRequest("GET", `/api/students/me`);
        
        // Check if response is ok
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }
        
        const data = await response.json();
        console.log("✅ Profile loaded successfully:", data);
        return data;
      } catch (error: any) {
        console.log("❌ Profile load error:", {
          message: error.message,
          status: error.status,
          code: error.code
        });
        
        // If it's a 500 error due to database schema issues, return a basic profile
        if (error?.status === 500 && error?.message?.includes("Failed to fetch student profile")) {
          console.log("🔧 Server error detected, returning basic profile structure");
          // Return a minimal profile structure to prevent crashes
          return {
            id: user?.id || "unknown",
            userId: user?.id || "unknown",
            schoolId: user?.schoolId || "",
            name: user?.name || "Unknown Student",
            email: user?.email || "",
            phone: null,
            gender: null,
            dateOfBirth: null,
            grade: null,
            guardianContact: null,
            profilePicUrl: null,
            roleNumber: null,
            position: null,
            sport: null,
            profilePic: null,
            bio: null,
            coverPhoto: null,
            createdAt: new Date(),
            postsCount: 0,
            totalLikes: 0,
            totalViews: 0,
            totalSaves: 0,
            totalComments: 0,
            followersCount: 0,
            followingCount: 0,
            user: user,
            school: undefined
          } as StudentWithStats;
        }
        
        throw error;
      }
    },
    enabled: !!user?.id && user?.role === "student",
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (profile not found) - this is expected for new users
      if (error?.status === 404) {
        console.log("🚫 Profile not found (404), not retrying - user needs to create profile");
        return false;
      }
      
      // Don't retry on 401 (unauthorized) - user needs to log in again
      if (error?.status === 401) {
        console.log("🔒 Unauthorized (401), not retrying - user needs to log in");
        return false;
      }
      
      // Don't retry on 400 (bad request) - client error, not server issue
      if (error?.status === 400) {
        console.log("❌ Bad request (400), not retrying - client error");
        return false;
      }
      
      // Retry on server errors (500+) or network issues
      if (failureCount < 3) {
        console.log(`🔄 Retrying profile load (attempt ${failureCount + 1}) - server error`);
        return true;
      }
      
      console.log("🚫 Max retries reached, giving up");
      return false;
    }
  });

  // Infinite query for user posts - only runs when profile exists
  // IMPORTANT: Include user.id in query key to prevent stale data when switching between students
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
    error: postsError
  } = useInfiniteQuery({
    queryKey: ["/api/posts/student", studentProfile?.id, user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const offset = pageParam * limit;
        const response = await apiRequest("GET", `/api/posts/student/${studentProfile?.id}?limit=${limit}&offset=${offset}`);
        
        // Check if response is ok
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }
        
        const data = await response.json();
        return {
          posts: data,
          hasMore: data.length === limit,
          nextOffset: pageParam + 1
        };
      } catch (error: any) {
        console.log("❌ Posts load error:", {
          message: error.message,
          status: error.status,
          code: error.code
        });
        
        // If it's a server error, return empty array instead of crashing
        if (error?.status === 500) {
          console.log("🔧 Server error detected, returning empty posts array");
          return { posts: [], hasMore: false, nextOffset: 0 };
        }
        
        throw error;
      }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.nextOffset;
    },
    initialPageParam: 0,
    enabled: !!studentProfile?.id,
    staleTime: 30_000, // 30 seconds cache
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (no posts found)
      if (error?.status === 404) return false;
      // Don't retry on 500 (server error) - we handle it gracefully
      if (error?.status === 500) return false;
      return failureCount < 3;
    }
  });

  // Flatten all posts from all pages
  const allPosts = postsData?.pages.flatMap(page => page.posts) || [];

  // Check if profile is missing (404 error)
  const isProfileMissing = (profileError as any)?.status === 404;

  // Post interaction mutations
  // Post interactions are now handled in the dedicated post detail page

  // Handler functions
  const handleEditProfile = () => {
    if (studentProfile) {
      setEditFormData({
        name: studentProfile.name || "",
        bio: studentProfile.bio || "",
        phone: studentProfile.phone || "",
        position: studentProfile.position || "",
        roleNumber: studentProfile.roleNumber || "",
        sport: studentProfile.sport || "",
        grade: studentProfile.grade || ""
      });
      setShowEditDialog(true);
    }
  };

  const handlePostClick = (post: PostWithDetails) => {
    // Navigate to dedicated post detail page with proper routing
    setLocation(`/post/${post.id}`);
  };

  // Post interaction handlers removed - now handled in dedicated post detail page

  // Infinite scroll with intersection observer
  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage || !observerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleShareProfile = () => {
    setShowShareDialog(true);
  };


  const handleSaveProfile = async () => {
    const updates: Record<string, any> = {};
    let hasUpdates = false;
    
    // Collect text field updates
    if (user?.role === 'student') {
      // Students can edit: sport, position, roleNumber, bio, phone, grade (profilePic and coverPhoto are handled separately)
      const allowedFields = ['sport', 'position', 'roleNumber', 'bio', 'phone', 'grade'];
      
      allowedFields.forEach(field => {
        const value = editFormData[field as keyof typeof editFormData];
        if (value && value.trim() !== '') {
          updates[field] = value;
          hasUpdates = true;
        }
      });
    } else {
      // Admins can edit all fields
      Object.entries(editFormData).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          updates[key] = value;
          hasUpdates = true;
        }
      });
    }

    // Note: Profile picture and cover photo uploads are now handled immediately when files are selected
    // This function only handles text field updates

    if (!hasUpdates) {
      toast({
        title: "No Changes",
        description: "No changes were made to save.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateProfile(updates);
      setShowEditDialog(false);
      setEditFormData({
        name: "",
        bio: "",
        phone: "",
        position: "",
        roleNumber: "",
        sport: "",
        grade: ""
      });
    } catch (error) {
      console.error('❌ Profile save error:', error);
    }
  };

  const copyProfileLink = () => {
    const profileUrl = `${window.location.origin}/profile/${studentProfile?.id}`;
    navigator.clipboard.writeText(profileUrl);
    toast({
      title: "Link Copied",
      description: "Profile link copied to clipboard!",
    });
  };

  const shareProfileNative = async () => {
    if (navigator.share && studentProfile) {
      try {
        await navigator.share({
          title: `${studentProfile.name}'s Profile`,
          text: `Check out ${studentProfile.name}'s sports profile on LockerRoom!`,
          url: `${window.location.origin}/profile/${studentProfile.id}`,
        });
      } catch (error) {
        // If native sharing fails, fall back to copy link
        copyProfileLink();
      }
    } else {
      copyProfileLink();
    }
  };

  // Error state
  if (!user || user.role !== "student") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Access denied. Student profile required.</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  // Profile not found - show create profile screen
  if (isProfileMissing || (!studentProfile && !profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-4">Welcome to LockerRoom!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Create your student athlete profile to start sharing your journey, connecting with teammates, and tracking your performance.
          </p>
          
          <div className="space-y-4">
            <Button 
              onClick={() => createStudentProfile.mutate()}
              disabled={createStudentProfile.isPending}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
            >
              {createStudentProfile.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Your Profile...
                </>
              ) : (
                <>
                  <User className="w-5 h-5 mr-2" />
                  Create My Profile
                </>
              )}
            </Button>
            
            {createStudentProfile.isError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm mb-3">
                  {createStudentProfile.error?.message || "Profile creation failed. Please try again."}
                </p>
                <Button 
                  onClick={() => createStudentProfile.mutate()}
                  disabled={createStudentProfile.isPending}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {createStudentProfile.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Try Again"
                  )}
                </Button>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-sm text-muted-foreground">
            <p>Your profile will include:</p>
            <ul className="mt-2 space-y-1 text-left max-w-xs mx-auto">
              <li>• Personal information & bio</li>
              <li>• Sports position & jersey number</li>
              <li>• Performance stats tracking</li>
              <li>• Photo & cover image</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64 pb-24 lg:pb-8 page-transition">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-8">
          {/* Cover Photo */}
          <div
            className="h-48 bg-gradient-to-r from-primary via-secondary to-primary relative"
            style={{
              backgroundImage: (coverPhotoPreview
                ? `url('${coverPhotoPreview}')`
                : (studentProfile?.coverPhoto ? `url('${studentProfile.coverPhoto}')` : undefined)),
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute bottom-4 right-4">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/90 hover:bg-white text-black"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (file) handleCoverPhotoChange(file);
                  };
                  input.click();
                }}
                disabled={isUploading || isUpdating}
              >
                <Camera className="w-4 h-4 mr-2" />
                Edit Cover
              </Button>
            </div>
          </div>

          {/* Profile Info - Clean Layout */}
          <div className="px-6 pb-6">
            {/* Profile Picture - Centered */}
            <div className="flex justify-center -mt-16 mb-4">
              <div className="relative mx-auto w-32 h-32">
                {/* Main profile picture with fallback */}
                <div className="w-32 h-32 rounded-full border-4 border-card shadow-lg overflow-hidden">
                  <AvatarWithFallback
                    src={profilePicPreview || studentProfile?.profilePicUrl}
                    alt={`${studentProfile?.name} profile`}
                    fallbackText={studentProfile?.name ? studentProfile.name.slice(0, 2).toUpperCase() : '??'}
                    className="w-full h-full"
                    size="xl"
                  />
                </div>
                {/* Camera button (always visible for students now, per your request) */}
                <button
                  type="button"
                  title="Change profile photo"
                  className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) handleProfilePicChange(file);
                    };
                    input.click();
                  }}
                  disabled={isUploading || isUpdating}
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Student Name - Below Cover Photo */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">{studentProfile?.name}</h1>
              <p className="text-lg text-muted-foreground mb-1">
                {studentProfile?.sport && studentProfile?.roleNumber && studentProfile?.position 
                  ? `${studentProfile.sport} • #${studentProfile.roleNumber} • ${studentProfile.position}`
                  : studentProfile?.sport || studentProfile?.position || 'Student Athlete'
                }
              </p>
              <p className="text-muted-foreground">
                {studentProfile?.school?.name} • {studentProfile?.grade || 'Class of 2025'}
              </p>
            </div>
            

            {/* Action Buttons */}
            <div className="flex justify-center gap-3 mb-6">
              <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleEditProfile}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    data-testid="button-edit-profile"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </DialogTrigger>
              </Dialog>
              
              
              <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleShareProfile}
                    variant="secondary"
                    data-testid="button-share-profile"
                  >
                    <Share className="w-4 h-4 mr-2" />
                    Share Profile
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
            
            {/* Bio */}
            {studentProfile?.bio && (
              <div className="text-center">
                <p className="text-foreground leading-relaxed whitespace-pre-line max-w-2xl mx-auto">
                  {studentProfile.bio}
                </p>
              </div>
            )}
          </div>
        </div>


        {/* Posts Grid - Instagram Style */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Posts</h2>
          </div>
          
          {postsLoading && (!postsData || postsData.pages.length === 0) ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : allPosts && allPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {allPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="aspect-square relative group cursor-pointer overflow-hidden post-grid-item rounded-lg"
                  onClick={() => handlePostClick(post)}
                >
                  {post.effectiveMediaType === "video" ? (
                    <div className="relative w-full h-full">
                      {post.effectiveMediaUrl && !post.effectiveMediaUrl.includes('/api/placeholder/') ? (
                        <>
                          <LazyMedia
                            src={post.effectiveMediaUrl}
                            alt="Post video"
                            type="video"
                            className="w-full h-full object-cover"
                            style={{ maxHeight: '100%' }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300">
                            <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center transition-opacity duration-300">
                              <Play className="w-12 h-12 text-white" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-4xl mb-2">🎥</div>
                            <p className="text-xs text-muted-foreground">
                              {post.effectiveStatus === 'processing' ? 'Processing...' : 
                               post.effectiveStatus === 'failed' ? 'Failed' : 
                               'Unavailable'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    post.effectiveMediaUrl && !post.effectiveMediaUrl.includes('/api/placeholder/') ? (
                      <img
                        src={post.effectiveMediaUrl}
                        alt="Post"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl mb-2">🖼️</div>
                          <p className="text-xs text-muted-foreground">
                            {post.effectiveStatus === 'processing' ? 'Processing...' : 
                             post.effectiveStatus === 'failed' ? 'Failed' : 
                             'Unavailable'}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                  
                  {/* Hover overlay with stats */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300">
                    <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center space-x-8 text-white transition-opacity duration-300">
                      <div className="flex items-center space-x-2">
                        <Heart className="w-6 h-6 fill-current" />
                        <span className="font-semibold">{post.likesCount || 0}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="w-6 h-6 fill-current" />
                        <span className="font-semibold">{post.commentsCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Infinite scroll trigger */}
              {hasNextPage && (
                <div ref={observerRef} className="col-span-full flex justify-center py-8">
                  {isFetchingNextPage ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading more posts...</span>
                    </div>
                  ) : (
                    <div className="h-4" /> // Invisible trigger
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-24 h-24 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center">
                  <Camera className="w-12 h-12 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">No posts yet</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Share your athletic journey, achievements, and moments with your teammates and fans.
                  </p>
                </div>
                <Button 
                  onClick={() => window.location.href = '/create'}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 text-lg btn-enhanced"
                  size="lg"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Create Your First Post
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information and photo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Profile Picture Section - Available for all users */}
            <div className="flex items-center space-x-4">
              <AvatarWithFallback
                src={profilePicPreview || studentProfile?.profilePicUrl}
                alt="Profile preview"
                fallbackText={studentProfile?.name ? studentProfile.name.slice(0, 2).toUpperCase() : '??'}
                size="lg"
                className="border-4 border-border"
              />
              <div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) handleProfilePicChange(file);
                    };
                    input.click();
                  }}
                  className="mb-2"
                  disabled={isUploading || isUpdating}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Change Photo"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  JPG, PNG or GIF (max 5MB)
                </p>
              </div>
            </div>

            {/* Cover Photo Section */}
            <div className="space-y-2">
              <Label>Cover Photo</Label>
              <div className="flex items-center space-x-4">
                <div className="w-32 h-20 rounded-lg border-2 border-dashed border-border overflow-hidden bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
                  {(coverPhotoPreview || studentProfile?.coverPhoto) ? (
                    <img
                      className="w-full h-full object-cover"
                      src={coverPhotoPreview || studentProfile?.coverPhoto || ""}
                      alt="Cover preview"
                      onError={(e) => {
                        // Hide image if it fails to load, showing the gradient background
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Camera className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-xs">No cover photo</p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) handleCoverPhotoChange(file);
                      };
                      input.click();
                    }}
                    disabled={isUploading || isUpdating}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {isUploading ? "Uploading..." : "Change Cover"}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG or GIF (max 6MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name field - Read-only for students */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Your full name"
                  disabled={user?.role === 'student'}
                  className={user?.role === 'student' ? 'bg-muted' : ''}
                />
                {user?.role === 'student' && (
                  <p className="text-xs text-muted-foreground">
                    Name can only be changed by school admin
                  </p>
                )}
              </div>

              {/* Phone field - Editable for students */}
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* Grade field - Editable text input for students */}
              <div className="space-y-2">
                <Label htmlFor="edit-grade">Class/Grade</Label>
                <Input
                  id="edit-grade"
                  value={editFormData.grade}
                  onChange={(e) => setEditFormData({ ...editFormData, grade: e.target.value })}
                  placeholder="Grade 10, Class A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sport">Sport</Label>
                <Select 
                  value={editFormData.sport} 
                  onValueChange={(value) => setEditFormData({ ...editFormData, sport: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Soccer">Soccer</SelectItem>
                    <SelectItem value="Basketball">Basketball</SelectItem>
                    <SelectItem value="Tennis">Tennis</SelectItem>
                    <SelectItem value="Swimming">Swimming</SelectItem>
                    <SelectItem value="Track & Field">Track & Field</SelectItem>
                    <SelectItem value="Baseball">Baseball</SelectItem>
                    <SelectItem value="Volleyball">Volleyball</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-position">Position</Label>
                <Select 
                  value={editFormData.position} 
                  onValueChange={(value) => setEditFormData({ ...editFormData, position: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Goalkeeper">Goalkeeper</SelectItem>
                    <SelectItem value="Defender">Defender</SelectItem>
                    <SelectItem value="Midfielder">Midfielder</SelectItem>
                    <SelectItem value="Attacking Midfielder">Attacking Midfielder</SelectItem>
                    <SelectItem value="Forward">Forward</SelectItem>
                    <SelectItem value="Striker">Striker</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="edit-jersey">Jersey Number</Label>
                <Input
                  id="edit-jersey"
                  value={editFormData.roleNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, roleNumber: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea
                id="edit-bio"
                value={editFormData.bio}
                onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                placeholder="Tell everyone about yourself, your achievements, and goals..."
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={isUpdating}
                className="bg-accent hover:bg-accent/90"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Profile Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Profile</DialogTitle>
            <DialogDescription>
              Share {studentProfile?.name}'s profile with others
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
              <AvatarWithFallback
                src={studentProfile?.profilePicUrl}
                alt={studentProfile?.name || 'Profile'}
                fallbackText={studentProfile?.name ? studentProfile.name.slice(0, 2).toUpperCase() : '??'}
                size="md"
              />
              <div>
                <h4 className="font-medium">{studentProfile?.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {studentProfile?.sport} • #{studentProfile?.roleNumber}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={shareProfileNative}
                className="w-full justify-start"
                variant="outline"
              >
                <Share className="w-4 h-4 mr-3" />
                Share via Device
              </Button>

              <Button
                onClick={copyProfileLink}
                className="w-full justify-start"
                variant="outline"
              >
                <Copy className="w-4 h-4 mr-3" />
                Copy Profile Link
              </Button>

              <Button
                onClick={() => {
                  window.open(`https://twitter.com/intent/tweet?text=Check out ${studentProfile?.name}'s sports profile on LockerRoom!&url=${window.location.origin}/profile/${studentProfile?.id}`, '_blank');
                }}
                className="w-full justify-start"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-3" />
                Share on Twitter
              </Button>

              <Button
                onClick={() => {
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${window.location.origin}/profile/${studentProfile?.id}`, '_blank');
                }}
                className="w-full justify-start"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-3" />
                Share on Facebook
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Profile Picture Cropper */}
      <ImageCropper
        isOpen={showCropper}
        onClose={() => setShowCropper(false)}
        onCropComplete={handleCropComplete}
        imageSrc={selectedImage || ""}
      />

      {/* Cover Photo Cropper */}
      <CoverPhotoCropper
        isOpen={showCoverCropper}
        onClose={() => setShowCoverCropper(false)}
        onCropComplete={handleCoverCropComplete}
        imageSrc={selectedCoverImage || ""}
      />

      {/* XEN Watch Submit Modal */}
      <XenWatchSubmitModal
        isOpen={showXenWatchModal}
        onClose={() => setShowXenWatchModal(false)}
      />
      </div>
    </div>
  );
}
