import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { AnnouncementManagement } from "@/components/admin/announcement-management";
import { BannerManagement } from "@/components/admin/banner-management";
import { AnnouncementModal } from "@/components/ui/announcement-modal";
import { BannerModal } from "@/components/ui/banner-modal";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, AlertCircle, Sparkles } from "lucide-react";
import { useState } from "react";

export default function SystemAdminAnnouncements() {
  const { user } = useAuth();
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);

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
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Communications</h1>
              <p className="text-muted-foreground text-sm lg:text-base">
                Manage announcements, banners, and promotions
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="announcements" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="banners">Banners</TabsTrigger>
              <TabsTrigger value="promotions">Promotions</TabsTrigger>
            </TabsList>

            {/* Announcements Tab */}
            <TabsContent value="announcements" className="space-y-6">
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Announcements</h2>
                  <p className="text-muted-foreground text-sm">
                    Create and manage announcements for all academies
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
              <AnnouncementManagement userRole="system_admin" />
            </TabsContent>

            {/* Banners Tab */}
            <TabsContent value="banners" className="space-y-6">
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Banners</h2>
                  <p className="text-muted-foreground text-sm">
                    Create dashboard banners for scouts, academy admins, and scout admins
                  </p>
                </div>
                <Button 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={() => setIsBannerModalOpen(true)}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Create Banner
                </Button>
              </div>
              <BannerManagement />
              <BannerModal 
                open={isBannerModalOpen}
                onOpenChange={setIsBannerModalOpen}
              />
            </TabsContent>

            {/* Promotions Tab */}
            <TabsContent value="promotions" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-accent" />
                    <CardTitle>Promotions</CardTitle>
                  </div>
                  <CardDescription>
                    Promotional campaigns and marketing tools
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">Coming Soon</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      The promotions feature is currently under development. Check back soon for exciting new promotional tools and campaign management features.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

