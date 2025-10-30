import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import StatsCard from "@/components/stats/stats-card";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, FileText, DollarSign, BarChart3, Settings, UserPlus, Shield, LogOut, ChevronDown, MapPin, Calendar, MoreHorizontal, Ban, Trash2, AlertTriangle, ChevronRight, Megaphone } from "lucide-react";
import { Loader2 } from "lucide-react";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { SchoolAvatar } from "@/components/ui/school-avatar";
import { EditProfileModal } from "@/components/ui/edit-profile-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementModal } from "@/components/ui/announcement-modal";
import { AnnouncementManagement } from "@/components/admin/announcement-management";
import { AdminFeed } from "@/components/admin/admin-feed";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

export default function SystemAdmin() {
  const { user, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: systemStats, isLoading } = useQuery<{
    totalSchools: number;
    activeStudents: number;
    contentUploads: number;
    monthlyRevenue: number;
    premiumSchools: number;
    standardSchools: number;
  }>({
    queryKey: ["/api/system/stats"],
  });

  const { data: schoolsData } = useQuery({
    queryKey: ["/api/system-admin/schools"],
    queryFn: async () => {
      const response = await fetch('/api/system-admin/schools', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch schools');
      const data = await response.json();
      
      // Sort by createdAt descending and take only the 3 most recent
      const recentSchools = data.schools
        ?.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        ?.slice(0, 3) || [];
      return { ...data, schools: recentSchools };
    },
  });

  const uploadSchoolProfilePic = async (schoolId: string, file: File) => {
    const formData = new FormData();
    formData.append('profilePic', file);

    const response = await fetch(`/api/system-admin/schools/${schoolId}/profile-pic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload profile picture');
    }

    return response.json();
  };

  const handleSchoolAvatarClick = (schoolId: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('data-school-id', schoolId);
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const schoolId = event.target.getAttribute('data-school-id');
    
    if (!file || !schoolId) return;

    try {
      await uploadSchoolProfilePic(schoolId, file);
      
      toast({
        title: "Success",
        description: "School profile picture updated successfully",
      });
      
      // Refetch schools data to update the UI
      await queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      await queryClient.refetchQueries({ queryKey: ["/api/system-admin/schools"] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    }

    // Reset the input
    event.target.value = '';
  };

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  const handlePlatformAnalytics = () => {
    setLocation("/admin/platform-analytics");
  };

  const handleSystemConfig = () => {
    setLocation("/admin/system-config");
  };

  const handleManageAdmins = () => {
    setLocation("/admin/admin-management");
  };

  const handleCreateSchool = () => {
    setLocation("/system-admin/create-school");
  };

  const handleCreateSchoolAdmin = () => {
    setLocation("/system-admin/create-school-admin");
  };

  const handleDisableSchool = async (schoolId: string, schoolName: string) => {
    setActionLoading(schoolId);
    try {
      const response = await fetch(`/api/system-admin/schools/${schoolId}/disable`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to disable school');
      }

      const result = await response.json();
      
      toast({
        title: "School Disabled",
        description: result.message,
      });

      // Refetch schools data
      await queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      await queryClient.refetchQueries({ queryKey: ["/api/system-admin/schools"] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disable school",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    setActionLoading(schoolId);
    try {
      const response = await fetch(`/api/system-admin/schools/${schoolId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to delete school');
      }

      const result = await response.json();
      
      toast({
        title: "School Deleted",
        description: result.message,
      });

      // Refetch schools data
      await queryClient.invalidateQueries({ queryKey: ["/api/system-admin/schools"] });
      await queryClient.refetchQueries({ queryKey: ["/api/system-admin/schools"] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete school",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Page Title */}
        <div className="mb-8 px-4 sm:px-6 lg:px-8 pt-8">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">System Administration</h1>
              <p className="text-muted-foreground text-sm lg:text-base">XEN Sports Armoury Platform</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-foreground">System Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="feed">Feed</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-8">
            {/* Global Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-8">
          <StatsCard
            title="Total Schools"
            value={systemStats?.totalSchools || 0}
            trend="+28 this month"
            icon={Building2}
            iconColor="text-accent"
          />
          <StatsCard
            title="Active Students"
            value={`${(systemStats?.activeStudents || 0).toLocaleString()}`}
            trend="+1.2K this month"
            icon={Users}
            iconColor="text-primary"
          />
          <StatsCard
            title="Content Uploads"
            value={`${(systemStats?.contentUploads || 0).toLocaleString()}`}
            trend="+5.2K this week"
            icon={FileText}
            iconColor="text-secondary"
          />
          <StatsCard
            title="Monthly Revenue"
            value={`$${(systemStats?.monthlyRevenue || 0).toLocaleString()}`}
            trend="+23% this month"
            icon={DollarSign}
            iconColor="text-accent"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Platform Analytics */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent School Registrations */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Recent School Registrations</h2>
                <p className="text-sm text-muted-foreground">New schools joining the platform</p>
              </div>
              <div className="divide-y divide-border">
                {schoolsData?.schools?.length > 0 ? (
                  schoolsData.schools.map((school: any) => {
                    const registrationDate = new Date(school.createdAt);
                    const daysAgo = Math.floor((Date.now() - registrationDate.getTime()) / (1000 * 60 * 60 * 24));
                    const status = school.subscriptionPlan === 'premium' ? 'Active' : 'Pending';
                    const statusColor = status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
                    
                    return (
                      <div key={school.id} className="p-3 sm:p-6 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 sm:space-x-4">
                            <SchoolAvatar
                              key={`${school.id}-${school.profilePicUrl || 'no-image'}`}
                              src={school.profilePicUrl}
                              name={school.name}
                              className="h-10 w-10 sm:h-12 sm:w-12"
                              clickable={true}
                              onClick={() => handleSchoolAvatarClick(school.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-foreground text-sm sm:text-base truncate">{school.name}</h3>
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-xs sm:text-sm text-muted-foreground">
                                {school.address && (
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{school.address}</span>
                                  </div>
                                )}
                                <div className="flex items-center space-x-1">
                                  <span className="capitalize">{school.subscriptionPlan} Plan</span>
                                  <span>•</span>
                                  <span>{school.maxStudents} students</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                {status}
                              </span>
                              <div className="flex items-center text-sm text-muted-foreground mt-1">
                                <Calendar className="w-3 h-3 mr-1" />
                                <span>
                                  {daysAgo === 0 ? 'Registered today' : 
                                   daysAgo === 1 ? 'Registered yesterday' : 
                                   `Registered ${daysAgo} days ago`}
                                </span>
                              </div>
                            </div>
                            
                            {/* School Management Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  disabled={actionLoading === school.id}
                                >
                                  {actionLoading === school.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="w-4 h-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleDisableSchool(school.id, school.name)}
                                  className="text-yellow-600 focus:text-yellow-600"
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Disable School
                                </DropdownMenuItem>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      onSelect={(e) => e.preventDefault()}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete School
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="flex items-center">
                                        <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                                        Delete School Permanently
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete:
                                        <ul className="mt-2 ml-4 list-disc">
                                          <li>School "{school.name}"</li>
                                          <li>All school admin accounts</li>
                                          <li>All student accounts</li>
                                          <li>All posts and content</li>
                                        </ul>
                                        Are you absolutely sure you want to proceed?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteSchool(school.id, school.name)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete Permanently
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No schools registered yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Platform Health Metrics */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg font-semibold text-foreground">Platform Health</h2>
                <p className="text-sm text-muted-foreground">System performance and usage metrics</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-green-600">99.8%</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">Uptime</p>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
                
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-blue-600">1.2s</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">Avg Response</p>
                  <p className="text-xs text-muted-foreground">Page load time</p>
                </div>
                
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-2">
                    <div className="text-2xl font-bold text-purple-600">2.4M</div>
                  </div>
                  <p className="text-sm font-medium text-foreground">API Requests</p>
                  <p className="text-xs text-muted-foreground">This month</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Management */}
          <div className="space-y-4 sm:space-y-6">
            {/* System Actions - Accordion on mobile */}
            <div className="bg-card border border-border rounded-xl shadow-sm">
              <Disclosure>
                {({ open }: { open: boolean }) => (
                  <>
                    <DisclosureButton className="w-full px-4 sm:px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <h2 className="text-lg font-semibold text-foreground">System Management</h2>
                      <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                    </DisclosureButton>
                    <DisclosurePanel className="px-4 sm:px-6 pb-4 sm:pb-6">
                      <div className="space-y-3">
                <Button
                  onClick={handleCreateSchool}
                  className="w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <div className="flex items-center">
                    <Building2 className="w-5 h-5 mr-3" />
                    Create New School
                  </div>
                </Button>

                <Button
                  onClick={handleCreateSchoolAdmin}
                  className="w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <div className="flex items-center">
                    <UserPlus className="w-5 h-5 mr-3" />
                    Create School Admin
                  </div>
                </Button>

                <Button
                  onClick={() => setLocation("/system-admin/manage-schools")}
                  className="w-full justify-start bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <div className="flex items-center">
                    <Building2 className="w-5 h-5 mr-3" />
                    Manage Schools
                  </div>
                </Button>
                
                <Button
                  onClick={handlePlatformAnalytics}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-platform-analytics"
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  Platform Analytics
                </Button>
                
                <Button
                  onClick={handleSystemConfig}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-system-config"
                >
                  <Settings className="w-5 h-5 mr-3" />
                  System Configuration
                </Button>
                
                <Button
                  onClick={handleManageAdmins}
                  variant="secondary"
                  className="w-full justify-start"
                  data-testid="button-manage-admins"
                >
                  <Shield className="w-5 h-5 mr-3" />
                  Manage Administrators
                </Button>
                
                <AnnouncementModal userRole="system_admin">
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    data-testid="button-create-announcement"
                  >
                    <Megaphone className="w-5 h-5 mr-3" />
                    Create Announcement
                  </Button>
                </AnnouncementModal>
                      </div>
                    </DisclosurePanel>
                  </>
                )}
              </Disclosure>
            </div>

            {/* Subscription Overview */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">Subscription Plans</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Premium Schools</p>
                    <p className="text-sm text-muted-foreground">Advanced features</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{systemStats?.premiumSchools || 0}</p>
                    <p className="text-sm text-accent dark:text-accent">$150/month each</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Standard Schools</p>
                    <p className="text-sm text-muted-foreground">Basic features</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{systemStats?.standardSchools || 0}</p>
                    <p className="text-sm text-accent dark:text-accent">$75/month each</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">Total MRR</p>
                    <p className="text-xl font-bold text-accent dark:text-accent">${(systemStats?.monthlyRevenue || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* System Alerts */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">System Alerts</h2>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-green-800">System Update Completed</p>
                    <p className="text-xs text-green-600">Version 2.1.4 deployed successfully</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Database Backup Complete</p>
                    <p className="text-xs text-blue-600">Scheduled backup finished at 2:00 AM</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Storage Usage: 78%</p>
                    <p className="text-xs text-yellow-600">Consider upgrading storage capacity</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="announcements" className="space-y-8">
            <AnnouncementManagement userRole="system_admin" />
          </TabsContent>

          <TabsContent value="feed" className="space-y-8">
            <div className="bg-card border border-border rounded-xl p-2 sm:p-4 lg:p-6 shadow-sm">
              <AdminFeed userRole="system_admin" />
            </div>
          </TabsContent>
          </Tabs>
        </div>
        
        {/* Hidden file input for school profile picture uploads */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
