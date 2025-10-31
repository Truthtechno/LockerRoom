import { useState, useCallback, useEffect, useRef, memo, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import CreatePost from "@/components/posts/create-post";
import PostCard from "@/components/posts/post-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { logout } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, LogOut, Search, Users, User, Plus } from "lucide-react";
import { useLocation } from "wouter";
import type { PostWithDetails } from "@shared/schema";
import { FeedSkeleton } from "@/components/ui/post-skeleton";

const INITIAL_PAGE_SIZE = 2; // Load only 2 posts initially for fast first render
const PAGE_SIZE = 12; // Load 12 posts on subsequent pages for smooth infinite scroll

export default function Feed() {
  const { user, updateUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [canRequestNextPage, setCanRequestNextPage] = useState(true);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Query for student profile to check if user can post
  // IMPORTANT: Include user.id in query key to prevent stale data when switching between students
  const { data: studentProfile, isLoading: isStudentProfileLoading } = useQuery({
    queryKey: ["/api/students/me", user?.id],
    queryFn: () => apiRequest("GET", `/api/students/me`).then(res => res.json()),
    enabled: !!user?.id && user?.role === "student",
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 3;
    }
  });

  // Progressive feed loading with infinite query - Load 2 posts initially, then 12 per page
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    isFetching
  } = useInfiniteQuery({
    queryKey: ["/api/posts/feed"],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        // First page: 2 posts, subsequent pages: 12 posts
        const limit = pageParam === 0 ? INITIAL_PAGE_SIZE : PAGE_SIZE;
        const response = await apiRequest("GET", `/api/posts/feed?limit=${limit}&offset=${pageParam}`);
        const data = await response.json();
        console.log("✅ Feed page loaded:", { pageParam, postsCount: data.posts.length, hasMore: data.hasMore });
        return data;
      } catch (error: any) {
        console.log("❌ Feed load error:", error);
        throw error;
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.nextOffset;
    },
    initialPageParam: 0,
    enabled: !!user,
    staleTime: 30_000, // Increased stale time for better caching
    gcTime: 60_000, // Keep cache for 1 minute
    refetchOnWindowFocus: false,
    refetchOnReconnect: false, // Prevent refetch on reconnect to avoid flickering
    retry: (fc, err: any) => (err?.status === 401 ? false : fc < 3),
  });

  // Flatten all posts from all pages - memoized to prevent unnecessary recalculations
  // Deduplicate posts by ID to prevent repeats (especially from announcements being added to multiple pages)
  const allPosts = useMemo(() => {
    if (!data?.pages) return [];
    
    const seenIds = new Set<string>();
    const uniquePosts: PostWithDetails[] = [];
    
    // Process pages in order, keeping only the first occurrence of each post
    for (const page of data.pages) {
      for (const post of page.posts || []) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id);
          uniquePosts.push(post);
        }
      }
    }
    // Front-end safety: if viewer is a student, only allow their school's announcements
    if (user?.role === 'student') {
      const viewerSchoolId = (user as any)?.schoolId;
      return uniquePosts.filter((p: any) => {
        if (p?.type !== 'announcement') return true;
        return p?.scope === 'school' && p?.schoolId === viewerSchoolId;
      });
    }
    return uniquePosts;
  }, [data, user]);

  // Intersection Observer for infinite scroll - TikTok/Instagram style
  // Loads next batch as user views current posts (preloads ahead for seamless scrolling)
  useEffect(() => {
    // Don't set up observer if no next page or ref not ready
    if (!hasNextPage || !observerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // When the trigger element becomes visible, load next batch
        if (
          entry.isIntersecting &&
          !isFetchingNextPage &&
          canRequestNextPage &&
          hasNextPage
        ) {
          setCanRequestNextPage(false);
          fetchNextPage().finally(() => {
            // Re-enable after a short delay to prevent rapid-fire requests
            setTimeout(() => setCanRequestNextPage(true), 200);
          });
        }
      },
      { 
        // Load when trigger element is 50% visible
        threshold: 0.5,
        // Preload aggressively - start loading when user is still 1200px away from bottom
        // This ensures next posts are ready before user reaches them (TikTok/Instagram style)
        rootMargin: "0px 0px 1200px 0px"
      }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, canRequestNextPage]);

  // Use memoized PostCard directly (it's already memoized in its own file)

  // Query for search results
  const { data: searchResults } = useQuery({
    queryKey: ["/api/search/students", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await apiRequest("GET", `/api/search/students?q=${encodeURIComponent(searchQuery)}&userId=${user?.id}`);
      return response.json();
    },
    enabled: !!searchQuery && searchQuery.length > 2 && !!user,
    staleTime: 30 * 1000,
  });

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSearchResults(value.length > 0);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setShowSearchResults(false);
  };

  // Refresh posts after successful creation
  const handlePostCreated = (newPost?: PostWithDetails) => {
    // The mutation already handles optimistic updates and cache updates,
    // so we just need to show a success message here
    // No need to manually update the cache as it's already done in the mutation
    
    toast({
      title: "Post Created",
      description: "Your post has been shared successfully!",
    });
  };

  // Loading state - only show loader when auth is loading
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if no user after auth is loaded
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        

        {/* Feed Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Search Bar */}
            <div className="mb-6 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search for student athletes..."
                  className="pl-10 pr-4"
                  data-testid="search-input"
                />
                {searchQuery && (
                  <Button
                    onClick={clearSearch}
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 px-2"
                    data-testid="clear-search"
                  >
                    ✕
                  </Button>
                )}
              </div>

              {/* Search Results */}
              {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {searchQuery.length <= 2 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Type at least 3 characters to search...
                    </div>
                  ) : !searchResults || searchResults.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      No student athletes found matching "{searchQuery}"
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {searchResults.map((student: any) => (
                        <SearchResultItem key={student.id} student={student} onClearSearch={clearSearch} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Create Post Component */}
            {user.role === "student" && (
              isStudentProfileLoading ? null : studentProfile ? (
                <CreatePost onPostCreated={handlePostCreated} />
              ) : !studentProfile ? (
                <div className="bg-card border border-border rounded-xl p-6 mb-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Complete Your Profile</h3>
                    <p className="text-muted-foreground mb-4">
                      You need to create your student profile before you can share posts.
                    </p>
                    <Button 
                      onClick={() => setLocation("/profile")}
                      className="bg-accent hover:bg-accent/90"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Create Profile
                    </Button>
                  </div>
                </div>
              ) : null
            )}
            
            {/* Posts Feed */}
            {isLoading && allPosts.length === 0 ? (
              <FeedSkeleton count={2} />
            ) : error ? (
              <div className="text-center py-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">Unable to load posts</h3>
                    <p className="text-muted-foreground">
                      {error?.message || "Something went wrong. Please try again."}
                    </p>
                  </div>
                  <Button 
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/posts/feed"] })}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : allPosts && allPosts.length > 0 ? (
              <div className="space-y-6">
                {allPosts.map((post, index) => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    priority={index < 2}
                    skipCacheQuery={true}
                  />
                ))}
                
                {/* Loading indicator for next page */}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading more posts...</span>
                  </div>
                )}
                
                {/* End of feed message */}
                {!hasNextPage && allPosts.length > 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>You've reached the end of the feed!</p>
                  </div>
                )}
                
                {/* Intersection observer trigger - positioned to preload before user reaches it */}
                {hasNextPage && (
                  <div ref={observerRef} className="h-4 w-full" aria-hidden="true" />
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="flex flex-col items-center space-y-6">
                  {/* Page Title for Empty State */}
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-foreground">Feed</h1>
                    <p className="text-muted-foreground">Discover and connect with student athletes</p>
                  </div>
                  
                  <div className="w-24 h-24 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center">
                    <Users className="w-12 h-12 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">No posts yet</h3>
                    <p className="text-muted-foreground max-w-sm">
                      {user.role === "student" 
                        ? "Share your athletic journey and connect with your teammates!" 
                        : "Follow some student athletes to see their amazing content and achievements!"
                      }
                    </p>
                  </div>
                  {user.role === "student" && (
                    <Button 
                      onClick={() => setLocation("/create")}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 text-lg btn-enhanced"
                      size="lg"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Your First Post
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

// Search Result Item Component
function SearchResultItem({ student, onClearSearch }: { student: any; onClearSearch: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(student.isFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollow = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to follow student athletes.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const response = await apiRequest(method, `/api/students/${student.id}/follow`);
      const data = await response.json();

      if (data.success) {
        setIsFollowing(data.isFollowing);
        // Invalidate following queries to update UI
        queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "following"] });
        toast({
          title: data.isFollowing ? "Following" : "Unfollowed",
          description: `You are ${data.isFollowing ? 'now following' : 'no longer following'} ${student.user.name}`,
        });
      } else {
        throw new Error(data.error?.message || 'Follow request failed');
      }
    } catch (error: any) {
      toast({
        title: "Unable to update follow status",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 hover:bg-muted/50 border-b border-border last:border-b-0 cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AvatarWithFallback 
            src={student.profilePicUrl}
            alt={student.user.name}
            size="lg"
          />
          <div>
            <h3 className="font-medium text-foreground">{student.user.name}</h3>
            <p className="text-sm text-muted-foreground">
              {student.position || 'Player'} • #{student.roleNumber} • {student.followersCount} followers
            </p>
            {student.school && (
              <p className="text-xs text-muted-foreground">{student.school.name}</p>
            )}
          </div>
        </div>
        <Button
          onClick={handleFollow}
          disabled={isLoading}
          variant={isFollowing ? "outline" : "default"}
          size="sm"
          className={isFollowing ? "bg-background hover:bg-muted" : "bg-accent hover:bg-accent/90"}
          data-testid={`follow-button-${student.id}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isFollowing ? (
            "Unfollow"
          ) : (
            "Follow"
          )}
        </Button>
      </div>
    </div>
  );
}