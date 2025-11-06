import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Users, UserCheck, UserX } from "lucide-react";

interface FollowingStudent {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  sport: string;
  roleNumber: string;
  position: string;
  profilePicUrl?: string;
  profilePic?: string;
  school?: {
    name: string;
  };
  followersCount: number;
}

export default function Following() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: followingStudents, isLoading, error, refetch } = useQuery<FollowingStudent[]>({
    queryKey: ["/api/users", user?.id, "following"],
    queryFn: async () => {
      if (!user) return [];
      const response = await apiRequest("GET", `/api/users/${user.id}/following`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to fetch following list" }));
        const error = new Error(errorData.message || "Failed to fetch following list");
        console.error('❌ Following page fetch error:', errorData);
        throw error;
      }
      const data = await response.json();
      console.log('✅ Following page loaded:', Array.isArray(data) ? data.length : 0, 'students');
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
    retry: 2,
    staleTime: 0, // Always refetch to get latest data
    refetchOnWindowFocus: true,
  });

  const unfollowMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const response = await apiRequest("DELETE", `/api/students/${studentId}/follow`);
      return response.json();
    },
    onSuccess: (data, studentId) => {
      // Optimistically remove from list immediately
      queryClient.setQueryData<FollowingStudent[]>(["/api/users", user?.id, "following"], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(s => s.id !== studentId);
      });
      
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "following"] });
      
      // Invalidate profile queries to update follow buttons elsewhere
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      
      const student = followingStudents?.find(s => s.id === studentId);
      toast({
        title: "Unfollowed",
        description: `You are no longer following ${student?.user?.name || student?.name || 'this player'}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to unfollow player",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUnfollow = (studentId: string) => {
    unfollowMutation.mutate(studentId);
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
        
        {/* Header */}
        <div className="bg-card border-b border-border px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Following</h1>
                <p className="text-muted-foreground">Students you're following</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">Unable to load following list</h3>
                    <p className="text-muted-foreground">
                      {error?.message || "Something went wrong. Please try again."}
                    </p>
                  </div>
                </div>
              </div>
            ) : followingStudents && followingStudents.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-6">
                  Following {followingStudents.length} student athlete{followingStudents.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {followingStudents.map((student) => (
                    <div key={student.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex flex-col">
                        <div className="flex items-start justify-between mb-4">
                          <Link href={`/profile/${student.id}`} className="flex items-center space-x-3 flex-1">
                            <AvatarWithFallback 
                              src={student.profilePicUrl || student.profilePic}
                              alt={student?.user?.name || student.name}
                              size="lg"
                              className="cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-foreground truncate">{student?.user?.name || student.name}</h3>
                              {student.school && (
                                <p className="text-xs text-muted-foreground truncate">{student.school.name}</p>
                              )}
                            </div>
                          </Link>
                        </div>
                        <div className="space-y-2 mb-4">
                          {(student.sport || student.roleNumber || student.position) && (
                            <p className="text-sm text-muted-foreground">
                              {[student.sport, student.roleNumber && `#${student.roleNumber}`, student.position].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => handleUnfollow(student.id)}
                          disabled={unfollowMutation.isPending}
                          variant="outline"
                          className="w-full bg-background hover:bg-destructive hover:text-destructive-foreground"
                          data-testid={`unfollow-${student.id}`}
                        >
                          {unfollowMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <UserX className="w-4 h-4 mr-2" />
                          )}
                          Unfollow
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="max-w-md w-full bg-card border border-border rounded-2xl p-12 text-center shadow-lg">
                  <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users className="w-10 h-10 text-accent" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">Start Following Students</h3>
                  <p className="text-muted-foreground mb-8 leading-relaxed">
                    Discover amazing student athletes and follow them to see their posts, achievements, and updates in your feed.
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/search'}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 text-base font-medium"
                    size="lg"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    Discover Athletes
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