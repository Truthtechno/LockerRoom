import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Menu, X, Building2, Users, FileText, DollarSign, BarChart3, Settings, UserPlus, Shield, LogOut, Megaphone, Search, Trophy, Heart, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/auth";
import { AnnouncementModal } from "@/components/ui/announcement-modal";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { EditProfileModal } from "@/components/ui/edit-profile-modal";

interface MobileAdminNavProps {
  userRole: 'system_admin' | 'school_admin';
  schoolName?: string;
  onRefreshData?: () => void;
}

export function MobileAdminNav({ userRole, schoolName, onRefreshData }: MobileAdminNavProps) {
  const [open, setOpen] = useState(false);
  const { user, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = () => {
    logout(); // logout() now handles clearing data and redirecting
  };

  const handleNavigation = (path: string) => {
    setLocation(path);
    setOpen(false);
  };

  const handleAddStudent = () => {
    if (userRole === 'school_admin') {
      handleNavigation("/school-admin/add-student");
    }
  };

  const handleStudentSearch = () => {
    if (userRole === 'school_admin') {
      handleNavigation("/school-admin/student-search");
    }
  };

  const handleViewReports = () => {
    if (userRole === 'school_admin') {
      handleNavigation("/school-admin/live-reports");
    }
  };

  const handleCreateSchool = () => {
    if (userRole === 'system_admin') {
      handleNavigation("/system-admin/create-school");
    }
  };

  const handleCreateSchoolAdmin = () => {
    if (userRole === 'system_admin') {
      handleNavigation("/system-admin/create-school-admin");
    }
  };

  const handlePlatformAnalytics = () => {
    if (userRole === 'system_admin') {
      handleNavigation("/admin/platform-analytics");
    }
  };

  const handleSystemConfig = () => {
    if (userRole === 'system_admin') {
      handleNavigation("/admin/system-config");
    }
  };

  const handleManageAdmins = () => {
    if (userRole === 'system_admin') {
      handleNavigation("/admin/admin-management");
    }
  };

  const handleManageSchools = () => {
    if (userRole === 'system_admin') {
      handleNavigation("/system-admin/manage-schools");
    }
  };

  const navItems = userRole === 'system_admin' ? [
    { icon: Building2, label: "Create New School", action: handleCreateSchool, variant: "default" as const },
    { icon: UserPlus, label: "Create School Admin", action: handleCreateSchoolAdmin, variant: "default" as const },
    { icon: Building2, label: "Manage Schools", action: handleManageSchools, variant: "secondary" as const },
    { icon: BarChart3, label: "Platform Analytics", action: handlePlatformAnalytics, variant: "secondary" as const },
    { icon: Settings, label: "System Configuration", action: handleSystemConfig, variant: "secondary" as const },
    { icon: Shield, label: "Manage Administrators", action: handleManageAdmins, variant: "secondary" as const },
  ] : [
    { icon: UserPlus, label: "Add New Student", action: handleAddStudent, variant: "default" as const },
    { icon: BarChart3, label: "View Reports", action: handleViewReports, variant: "secondary" as const },
    { icon: Search, label: "Student Search & Ratings", action: handleStudentSearch, variant: "secondary" as const },
  ];

  return (
    <div className="lg:hidden bg-card border-b border-border px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            userRole === 'system_admin' ? 'gold-gradient' : 'bg-primary'
          }`}>
            <span className={`font-bold text-lg ${
              userRole === 'system_admin' ? 'text-accent-foreground' : 'text-primary-foreground'
            }`}>
              {userRole === 'system_admin' ? 'XEN' : 'LR'}
            </span>
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-semibold text-foreground">
              {userRole === 'system_admin' ? 'System Admin' : 'School Admin'}
            </h1>
            {schoolName && (
              <p className="text-xs text-muted-foreground truncate max-w-32">{schoolName}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {userRole === 'school_admin' && onRefreshData && (
            <Button 
              onClick={onRefreshData}
              variant="outline"
              size="sm"
              className="w-8 h-8 p-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-8 h-8 p-0">
                <Menu className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[300px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Admin Menu</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(false)}
                    className="w-6 h-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* User Profile Section */}
                <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <AvatarWithFallback
                    src={user?.profilePicUrl}
                    alt={user?.name || 'Admin'}
                    fallbackText={user?.name?.slice(0, 2).toUpperCase() || 'A'}
                    className="h-10 w-10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{user?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {userRole === 'system_admin' ? 'System Administrator' : 'School Administrator'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <EditProfileModal>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          Edit Profile
                        </DropdownMenuItem>
                      </EditProfileModal>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Navigation Items */}
                <div className="space-y-2">
                  {navItems.map((item, index) => (
                    <Button
                      key={index}
                      onClick={item.action}
                      variant={item.variant}
                      className="w-full justify-start"
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      {item.label}
                      {item.badge && (
                        <span className="ml-auto bg-accent-foreground/20 text-accent-foreground px-2 py-1 rounded text-xs">
                          {item.badge}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>

                {/* Announcements */}
                <div className="pt-2 border-t border-border">
                  <AnnouncementModal 
                    userRole={userRole} 
                    schoolId={userRole === 'school_admin' ? user?.schoolId : undefined}
                  >
                    <Button variant="secondary" className="w-full justify-start">
                      <Megaphone className="w-4 h-4 mr-3" />
                      Create Announcement
                    </Button>
                  </AnnouncementModal>
                </div>

                {/* Logout */}
                <div className="pt-2 border-t border-border">
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Logout
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
