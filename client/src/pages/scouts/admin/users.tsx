import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  Users, 
  Plus, 
  UserPlus, 
  Mail, 
  Eye,
  Shield,
  User
} from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { timeAgo } from "@/lib/timeAgo";
import { useAuth } from "@/hooks/use-auth";

interface Scout {
  id: string;
  xenId: string;
  name: string;
  profilePicUrl?: string;
  createdAt: string;
  users?: {
    email: string;
    role: string;
  };
}

export default function ScoutUsersManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    xenId: '',
    profilePicUrl: '',
    role: 'xen_scout' as 'xen_scout' | 'scout_admin'
  });

  // Fetch scouts
  const { data: scouts, isLoading, error } = useQuery<Scout[]>({
    queryKey: ["/api/admin/scouts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/scouts");
      if (!response.ok) throw new Error('Failed to fetch scouts');
      const data = await response.json();
      return data.scouts;
    },
    retry: 3
  });

  // Create scout mutation
  const createScoutMutation = useMutation({
    mutationFn: async (data: typeof createFormData) => {
      const endpoint = data.role === 'scout_admin' ? '/api/admin/scout-admins' : '/api/admin/scouts';
      const response = await apiRequest("POST", endpoint, data);
      if (!response.ok) throw new Error('Failed to create scout');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scout Created",
        description: "The scout has been created successfully.",
      });
      setShowCreateDialog(false);
      setCreateFormData({
        name: '',
        email: '',
        xenId: '',
        profilePicUrl: '',
        role: 'xen_scout'
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scouts"] });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create scout. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCreateScout = () => {
    if (!createFormData.name || !createFormData.email || !createFormData.xenId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createScoutMutation.mutate(createFormData);
  };

  const isSystemAdmin = user?.role === 'system_admin';
  const isScoutAdmin = user?.role === 'scout_admin';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="text-destructive mb-4">
                Failed to load scouts
              </div>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Manage Scouts</h1>
              <p className="text-muted-foreground">
                Create and manage XEN Scouts and Scout Admins
              </p>
            </div>
            
            {/* Create Scout Button */}
            {(isSystemAdmin || isScoutAdmin) && (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Scout
                  </Button>
                </DialogTrigger>
              </Dialog>
            )}
          </div>

          {/* Create Scout Dialog */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Scout</DialogTitle>
                <DialogDescription>
                  Add a new XEN Scout or Scout Admin to the system
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="xenId">XEN ID</Label>
                  <Input
                    id="xenId"
                    value={createFormData.xenId}
                    onChange={(e) => setCreateFormData({ ...createFormData, xenId: e.target.value })}
                    placeholder="Enter unique XEN ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profilePicUrl">Profile Picture URL (Optional)</Label>
                  <Input
                    id="profilePicUrl"
                    value={createFormData.profilePicUrl}
                    onChange={(e) => setCreateFormData({ ...createFormData, profilePicUrl: e.target.value })}
                    placeholder="Enter profile picture URL"
                  />
                </div>

                {isSystemAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      value={createFormData.role}
                      onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value as 'xen_scout' | 'scout_admin' })}
                      className="w-full p-2 border border-border rounded-md bg-background"
                    >
                      <option value="xen_scout">XEN Scout</option>
                      <option value="scout_admin">Scout Admin</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    disabled={createScoutMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateScout}
                    disabled={createScoutMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createScoutMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create Scout
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Scouts List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scouts?.map((scout) => (
              <Card key={scout.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      {scout.profilePicUrl ? (
                        <img
                          src={scout.profilePicUrl}
                          alt={scout.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{scout.name}</CardTitle>
                      <CardDescription className="flex items-center space-x-2">
                        <span>ID: {scout.xenId}</span>
                        {scout.users?.role === 'scout_admin' && (
                          <Shield className="w-4 h-4 text-yellow-500" />
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3">
                    {scout.users?.email && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{scout.users.email}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-muted-foreground">Role:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        scout.users?.role === 'scout_admin' 
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {scout.users?.role === 'scout_admin' ? 'Scout Admin' : 'XEN Scout'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-muted-foreground">Created:</span>
                      <span>{timeAgo(scout.createdAt)}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {scouts?.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Scouts Found</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first scout to start managing XEN Watch submissions.
                </p>
                {(isSystemAdmin || isScoutAdmin) && (
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Scout
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
