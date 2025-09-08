import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import PostCard from "@/components/posts/post-card";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Bookmark } from "lucide-react";
import type { PostWithDetails } from "@shared/schema";

export default function Saved() {
  const { user } = useAuth();
  
  const { data: savedPosts, isLoading, error } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts/saved", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch(`/api/users/${user.id}/saved-posts`);
      return response.json();
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
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
                <p className="text-destructive">Failed to load saved posts</p>
              </div>
            ) : savedPosts && savedPosts.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-6">
                  {savedPosts.length} saved post{savedPosts.length !== 1 ? 's' : ''}
                </p>
                {savedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Bookmark className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No saved posts yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  When you save posts, they'll appear here so you can easily find them later.
                  Tap the bookmark icon on any post to save it.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}