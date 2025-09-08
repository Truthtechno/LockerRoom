import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";

// Pages
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Feed from "./pages/feed";
import Profile from "./pages/profile";
import SearchPage from "./pages/search";
import StudentStats from "./pages/stats";
import StudentSettings from "./pages/settings";
import SchoolAdmin from "./pages/school-admin";
import SystemAdmin from "./pages/system-admin";
import SchoolApplications from "./pages/admin/school-applications";
import PlatformAnalytics from "./pages/admin/platform-analytics";
import SystemConfig from "./pages/admin/system-config";
import AdminManagement from "./pages/admin/admin-management";
import AddStudent from "./pages/school-admin/add-student";
import LiveReports from "./pages/school-admin/live-reports";
import ManageSettings from "./pages/school-admin/manage-settings";
import StudentSearch from "./pages/school-admin/student-search";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole?: string 
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Redirect to="/feed" />;
  }

  return <>{children}</>;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      
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
      
      <Route path="/stats">
        <ProtectedRoute requiredRole="student">
          <StudentStats />
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute requiredRole="student">
          <StudentSettings />
        </ProtectedRoute>
      </Route>
      
      <Route path="/create">
        <ProtectedRoute requiredRole="student">
          <Feed />
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
      
      <Route path="/admin/school-applications">
        <ProtectedRoute requiredRole="system_admin">
          <SchoolApplications />
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
      
      <Route path="/school-admin/add-student">
        <ProtectedRoute requiredRole="school_admin">
          <AddStudent />
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
