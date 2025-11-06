
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { loginWithGoogle } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Eye, EyeOff, Users, Trophy, Camera, Mail, CheckCircle } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { updateUser } = useAuth();
  const { toast } = useToast();
  const { platformName, logoUrl, branding } = useBranding();

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [resending, setResending] = useState(false);
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

  // Render Google Sign-In button
  useEffect(() => {
    const renderButton = () => {
      const buttonElement = document.getElementById('google-signup-button');
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
              text: 'signup_with',
              locale: 'en',
            }
          );
          console.log('✅ Google sign-up button rendered successfully');
        } catch (error) {
          console.error('Failed to render Google sign-up button:', error);
        }
      }
    };

    // Wait for both Google script and DOM element
    const checkAndRender = () => {
      if (document.getElementById('google-signup-button') && (window as any).google?.accounts?.id) {
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

  const handleGoogleSignIn = async (response: any) => {
    if (!response.credential) {
      toast({
        title: "Google Sign-Up Failed",
        description: "No credential received from Google.",
        variant: "destructive",
      });
      return;
    }

    setIsGoogleLoading(true);
    try {
      // Force clear any residual auth data before signup
      localStorage.removeItem("auth_user");
      localStorage.removeItem("token");
      localStorage.removeItem("schoolId");
      sessionStorage.clear();
      
      // CRITICAL: Clear React Query cache before signup
      try {
        queryClient.clear();
      } catch (error) {
        console.warn("Failed to clear React Query cache before Google signup:", error);
      }
      
      const result = await loginWithGoogle(response.credential);
      updateUser(result.user);
      
      toast({
        title: `Welcome to ${platformName}!`,
        description: "Your account has been created successfully.",
      });

      // Redirect to feed
      setLocation("/feed");
    } catch (error: any) {
      toast({
        title: "Google Sign-Up Failed",
        description: error instanceof Error ? error.message : "Failed to sign up with Google",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const signupMutation = useMutation({
    mutationFn: async (data: Omit<SignupForm, "confirmPassword">) => {
      const response = await apiRequest("POST", "/api/auth/signup", data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || "Registration failed");
      }
      
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      // Check if email verification is required
      if (data.requiresEmailVerification) {
        setUserEmail(data.user?.email || "");
        setShowVerificationMessage(true);
        toast({
          title: "Account Created Successfully!",
          description: "Please check your email to verify your account before logging in.",
        });
      } else {
        // Legacy flow (shouldn't happen with new system, but handle gracefully)
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("auth_user", JSON.stringify(data.user));
          updateUser(data.user);
        }
        toast({
          title: `Welcome to ${platformName}!`,
          description: data.message || "Account created successfully!",
        });
        setLocation("/feed");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Signup Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleResendVerification = async () => {
    if (!userEmail) {
      toast({
        title: "Email Required",
        description: "Email address is required to resend verification.",
        variant: "destructive",
      });
      return;
    }

    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to resend verification email");
      }

      toast({
        title: "Verification Email Sent",
        description: "A new verification email has been sent to your inbox.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to Resend",
        description: error.message || "Failed to resend verification email. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const onSubmit = (data: SignupForm) => {
    const { confirmPassword, ...signupData } = data;
    signupMutation.mutate(signupData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          {logoUrl ? (
            <img
              src={`${logoUrl}${logoUrl.includes('?') ? '&' : '?'}_=${Date.now()}`}
              alt={`${platformName} logo`}
              className="mx-auto h-16 w-auto max-w-[160px] object-contain mb-4"
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
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-foreground">LR</span>
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Join {platformName}</h1>
          <p className="text-muted-foreground mt-2">
            {branding?.companyName || "Follow your favorite student athletes and stay updated with their journey"}
          </p>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 py-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Follow Athletes</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">View Content</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Support Teams</p>
          </div>
        </div>

        {/* Signup Form */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Enter your information to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter your full name" 
                          data-testid="input-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="Enter your email" 
                          data-testid="input-email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a password"
                            data-testid="input-password"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            data-testid="input-confirm-password"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            data-testid="toggle-confirm-password"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={signupMutation.isPending || isGoogleLoading}
                  data-testid="button-signup"
                >
                  {signupMutation.isPending ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </Form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google Sign-Up Button */}
            <div className="w-full">
              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                <div 
                  id="google-signup-button" 
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
                      title: "Google Sign-Up Not Configured",
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
                  Sign up with Google
                </Button>
              )}
            </div>

            {/* Email Verification Message */}
            {showVerificationMessage && (
              <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-sm">Check Your Email</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a verification email to <strong>{userEmail}</strong>. 
                      Please click the link in the email to verify your account before logging in.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendVerification}
                        disabled={resending}
                      >
                        {resending ? "Sending..." : "Resend Email"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation("/login")}
                      >
                        Go to Login
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login">
                  <span className="text-primary hover:underline cursor-pointer" data-testid="link-login">
                    Sign in
                  </span>
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>By creating an account, you agree to follow community guidelines</p>
          <p className="mt-1">and respect student athlete privacy</p>
        </div>
      </div>
    </div>
  );
}