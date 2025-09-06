import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";

// Pages
import Login from "@/pages/login";
import Feed from "./pages/feed";
import Profile from "./pages/profile";
import SchoolAdmin from "./pages/school-admin";
import SystemAdmin from "./pages/system-admin";
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
      
      <Route path="/feed">
        <ProtectedRoute>
          <Feed />
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute requiredRole="student">
          <Profile />
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
