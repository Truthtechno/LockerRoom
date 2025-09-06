import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import CreatePost from "@/components/posts/create-post";
import PostCard from "@/components/posts/post-card";
import { Loader2 } from "lucide-react";
import type { PostWithDetails } from "@shared/schema";

export default function Feed() {
  const { data: posts, isLoading, error } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Mobile Header */}
        <div className="lg:hidden bg-card border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">LR</span>
              </div>
              <span className="ml-2 text-lg font-bold text-foreground">LockerRoom</span>
            </div>
          </div>
        </div>

        {/* Feed Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <CreatePost />
            
            {/* Posts Feed */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-destructive">Failed to load posts</p>
              </div>
            ) : posts && posts.length > 0 ? (
              posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
