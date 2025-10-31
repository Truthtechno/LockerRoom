import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import PostCard from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Bookmark } from "lucide-react";
import type { PostWithDetails } from "@shared/schema";

export default function Saved() {
  const { user } = useAuth();
  
  const { data: savedPosts, isLoading, error } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/users", user?.id, "saved-posts"],
    queryFn: async () => {
      if (!user) return [];
      const response = await apiRequest("GET", `/api/users/${user.id}/saved-posts`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to fetch saved posts`);
      }
      return response.json();
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Header */}
        <div className="bg-card border-b border-border px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                <Bookmark className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Saved Posts</h1>
                <p className="text-muted-foreground">Posts you've bookmarked to view later</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <Bookmark className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">Unable to load saved posts</h3>
                    <p className="text-muted-foreground">
                      {error?.message || "Something went wrong. Please try again."}
                    </p>
                  </div>
                </div>
              </div>
            ) : savedPosts && savedPosts.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-6">
                  {savedPosts.length} saved post{savedPosts.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-6">
                  {savedPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="flex flex-col items-center space-y-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center">
                    <Bookmark className="w-12 h-12 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">No saved posts yet</h3>
                    <p className="text-muted-foreground max-w-sm">
                      Save posts you love to easily find them later. Tap the bookmark icon on any post to save it here.
                    </p>
                  </div>
                  <Button 
                    onClick={() => window.location.href = '/feed'}
                    variant="outline"
                    className="px-8 py-3 text-lg"
                    size="lg"
                  >
                    <Bookmark className="w-5 h-5 mr-2" />
                    Browse Posts
                  </Button>
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