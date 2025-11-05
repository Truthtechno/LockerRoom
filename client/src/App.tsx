import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { DynamicHead } from "@/components/ui/dynamic-head";
import { useNotificationToast } from "@/hooks/use-notification-toast";

// Pages
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ResetPassword from "@/pages/reset-password";
import Feed from "./pages/feed";
import CreatePostPage from "./pages/create";
import Profile from "./pages/profile";
import ProfileById from "./pages/profile/[id]";
import PostDetail from "./pages/post/[id]";
import SearchPage from "./pages/search";
import StudentStats from "./pages/stats";
import StudentSettings from "./pages/settings";
import Saved from "./pages/saved";
import Following from "./pages/following";
import Notifications from "./pages/notifications";
import SchoolAdmin from "./pages/school-admin";
import SystemAdmin from "./pages/system-admin";
import CreateSchool from "./pages/system-admin/create-school";
import CreateSchoolAdmin from "./pages/system-admin/create-school-admin";
import ManageSchools from "./pages/system-admin/manage-schools";
import PlatformAnalytics from "./pages/admin/platform-analytics";
import SystemConfig from "./pages/admin/system-config";
import AdminManagement from "./pages/admin/admin-management";
import EvaluationForms from "./pages/admin/evaluation-forms";
import EvaluationSubmissions from "./pages/admin/evaluation-submissions";
import AddStudent from "./pages/school-admin/add-student";
import EditProfile from "./pages/school-admin/edit-profile";
import LiveReports from "./pages/school-admin/live-reports";
import ManageSettings from "./pages/school-admin/manage-settings";
import StudentSearch from "./pages/school-admin/student-search";
import SchoolAdminAnnouncements from "./pages/school-admin/announcements";
import SchoolAdminFeed from "./pages/school-admin/feed";
import SystemAdminAnnouncements from "./pages/system-admin/announcements";
import SystemAdminFeed from "./pages/system-admin/feed";
import ScoutPortal from "./pages/scouts/index";
import About from "./pages/about";
import ScoutAdminPortal from "./pages/scouts/admin/index";
import ManageScouts from "./pages/scouts/admin/manage-scouts";
import XenWatchAnalytics from "./pages/scouts/admin/xen-watch-analytics";
import XenWatch from "./pages/xen-watch/index";
import XenWatchSubmitPage from "./pages/xen-watch/submit";
import ScoutQueue from "./pages/xen-watch/scout-queue";
import AdminFinalize from "./pages/xen-watch/admin-finalize";
import ScoutAI from "./pages/scoutai/index";
import { ComingSoon } from "@/components/ui/coming-soon";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole?: string | string[]
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // Check if user has a role that should see Coming Soon page
  const comingSoonRoles = ['moderator', 'finance', 'support', 'coach', 'analyst'];
  if (comingSoonRoles.includes(user.role)) {
    return <ComingSoon role={user.role} />;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowedRoles.includes(user.role)) {
      return <Redirect to="/feed" />;
    }
  }

  return <>{children}</>;
}

function Router() {
  const { user, isLoading } = useAuth();
  
  // Enable notification toast pop-ups for authenticated users
  useNotificationToast();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/reset-password" component={ResetPassword} />
      
      <Route path="/feed">
        <ProtectedRoute>
          <Feed />
        </ProtectedRoute>
      </Route>
      
      <Route path="/search">
        <ProtectedRoute>
          <SearchPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute requiredRole="student">
          <Profile />
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile/:id">
        <ProtectedRoute>
          <ProfileById />
        </ProtectedRoute>
      </Route>
      
      <Route path="/post/:id">
        <ProtectedRoute>
          <PostDetail />
        </ProtectedRoute>
      </Route>
      
      <Route path="/stats">
        <ProtectedRoute requiredRole="student">
          <StudentStats />
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute>
          <StudentSettings />
        </ProtectedRoute>
      </Route>
      
      <Route path="/about">
        <ProtectedRoute>
          <About />
        </ProtectedRoute>
      </Route>
      
      <Route path="/saved">
        <ProtectedRoute>
          <Saved />
        </ProtectedRoute>
      </Route>
      
      <Route path="/following">
        <ProtectedRoute>
          <Following />
        </ProtectedRoute>
      </Route>
      
      <Route path="/notifications">
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      </Route>
      
      <Route path="/create">
        <ProtectedRoute requiredRole="student">
          <CreatePostPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/school-admin">
        <ProtectedRoute requiredRole="school_admin">
          <SchoolAdmin />
        </ProtectedRoute>
      </Route>
      
      <Route path="/system-admin">
        <ProtectedRoute requiredRole="system_admin">
          <SystemAdmin />
        </ProtectedRoute>
      </Route>

      <Route path="/system-admin/create-school">
        <ProtectedRoute requiredRole="system_admin">
          <CreateSchool />
        </ProtectedRoute>
      </Route>

      <Route path="/system-admin/create-school-admin">
        <ProtectedRoute requiredRole="system_admin">
          <CreateSchoolAdmin />
        </ProtectedRoute>
      </Route>

      <Route path="/system-admin/manage-schools">
        <ProtectedRoute requiredRole="system_admin">
          <ManageSchools />
        </ProtectedRoute>
      </Route>

      <Route path="/system-admin/announcements">
        <ProtectedRoute requiredRole="system_admin">
          <SystemAdminAnnouncements />
        </ProtectedRoute>
      </Route>

      <Route path="/system-admin/feed">
        <ProtectedRoute requiredRole="system_admin">
          <SystemAdminFeed />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/platform-analytics">
        <ProtectedRoute requiredRole="system_admin">
          <PlatformAnalytics />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/system-config">
        <ProtectedRoute requiredRole="system_admin">
          <SystemConfig />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/admin-management">
        <ProtectedRoute requiredRole="system_admin">
          <AdminManagement />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/evaluation-forms">
        <ProtectedRoute requiredRole="system_admin">
          <EvaluationForms />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/evaluation-submissions">
        <ProtectedRoute requiredRole={["system_admin", "scout_admin", "xen_scout"]}>
          <EvaluationSubmissions />
        </ProtectedRoute>
      </Route>
      
      <Route path="/school-admin/add-student">
        <ProtectedRoute requiredRole="school_admin">
          <AddStudent />
        </ProtectedRoute>
      </Route>
      
      <Route path="/school-admin/edit-profile">
        <ProtectedRoute requiredRole="school_admin">
          <EditProfile />
        </ProtectedRoute>
      </Route>
      
      <Route path="/school-admin/live-reports">
        <ProtectedRoute requiredRole="school_admin">
          <LiveReports />
        </ProtectedRoute>
      </Route>
      
      <Route path="/school-admin/manage-settings">
        <ProtectedRoute requiredRole="school_admin">
          <ManageSettings />
        </ProtectedRoute>
      </Route>
      
      <Route path="/school-admin/student-search">
        <ProtectedRoute requiredRole="school_admin">
          <StudentSearch />
        </ProtectedRoute>
      </Route>

      <Route path="/school-admin/announcements">
        <ProtectedRoute requiredRole="school_admin">
          <SchoolAdminAnnouncements />
        </ProtectedRoute>
      </Route>

      <Route path="/school-admin/feed">
        <ProtectedRoute requiredRole="school_admin">
          <SchoolAdminFeed />
        </ProtectedRoute>
      </Route>
      
      <Route path="/scouts">
        <ProtectedRoute requiredRole={["scout_admin", "system_admin", "xen_scout"]}>
          <Redirect to="/xen-watch/scout-queue" />
        </ProtectedRoute>
      </Route>
      
      <Route path="/scouts/admin">
        <ProtectedRoute requiredRole="scout_admin">
          <ScoutAdminPortal />
        </ProtectedRoute>
      </Route>
      
      <Route path="/scouts/admin/manage-scouts">
        <ProtectedRoute requiredRole="scout_admin">
          <ManageScouts />
        </ProtectedRoute>
      </Route>
      
      <Route path="/scouts/admin/xen-watch-analytics">
        <ProtectedRoute requiredRole="scout_admin">
          <XenWatchAnalytics />
        </ProtectedRoute>
      </Route>
      
      <Route path="/xen-watch">
        <ProtectedRoute requiredRole={["student", "viewer"]}>
          <XenWatch />
        </ProtectedRoute>
      </Route>
      
      <Route path="/xen-watch/submit">
        <ProtectedRoute requiredRole={["student", "viewer"]}>
          <XenWatchSubmitPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/xen-watch/scout-queue">
        <ProtectedRoute requiredRole={["xen_scout", "scout_admin"]}>
          <ScoutQueue />
        </ProtectedRoute>
      </Route>
      
      <Route path="/xen-watch/admin-finalize">
        <ProtectedRoute requiredRole="system_admin">
          <AdminFinalize />
        </ProtectedRoute>
      </Route>
      
      <Route path="/scoutai">
        <ProtectedRoute requiredRole={["student", "viewer"]}>
          <ScoutAI />
        </ProtectedRoute>
      </Route>
      
      <Route path="/">
        {user ? <Redirect to="/feed" /> : <Redirect to="/login" />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="lockerroom-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DynamicHead />
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
