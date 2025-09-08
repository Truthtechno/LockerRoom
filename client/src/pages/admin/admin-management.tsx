import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Shield, UserPlus, Crown, Settings, Trash2, Edit, Users, Lock } from "lucide-react";
import { useLocation } from "wouter";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId?: string;
  createdAt: string;
};

type AdminRole = {
  id: string;
  userId: string;
  role: string;
  permissions: string[];
  assignedBy: string;
  createdAt: string;
};

type AdminRoleWithUser = AdminRole & {
  user: User;
};

const adminRoleFormSchema = z.object({
  userId: z.string().min(1, "User is required"),
  role: z.enum(["super_admin", "system_admin", "moderator"]),
  permissions: z.array(z.string()).min(1, "At least one permission is required"),
});

type AdminRoleFormData = z.infer<typeof adminRoleFormSchema>;

const AVAILABLE_PERMISSIONS = [
  { id: "manage_schools", label: "Manage Schools", description: "Create, approve, and manage school accounts" },
  { id: "manage_users", label: "Manage Users", description: "View and manage user accounts" },
  { id: "manage_content", label: "Manage Content", description: "Moderate posts and user-generated content" },
  { id: "view_analytics", label: "View Analytics", description: "Access platform analytics and reports" },
  { id: "manage_settings", label: "Manage Settings", description: "Configure platform-wide settings" },
  { id: "manage_admins", label: "Manage Administrators", description: "Add and remove administrator roles" },
  { id: "financial_access", label: "Financial Access", description: "View revenue and financial reports" },
  { id: "system_maintenance", label: "System Maintenance", description: "Perform system maintenance tasks" },
];

const ROLE_PRESETS = {
  super_admin: AVAILABLE_PERMISSIONS.map(p => p.id),
  system_admin: ["manage_schools", "manage_users", "manage_content", "view_analytics", "manage_settings"],
  moderator: ["manage_content", "view_analytics"],
};

export default function AdminManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);

  const adminRoleForm = useForm<AdminRoleFormData>({
    resolver: zodResolver(adminRoleFormSchema),
    defaultValues: {
      permissions: [],
    },
  });

  const { data: adminRoles, isLoading: rolesLoading } = useQuery<AdminRole[]>({
    queryKey: ["/api/admin/roles"],
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createAdminRoleMutation = useMutation({
    mutationFn: async (data: AdminRoleFormData) => {
      return apiRequest("/api/admin/roles", {
        method: "POST",
        body: {
          ...data,
          assignedBy: user?.id,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      adminRoleForm.reset();
      setShowAddAdmin(false);
      toast({
        title: "Admin Role Created",
        description: "New administrator role has been assigned successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create admin role.",
        variant: "destructive",
      });
    },
  });

  const updateAdminRoleMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<AdminRole> }) => {
      return apiRequest(`/api/admin/roles/${userId}`, {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setEditingRole(null);
      toast({
        title: "Admin Role Updated",
        description: "Administrator role has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update admin role.",
        variant: "destructive",
      });
    },
  });

  const deleteAdminRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/roles/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      toast({
        title: "Admin Role Removed",
        description: "Administrator role has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove admin role.",
        variant: "destructive",
      });
    },
  });

  const onCreateAdminRole = (data: AdminRoleFormData) => {
    createAdminRoleMutation.mutate(data);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Badge variant="destructive" className="bg-red-600"><Crown className="w-3 h-3 mr-1" />Super Admin</Badge>;
      case "system_admin":
        return <Badge variant="default" className="bg-blue-600"><Shield className="w-3 h-3 mr-1" />System Admin</Badge>;
      case "moderator":
        return <Badge variant="secondary" className="bg-green-600 text-white"><Settings className="w-3 h-3 mr-1" />Moderator</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getPermissionName = (permissionId: string) => {
    return AVAILABLE_PERMISSIONS.find(p => p.id === permissionId)?.label || permissionId;
  };

  const adminRolesWithUsers: AdminRoleWithUser[] = adminRoles?.map(role => ({
    ...role,
    user: allUsers?.find(u => u.id === role.userId) || {
      id: role.userId,
      name: "Unknown User",
      email: "unknown@example.com",
      role: "unknown",
      createdAt: new Date().toISOString(),
    },
  })) || [];

  const availableUsers = allUsers?.filter(u => 
    u.role === "system_admin" && !adminRoles?.some(r => r.userId === u.id)
  ) || [];

  const isLoading = rolesLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/system-admin")}
                className="mr-4"
                data-testid="back-to-admin"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Administrator Management</h1>
                <p className="text-sm text-muted-foreground">Manage administrator roles and permissions</p>
              </div>
            </div>
            
            <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
              <DialogTrigger asChild>
                <Button className="gold-gradient text-accent-foreground" data-testid="button-add-admin">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Administrator
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add Administrator Role</DialogTitle>
                  <DialogDescription>
                    Assign administrator privileges to a user with specific permissions.
                  </DialogDescription>
                </DialogHeader>
                <Form {...adminRoleForm}>
                  <form onSubmit={adminRoleForm.handleSubmit(onCreateAdminRole)} className="space-y-6">
                    <FormField
                      control={adminRoleForm.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select User</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-user">
                                <SelectValue placeholder="Choose a user to make admin" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableUsers.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name} ({user.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={adminRoleForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Administrator Role</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Auto-set permissions based on role preset
                              const presetPermissions = ROLE_PRESETS[value as keyof typeof ROLE_PRESETS] || [];
                              adminRoleForm.setValue("permissions", presetPermissions);
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-admin-role">
                                <SelectValue placeholder="Select administrator role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="super_admin">Super Administrator</SelectItem>
                              <SelectItem value="system_admin">System Administrator</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={adminRoleForm.control}
                      name="permissions"
                      render={() => (
                        <FormItem>
                          <FormLabel>Permissions</FormLabel>
                          <div className="grid grid-cols-1 gap-3 mt-2">
                            {AVAILABLE_PERMISSIONS.map((permission) => (
                              <FormField
                                key={permission.id}
                                control={adminRoleForm.control}
                                name="permissions"
                                render={({ field }) => (
                                  <FormItem key={permission.id} className="flex flex-row items-start space-x-3 space-y-0 border border-border rounded-lg p-3">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(permission.id)}
                                        onCheckedChange={(checked) => {
                                          const updatedPermissions = checked
                                            ? [...(field.value || []), permission.id]
                                            : (field.value || []).filter(p => p !== permission.id);
                                          field.onChange(updatedPermissions);
                                        }}
                                        data-testid={`checkbox-${permission.id}`}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel className="text-sm font-medium">
                                        {permission.label}
                                      </FormLabel>
                                      <p className="text-xs text-muted-foreground">
                                        {permission.description}
                                      </p>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button 
                        type="submit" 
                        disabled={createAdminRoleMutation.isPending}
                        data-testid="button-submit-admin"
                      >
                        {createAdminRoleMutation.isPending ? "Creating..." : "Create Administrator"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Administrators</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminRoles?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {adminRoles?.filter(r => r.role === "super_admin").length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableUsers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Administrators List */}
        {adminRolesWithUsers.length > 0 ? (
          <div className="space-y-6">
            {adminRolesWithUsers.map((adminRole) => (
              <Card key={adminRole.id} className="overflow-hidden" data-testid={`admin-${adminRole.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{adminRole.user.name}</CardTitle>
                        <CardDescription>{adminRole.user.email}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getRoleBadge(adminRole.role)}
                      <div className="text-xs text-muted-foreground">
                        Since {new Date(adminRole.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center">
                        <Lock className="w-4 h-4 mr-2" />
                        Permissions ({adminRole.permissions.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {adminRole.permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {getPermissionName(permission)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRole(adminRole)}
                        data-testid={`button-edit-${adminRole.id}`}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Role
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAdminRoleMutation.mutate(adminRole.userId)}
                        disabled={deleteAdminRoleMutation.isPending || adminRole.userId === user?.id}
                        data-testid={`button-remove-${adminRole.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deleteAdminRoleMutation.isPending ? "Removing..." : "Remove"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Administrators</h3>
            <p className="text-muted-foreground mb-6">
              No administrator roles have been assigned yet.
            </p>
            <Button 
              onClick={() => setShowAddAdmin(true)}
              className="gold-gradient text-accent-foreground"
              data-testid="button-add-first-admin"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add First Administrator
            </Button>
          </div>
        )}

        {/* Edit Role Dialog */}
        {editingRole && (
          <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Administrator Role</DialogTitle>
                <DialogDescription>
                  Update permissions for {adminRolesWithUsers.find(r => r.id === editingRole.id)?.user.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Current Role</Label>
                  <div className="mt-1">{getRoleBadge(editingRole.role)}</div>
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {AVAILABLE_PERMISSIONS.map((permission) => (
                      <div key={permission.id} className="flex items-center space-x-2 border border-border rounded-lg p-3">
                        <Checkbox
                          checked={editingRole.permissions.includes(permission.id)}
                          onCheckedChange={(checked) => {
                            const updatedPermissions = checked
                              ? [...editingRole.permissions, permission.id]
                              : editingRole.permissions.filter(p => p !== permission.id);
                            setEditingRole({ ...editingRole, permissions: updatedPermissions });
                          }}
                          data-testid={`edit-checkbox-${permission.id}`}
                        />
                        <div>
                          <div className="text-sm font-medium">{permission.label}</div>
                          <div className="text-xs text-muted-foreground">{permission.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => updateAdminRoleMutation.mutate({ 
                    userId: editingRole.userId, 
                    data: { permissions: editingRole.permissions } 
                  })}
                  disabled={updateAdminRoleMutation.isPending}
                  data-testid="button-update-admin"
                >
                  {updateAdminRoleMutation.isPending ? "Updating..." : "Update Role"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}