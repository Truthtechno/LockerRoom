import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";

export default function ResetPasswordToken() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { platformName, logoUrl, branding } = useBranding();
  const [token, setToken] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Get token from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');

    if (!resetToken) {
      setIsValidating(false);
      setIsValid(false);
      toast({
        title: "Invalid Reset Link",
        description: "No reset token provided. Please request a new password reset.",
        variant: "destructive",
      });
      return;
    }

    setToken(resetToken);
    setIsValidating(false);
    setIsValid(true);
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      toast({
        title: "Password Requirements Not Met",
        description: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to reset password');
      }

      setIsSuccess(true);
      toast({
        title: "Password Reset Successfully! 🎉",
        description: "Your password has been reset. You can now log in with your new password.",
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Password Reset Failed",
        description: error.message || "Failed to reset password. The link may have expired. Please request a new one.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background hero-pattern flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background hero-pattern">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              {logoUrl ? (
                <img
                  src={`${logoUrl}${logoUrl.includes('?') ? '&' : '?'}_=${Date.now()}`}
                  alt={`${platformName} logo`}
                  className="mx-auto h-20 w-auto max-w-[200px] object-contain mb-4"
                />
              ) : (
                <div className="mx-auto w-20 h-20 bg-primary rounded-xl flex items-center justify-center mb-4">
                  <span className="text-primary-foreground font-bold text-2xl">LR</span>
                </div>
              )}
              <h1 className="text-4xl font-bold text-foreground">{platformName}</h1>
            </div>

            <Card className="w-full shadow-xl">
              <CardContent className="pt-6 text-center">
                <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
                <h2 className="text-2xl font-semibold text-red-600 mb-2">Invalid Reset Link</h2>
                <p className="text-muted-foreground mb-6">
                  This password reset link is invalid or has expired. Please request a new password reset.
                </p>
                <Button onClick={() => setLocation("/login")} className="w-full">
                  Go to Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background hero-pattern">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              {logoUrl ? (
                <img
                  src={`${logoUrl}${logoUrl.includes('?') ? '&' : '?'}_=${Date.now()}`}
                  alt={`${platformName} logo`}
                  className="mx-auto h-20 w-auto max-w-[200px] object-contain mb-4"
                />
              ) : (
                <div className="mx-auto w-20 h-20 bg-primary rounded-xl flex items-center justify-center mb-4">
                  <span className="text-primary-foreground font-bold text-2xl">LR</span>
                </div>
              )}
              <h1 className="text-4xl font-bold text-foreground">{platformName}</h1>
            </div>

            <Card className="w-full shadow-xl">
              <CardContent className="pt-6 text-center">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h2 className="text-2xl font-semibold text-green-600 mb-2">Password Reset Successful!</h2>
                <p className="text-muted-foreground mb-6">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Redirecting to login page...
                </p>
                <Button onClick={() => setLocation("/login")} className="w-full">
                  Go to Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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
              />
            ) : (
              <div className="mx-auto w-20 h-20 bg-primary rounded-xl flex items-center justify-center mb-4">
                <span className="text-primary-foreground font-bold text-2xl">LR</span>
              </div>
            )}
            <h1 className="text-4xl font-bold text-foreground">{platformName}</h1>
          </div>

          {/* Reset Password Form */}
          <Card className="w-full shadow-xl">
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="text-center">
                  <Lock className="h-12 w-12 mx-auto text-primary mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">Reset Your Password</h2>
                  <p className="text-muted-foreground text-sm">
                    Enter your new password below
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium">New Password</Label>
                    <div className="relative mt-2">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        minLength={8}
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Must be at least 8 characters with uppercase, lowercase, and number
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                    <div className="relative mt-2">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        minLength={8}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isResetting}
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting Password...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>

                <div className="text-center">
                  <Link href="/login">
                    <span className="text-sm text-primary hover:underline cursor-pointer">
                      Back to Login
                    </span>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

