import { useState, useCallback, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import PostCard from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Users, RefreshCw } from "lucide-react";
import type { PostWithDetails } from "@shared/schema";

const PAGE_SIZE = 5; // Smaller page size for admin feeds

interface AdminFeedProps {
  userRole: 'system_admin' | 'school_admin';
  schoolId?: string;
}

export function AdminFeed({ userRole, schoolId }: AdminFeedProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [canRequestNextPage, setCanRequestNextPage] = useState(true);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Progressive feed loading with infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ["/api/posts", userRole, schoolId, PAGE_SIZE],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        let url = `/api/posts?limit=${PAGE_SIZE}&offset=${pageParam}&includeAnnouncements=true`;
        
        if (userRole === 'system_admin') {
          // System admin can view global posts
          url += '&global=true';
        } else if (userRole === 'school_admin' && schoolId) {
          // School admin views posts from their school
          url += `&schoolId=${schoolId}`;
        }
        
        const response = await apiRequest("GET", url);
        const data = await response.json();
        console.log("✅ Admin feed page loaded:", { pageParam, postsCount: data.length });
        return {
          posts: data,
          hasMore: data.length === PAGE_SIZE,
          nextOffset: pageParam + data.length
        };
      } catch (error: any) {
        console.log("❌ Admin feed load error:", error);
        throw error;
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.nextOffset;
    },
    initialPageParam: 0,
    enabled: !!user,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (fc, err: any) => (err?.status === 401 ? false : fc < 3),
  });

  // Scroll detection to gate intersection observer
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 40) setHasUserScrolled(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Intersection Observer for infinite scroll with gating
  useEffect(() => {
    if (!hasNextPage || !observerRef.current || !hasUserScrolled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          !isFetchingNextPage &&
          canRequestNextPage &&
          hasNextPage
        ) {
          setCanRequestNextPage(false);
          fetchNextPage().finally(() => {
            // re-enable after a micro delay to avoid rapid cascades
            setTimeout(() => setCanRequestNextPage(true), 250);
          });
        }
      },
      { threshold: 0.1, rootMargin: "600px 0px 600px 0px" } // prefetch a little before bottom
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, hasUserScrolled, canRequestNextPage]);

  // Flatten all posts from all pages
  const allPosts = data?.pages.flatMap(page => page.posts) || [];

  const handleRefresh = useCallback(() => {
    refetch();
    toast({
      title: "Feed Refreshed",
      description: "Posts have been updated with the latest content.",
    });
  }, [refetch, toast]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading posts...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
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
            onClick={handleRefresh}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (allPosts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="flex flex-col items-center space-y-6">
          <div className="w-24 h-24 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center">
            <Users className="w-12 h-12 text-accent" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">No posts yet</h3>
            <p className="text-muted-foreground max-w-sm">
              {userRole === 'system_admin' 
                ? "No posts have been shared across all schools yet." 
                : "No posts have been shared by students in your school yet."
              }
            </p>
          </div>
          <Button 
            onClick={handleRefresh}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feed Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {userRole === 'system_admin' ? 'Global Feed' : 'School Feed'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {userRole === 'system_admin' 
              ? 'Posts from all schools across the platform'
              : 'Posts from students in your school'
            }
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4 sm:space-y-6">
        {allPosts.map((post, index) => (
          <div key={post.id} className="p-2 sm:p-0">
            <PostCard 
              post={post} 
              priority={index < 2} // Prioritize first 2 posts for instant loading
            />
          </div>
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
        
        {/* Intersection observer trigger */}
        <div ref={observerRef} className="h-4" />
      </div>
    </div>
  );
}
