import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { login, loginWithGoogle } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { PasswordResetModal } from "@/components/PasswordResetModal";
import { Eye, EyeOff } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useBranding } from "@/hooks/use-branding";

export default function Login() {
  const [, setLocation] = useLocation();
  const { updateUser } = useAuth();
  const { toast } = useToast();
  const { platformName, logoUrl, branding } = useBranding();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Initialize Google OAuth
  useEffect(() => {
    const initGoogleSignIn = () => {
      if (typeof window !== 'undefined' && (window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleGoogleSignIn,
        });
      }
    };

    // Wait for Google script to load
    if ((window as any).google) {
      initGoogleSignIn();
    } else {
      const checkGoogle = setInterval(() => {
        if ((window as any).google) {
          initGoogleSignIn();
          clearInterval(checkGoogle);
        }
      }, 100);
      
      // Cleanup after 10 seconds
      setTimeout(() => clearInterval(checkGoogle), 10000);
    }
  }, []);

  const handleGoogleSignIn = async (response: any) => {
    if (!response.credential) {
      toast({
        title: "Google Sign-In Failed",
        description: "No credential received from Google.",
        variant: "destructive",
      });
      return;
    }

    setIsGoogleLoading(true);
    try {
      // Force clear any residual auth data before login
      localStorage.removeItem("auth_user");
      localStorage.removeItem("token");
      localStorage.removeItem("schoolId");
      sessionStorage.clear();
      
      // CRITICAL: Clear React Query cache before login
      try {
        queryClient.clear();
      } catch (error) {
        console.warn("Failed to clear React Query cache before Google login:", error);
      }
      
      const result = await loginWithGoogle(response.credential);
      updateUser(result.user);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${result.user.name}!`,
      });

      // Use window.location for hard navigation to clear any cached state
      const redirectPath = (() => {
        switch (result.user.role) {
          case "system_admin":
            return "/system-admin";
          case "scout_admin":
            return "/scouts/admin";
          case "school_admin":
            return "/school-admin";
          case "student":
            return "/feed";
          default:
            return "/feed";
        }
      })();
      
      // Force hard navigation with cache busting
      const timestamp = Date.now();
      setTimeout(() => {
        window.location.href = redirectPath + '?_=' + timestamp + '&nocache=' + timestamp;
      }, 100);
    } catch (error: any) {
      toast({
        title: "Google Sign-In Failed",
        description: error instanceof Error ? error.message : "Failed to sign in with Google",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Render Google Sign-In button
  useEffect(() => {
    const renderButton = () => {
      const buttonElement = document.getElementById('google-signin-button');
      if (!buttonElement) {
        return; // Element not ready yet
      }

      // Check if Google is loaded and initialized
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        try {
          // Clear any existing button first
          buttonElement.innerHTML = '';
          (window as any).google.accounts.id.renderButton(
            buttonElement,
            {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signin_with',
              locale: 'en',
            }
          );
          console.log('✅ Google sign-in button rendered successfully');
        } catch (error) {
          console.error('Failed to render Google sign-in button:', error);
        }
      }
    };

    // Wait for both Google script and DOM element
    const checkAndRender = () => {
      if (document.getElementById('google-signin-button') && (window as any).google?.accounts?.id) {
        renderButton();
        return true;
      }
      return false;
    };

    // Try immediately
    if (!checkAndRender()) {
      // Poll until both are ready
      const interval = setInterval(() => {
        if (checkAndRender()) {
          clearInterval(interval);
        }
      }, 100);

      // Stop polling after 5 seconds
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!(window as any).google?.accounts?.id) {
          console.warn('Google OAuth not available:', {
            hasGoogle: !!(window as any).google,
            hasAccounts: !!(window as any).google?.accounts,
            hasId: !!(window as any).google?.accounts?.id,
            hasClientId: !!import.meta.env.VITE_GOOGLE_CLIENT_ID,
          });
        }
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, []);

  // Check for error message in URL (from account deactivated redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      toast({
        title: "Account Deactivated",
        description: decodeURIComponent(errorParam),
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, '', '/login');
    }
  }, [toast]);

  const demoAccounts = [
    { role: "System Admin", email: "sysadmin@lockerroom.com", password: "SuperSecure123!" },
    { role: "Scout Admin", email: "adminscout@xen.com", password: "123933" },
    { role: "School Admin", email: "godwin@xen-hub.com", password: "Admin123$" },
    { role: "Student", email: "thiago@gmail.com", password: "admin123" },
    { role: "Public Viewer", email: "brayamooti@gmail.com", password: "Pkw0epLSFG" },
  ];
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Force clear any residual auth data before login
      localStorage.removeItem("auth_user");
      localStorage.removeItem("token");
      localStorage.removeItem("schoolId");
      sessionStorage.clear();
      
      // CRITICAL: Clear React Query cache before login to prevent stale data
      try {
        queryClient.clear();
      } catch (error) {
        console.warn("Failed to clear React Query cache before login:", error);
      }
      
      const result = await login(formData.email, formData.password);
      updateUser(result.user);
      
      // Check if password reset is required (OTP users)
      if (result.requiresPasswordReset || result.user.is_one_time_password) {
        toast({
          title: "Welcome! Please set your password",
          description: "You need to create a new password to continue.",
        });
        setLocation("/reset-password");
        return;
      }
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${result.user.name}!`,
      });

      // Use window.location for hard navigation to clear any cached state
      const redirectPath = (() => {
        switch (result.user.role) {
          case "system_admin":
            return "/system-admin";
          case "scout_admin":
            return "/scouts/admin";
          case "school_admin":
            return "/school-admin";
          case "student":
            return "/feed";
          default:
            return "/feed";
        }
      })();
      
      // Force hard navigation with cache busting
      const timestamp = Date.now();
      setTimeout(() => {
        window.location.href = redirectPath + '?_=' + timestamp + '&nocache=' + timestamp;
      }, 100);
    } catch (error: any) {
      // Handle email not verified error
      if (error.code === 'email_not_verified') {
        toast({
          title: "Email Not Verified",
          description: error.message || "Please verify your email address before logging in. Check your inbox for the verification email.",
          variant: "destructive",
        });
        // Optionally add a button to resend verification email
        return;
      }
      
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (account: { email: string; password: string }) => {
    setFormData({ email: account.email, password: account.password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background hero-pattern">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Logo Section */}
          <div className="text-center">
            {logoUrl ? (
              <img
                src={`${logoUrl}${logoUrl.includes('?') ? '&' : '?'}_=${Date.now()}`}
                alt={`${platformName} logo`}
                className="mx-auto h-20 w-auto max-w-[200px] object-contain mb-4"
                onError={(e) => {
                  // Fallback to default if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            {!logoUrl && (
              <div className="mx-auto w-20 h-20 bg-primary rounded-xl flex items-center justify-center mb-4">
                <span className="text-primary-foreground font-bold text-2xl">LR</span>
              </div>
            )}
            <h1 className="text-4xl font-bold text-foreground">{platformName}</h1>
            {branding?.companyName && (
              <p className="text-muted-foreground mt-2">{branding.companyName}</p>
            )}
           </div>

          {/* Login Form */}
          <Card className="w-full shadow-xl">
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-center mb-2">Welcome Back</h2>
                  <p className="text-muted-foreground text-center text-sm">Sign in to your account</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter your email"
                      className="mt-2"
                      data-testid="input-email"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                    <div className="relative mt-2">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Enter your password"
                        data-testid="input-password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsPasswordResetModalOpen(true)}
                      className="text-sm text-primary hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || isGoogleLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* Google Sign-In Button */}
                <div className="w-full">
                  {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                    <div 
                      id="google-signin-button" 
                      className="w-full flex justify-center"
                      style={{ minHeight: '40px' }}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        toast({
                          title: "Google Sign-In Not Configured",
                          description: "Please set VITE_GOOGLE_CLIENT_ID in your .env file. See GOOGLE_OAUTH_SETUP.md for instructions.",
                          variant: "destructive",
                        });
                      }}
                      disabled={isGoogleLoading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign in with Google
                    </Button>
                  )}
                </div>

                {/* Create Account Link */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Link href="/signup">
                      <span className="text-primary hover:underline cursor-pointer font-medium" data-testid="link-create-account">
                        Create Account
                      </span>
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sign up to follow student athletes and view their content
                  </p>
                </div>

                {/* Demo Accounts */}
                <div className="border-t border-border pt-6">
                  <p className="text-sm font-medium text-foreground mb-3">Demo Accounts:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {demoAccounts.map((account, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded text-center cursor-pointer transition-colors hover:bg-muted/80 ${
                          account.role === "Student" ? "bg-accent/20" : "bg-muted"
                        }`}
                        onClick={() => handleDemoLogin(account)}
                        data-testid={`demo-${account.role.toLowerCase().replace(" ", "-")}`}
                      >
                        <div className="font-medium">{account.role}</div>
                        <div className="text-muted-foreground">{account.email}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <PasswordResetModal 
        isOpen={isPasswordResetModalOpen}
        onClose={() => setIsPasswordResetModalOpen(false)}
      />
    </div>
  );
}
