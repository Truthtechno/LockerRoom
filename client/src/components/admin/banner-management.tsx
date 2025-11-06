import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo } from "@/lib/timeAgo";
import { Loader2, AlertCircle, Edit, Trash2, MoreHorizontal, CheckCircle, XCircle, Info, AlertTriangle, Megaphone } from "lucide-react";
import { BannerModal } from "@/components/ui/banner-modal";
import { getRoleDisplayName } from "@/lib/role-display";

export type Banner = {
  id: string;
  title: string;
  message: string;
  category: 'info' | 'warning' | 'success' | 'error' | 'announcement';
  targetRoles: string[];
  targetSchoolIds?: string[] | null; // Array of school IDs (only applies when school_admin is in target_roles). NULL means all schools.
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  priority: number;
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
};

export function BannerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);

  // Fetch banners
  const { data: bannersData, isLoading, error } = useQuery({
    queryKey: ["/api/system-admin/banners"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/system-admin/banners");
      const data = await response.json();
      return data;
    },
  });

  // Delete banner mutation
  const deleteBannerMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      const response = await apiRequest("DELETE", `/api/system-admin/banners/${bannerId}`);
      if (!response.ok) throw new Error('Failed to delete banner');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Banner Deleted",
        description: "The banner has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners/active"] });
      setDeletingBannerId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete banner. Please try again.",
        variant: "destructive",
      });
      setDeletingBannerId(null);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ bannerId, isActive }: { bannerId: string; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/system-admin/banners/${bannerId}`, {
        isActive: !isActive,
      });
      if (!response.ok) throw new Error('Failed to update banner');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Banner Updated",
        description: "Banner status updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners/active"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update banner. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setIsEditModalOpen(true);
  };

  const handleDelete = (banner: Banner) => {
    if (window.confirm(`Are you sure you want to delete "${banner.title}"? This action cannot be undone.`)) {
      setDeletingBannerId(banner.id);
      deleteBannerMutation.mutate(banner.id);
    }
  };

  const handleToggleActive = (banner: Banner) => {
    toggleActiveMutation.mutate({ bannerId: banner.id, isActive: banner.isActive });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'info': return <Info className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'success': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <XCircle className="w-4 h-4" />;
      case 'announcement': return <AlertCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-800';
      case 'success': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-800';
      case 'error': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-800';
      case 'announcement': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-100 dark:border-purple-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'scout_admin': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'school_admin': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      case 'xen_scout': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRoleName = (role: string) => {
    return getRoleDisplayName(role);
  };

  const isCurrentlyActive = (banner: Banner) => {
    if (!banner.isActive) return false;
    const now = new Date();
    if (banner.startDate && new Date(banner.startDate) > now) return false;
    if (banner.endDate && new Date(banner.endDate) < now) return false;
    return true;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading banners...</span>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load banners';
    return (
      <Card>
        <CardContent className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load Banners</h3>
          <p className="text-muted-foreground mb-4">
            {errorMessage}
          </p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
          >
            Reload Page
          </Button>
        </CardContent>
      </Card>
    );
  }

  const banners = bannersData?.banners || [];

  return (
    <div className="space-y-6">
      {/* Management Section Header - matches AnnouncementManagement structure */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Manage Banners</h2>
          <p className="text-muted-foreground text-sm">
            View, edit, and delete your banners
          </p>
        </div>
        <Badge variant="outline" className="text-sm self-start sm:self-auto">
          {banners.length} banner{banners.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {banners.length === 0 ? (
        <Card>
          <CardContent className="text-center p-8">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Banners Yet</h3>
            <p className="text-muted-foreground">
              You haven't created any banners yet. Create your first banner to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {banners.map((banner: Banner) => (
            <Card 
              key={banner.id} 
              className={`hover:shadow-md transition-shadow ${!banner.isActive ? 'opacity-60' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={`${getCategoryColor(banner.category)} flex items-center gap-1`}>
                        {getCategoryIcon(banner.category)}
                        {banner.category.charAt(0).toUpperCase() + banner.category.slice(1)}
                      </Badge>
                      <Badge variant={banner.isActive ? "default" : "secondary"}>
                        {banner.isActive ? (isCurrentlyActive(banner) ? 'Active' : 'Scheduled') : 'Inactive'}
                      </Badge>
                      {banner.priority > 0 && (
                        <Badge variant="outline">
                          Priority: {banner.priority}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{banner.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {banner.message}
                    </CardDescription>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {banner.targetRoles.map((role) => (
                        <Badge key={role} variant="secondary" className={getRoleBadgeColor(role)}>
                          {formatRoleName(role)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={deletingBannerId === banner.id}>
                        {deletingBannerId === banner.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="w-4 h-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(banner)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(banner)}>
                        {banner.isActive ? (
                          <>
                            <XCircle className="w-4 h-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(banner)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    {banner.startDate && (
                      <div>
                        Starts: {new Date(banner.startDate).toLocaleDateString()}
                      </div>
                    )}
                    {banner.endDate && (
                      <div>
                        Ends: {new Date(banner.endDate).toLocaleDateString()}
                      </div>
                    )}
                    {!banner.startDate && !banner.endDate && (
                      <div>No expiration date</div>
                    )}
                  </div>
                  <div className="text-xs">
                    Created {timeAgo(banner.createdAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Banner Modal */}
      {editingBanner && (
        <BannerModal
          banner={editingBanner}
          open={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open);
            if (!open) setEditingBanner(null);
          }}
        />
      )}
    </div>
  );
}

