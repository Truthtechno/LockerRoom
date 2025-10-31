import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { AnnouncementManagement } from "@/components/admin/announcement-management";
import { AnnouncementModal } from "@/components/ui/announcement-modal";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

export default function SystemAdminAnnouncements() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        {/* Page Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Announcements</h1>
                <p className="text-muted-foreground text-sm lg:text-base">
                  Create and manage announcements for all schools
                </p>
              </div>
              <AnnouncementModal userRole="system_admin" schoolId={undefined}>
                <Button 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  data-testid="button-create-announcement"
                >
                  <Megaphone className="w-4 h-4 mr-2" />
                  Create Announcement
                </Button>
              </AnnouncementModal>
            </div>
          </div>

          {/* Announcement Management Component */}
          <AnnouncementManagement userRole="system_admin" />
        </div>
      </div>
    </div>
  );
}

