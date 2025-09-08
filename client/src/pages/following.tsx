import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
  school?: {
    name: string;
  };
  followersCount: number;
}

export default function Following() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: followingStudents, isLoading, error } = useQuery<FollowingStudent[]>({
    queryKey: ["/api/users/following", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch(`/api/users/${user.id}/following`);
      return response.json();
    },
    enabled: !!user,
  });

  const unfollowMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await fetch(`/api/students/${studentId}/follow`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
    },
    onSuccess: (_, studentId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/following"] });
      const student = followingStudents?.find(s => s.id === studentId);
      toast({
        title: "Unfollowed",
        description: `You are no longer following ${student?.user.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unfollow student",
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
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Following</h1>
                <p className="text-muted-foreground">Student athletes you're following</p>
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
                <p className="text-destructive">Failed to load following list</p>
              </div>
            ) : followingStudents && followingStudents.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-6">
                  Following {followingStudents.length} student athlete{followingStudents.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-4">
                  {followingStudents.map((student) => (
                    <div key={student.id} className="bg-card border border-border rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <img
                            className="h-16 w-16 rounded-full"
                            src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400"
                            alt={student.user.name}
                          />
                          <div>
                            <h3 className="font-semibold text-foreground text-lg">{student.user.name}</h3>
                            <p className="text-muted-foreground">
                              {student.sport} • #{student.roleNumber} • {student.position}
                            </p>
                            {student.school && (
                              <p className="text-sm text-muted-foreground">{student.school.name}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {student.followersCount} followers
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleUnfollow(student.id)}
                          disabled={unfollowMutation.isPending}
                          variant="outline"
                          className="bg-background hover:bg-destructive hover:text-destructive-foreground"
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
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Not following anyone yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Search for student athletes and follow them to see their posts and updates.
                  You can search from the main feed.
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