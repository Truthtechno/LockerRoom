import { useState, useEffect, memo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, UserPlus, UserMinus, MapPin } from "lucide-react";
import type { StudentSearchResult } from "@shared/schema";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading } = useQuery<StudentSearchResult[]>({
    queryKey: ["/api/search/students", debouncedQuery, user?.id],
    enabled: debouncedQuery.length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        ...(user?.id && { userId: user.id })
      });
      const response = await fetch(`/api/search/students?${params}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    staleTime: 30_000, // Cache search results for 30 seconds
    retry: 2,
  });

  const followMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'follow' | 'unfollow' }) => {
      if (action === 'follow') {
        return apiRequest("POST", `/api/users/${userId}/follow`);
      } else {
        return apiRequest("DELETE", `/api/users/${userId}/follow`);
      }
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.action === 'follow' ? 'Following' : 'Unfollowed',
        description: variables.action === 'follow' 
          ? 'You are now following this player!'
          : 'You have unfollowed this player.',
      });
      
      // Invalidate search results to update follow status
      queryClient.invalidateQueries({ queryKey: ["/api/search/students"] });
    },
    onError: (error: any) => {
      toast({
        title: "Action Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFollow = (userId: string, isCurrentlyFollowing: boolean) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to follow players.",
        variant: "destructive",
      });
      return;
    }

    followMutation.mutate({
      userId,
      action: isCurrentlyFollowing ? 'unfollow' : 'follow'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>

        {/* Search Content */}
        <main className="flex-1">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Search Header */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <Search className="w-8 h-8 text-primary mr-3" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Search Athletes</h1>
                  <p className="text-muted-foreground">Find and follow student athletes</p>
                </div>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by name, sport, or position..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 py-3 text-lg"
                  data-testid="search-input"
                />
              </div>
            </div>

            {/* Search Results */}
            {debouncedQuery.length >= 2 && (
              <div className="space-y-6">
                {isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-3 mb-4">
                            <Skeleton className="w-12 h-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="flex space-x-2">
                              <Skeleton className="h-6 w-16" />
                              <Skeleton className="h-6 w-20" />
                            </div>
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                          <Skeleton className="h-3 w-full mb-2" />
                          <Skeleton className="h-3 w-4/5 mb-4" />
                          <Skeleton className="h-9 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {searchResults.map((student) => (
                      <Card 
                        key={student.id} 
                        className="hover:shadow-lg transition-shadow cursor-pointer group" 
                        data-testid={`search-result-${student.id}`}
                        onClick={() => navigate(`/profile/${student.user.id}`)}
                      >
                        <CardContent className="p-6">
                            {/* Profile Picture and Basic Info */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <AvatarWithFallback 
                                  src={student.profilePicUrl || student.profilePic}
                                  alt={student.user.name}
                                  size="lg"
                                />
                                <div>
                                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{student.user.name}</h3>
                                </div>
                              </div>
                            </div>

                          {/* Sports Info */}
                          <div className="space-y-2 mb-4">
                            {student.sport && (
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary">{student.sport}</Badge>
                                {student.position && (
                                  <Badge variant="outline">{student.position}</Badge>
                                )}
                              </div>
                            )}
                            
                            {student.school && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3 mr-1" />
                                {student.school.name}
                              </div>
                            )}
                          </div>

                          {/* Bio Preview */}
                          {student.bio && (
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                              {student.bio}
                            </p>
                          )}

                            {/* Follow Button */}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFollow(student.userId, student.isFollowing || false);
                              }}
                              disabled={followMutation.isPending}
                              variant={student.isFollowing ? "outline" : "default"}
                              className={`w-full ${!student.isFollowing ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}`}
                              data-testid={`follow-button-${student.id}`}
                            >
                              {followMutation.isPending ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                  Processing...
                                </div>
                              ) : student.isFollowing ? (
                                <>
                                  <UserMinus className="w-4 h-4 mr-2" />
                                  Unfollow
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Follow
                                </>
                              )}
                            </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No athletes found</h3>
                    <p className="text-muted-foreground">
                      Try searching with different keywords like sport or school name
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {debouncedQuery.length < 2 && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Start searching</h3>
                <p className="text-muted-foreground">
                  Enter at least 2 characters to search for student athletes
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