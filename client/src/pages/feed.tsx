import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import CreatePost from "@/components/posts/create-post";
import PostCard from "@/components/posts/post-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/auth";
import { Loader2, LogOut, Search, Users } from "lucide-react";
import { useLocation } from "wouter";
import type { PostWithDetails } from "@shared/schema";

export default function Feed() {
  const { data: posts, isLoading, error } = useQuery<PostWithDetails[]>({
    queryKey: ["/api/posts"],
  });
  const { user, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const { data: searchResults } = useQuery({
    queryKey: ["/api/search/students", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/search/students?q=${encodeURIComponent(searchQuery)}&userId=${user?.id}`);
      return response.json();
    },
    enabled: !!searchQuery && searchQuery.length > 2,
  });

  const handleLogout = () => {
    logout();
    updateUser(null);
    setLocation("/login");
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSearchResults(value.length > 0);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setShowSearchResults(false);
  };

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
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Button
                onClick={handleLogout}
                variant="outline"
                size="icon"
                className="w-8 h-8"
                data-testid="mobile-header-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
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

// Search Result Item Component
function SearchResultItem({ student, onClearSearch }: { student: any; onClearSearch: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
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
      const response = await fetch(`/api/students/${student.id}/follow`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        toast({
          title: isFollowing ? "Unfollowed" : "Following",
          description: `You are ${isFollowing ? 'no longer following' : 'now following'} ${student.user.name}`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update follow status",
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
          <img
            className="h-12 w-12 rounded-full"
            src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"
            alt={student.user.name}
          />
          <div>
            <h3 className="font-medium text-foreground">{student.user.name}</h3>
            <p className="text-sm text-muted-foreground">
              {student.sport} • #{student.roleNumber} • {student.followersCount} followers
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
