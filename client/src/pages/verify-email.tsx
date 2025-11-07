import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { platformName, logoUrl, branding } = useBranding();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'expired'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    // Get token from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided. Please check your email for the verification link.');
      return;
    }

    // Verify email with token
    verifyEmail(token);
  }, []);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error?.code === "token_expired") {
          setStatus('expired');
          setErrorMessage(result.error.message || "Verification token has expired.");
        } else {
          setStatus('error');
          setErrorMessage(result.error?.message || "Failed to verify email. Please try again.");
        }
        return;
      }

      setStatus('success');
      toast({
        title: "Email Verified Successfully!",
        description: "Your email has been verified. You can now log in to your account.",
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    } catch (error) {
      console.error('Email verification error:', error);
      setStatus('error');
      setErrorMessage("An error occurred while verifying your email. Please try again.");
    }
  };

  const handleResendVerification = async () => {
    // Get email from URL or prompt user
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');

    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address to resend the verification email.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to resend verification email");
      }

      toast({
        title: "Verification Email Sent",
        description: "A new verification email has been sent to your inbox. Please check your email.",
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

          {/* Verification Status Card */}
          <Card className="w-full shadow-xl">
            <CardContent className="pt-6">
              <div className="space-y-6 text-center">
                {status === 'verifying' && (
                  <>
                    <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
                    <h2 className="text-2xl font-semibold">Verifying Your Email</h2>
                    <p className="text-muted-foreground">
                      Please wait while we verify your email address...
                    </p>
                  </>
                )}

                {status === 'success' && (
                  <>
                    <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                    <h2 className="text-2xl font-semibold text-green-600">Email Verified!</h2>
                    <p className="text-muted-foreground">
                      Your email has been successfully verified. You can now log in to your account.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Redirecting to login page...
                    </p>
                    <Button onClick={() => setLocation("/login")} className="w-full">
                      Go to Login
                    </Button>
                  </>
                )}

                {status === 'error' && (
                  <>
                    <XCircle className="h-16 w-16 mx-auto text-red-500" />
                    <h2 className="text-2xl font-semibold text-red-600">Verification Failed</h2>
                    <p className="text-muted-foreground">
                      {errorMessage || "We couldn't verify your email address. The link may be invalid or expired."}
                    </p>
                    <div className="space-y-2">
                      <Button 
                        onClick={handleResendVerification} 
                        disabled={resending}
                        className="w-full"
                      >
                        {resending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Resend Verification Email
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setLocation("/login")}
                        className="w-full"
                      >
                        Back to Login
                      </Button>
                    </div>
                  </>
                )}

                {status === 'expired' && (
                  <>
                    <XCircle className="h-16 w-16 mx-auto text-orange-500" />
                    <h2 className="text-2xl font-semibold text-orange-600">Token Expired</h2>
                    <p className="text-muted-foreground">
                      {errorMessage || "This verification link has expired. Please request a new one."}
                    </p>
                    <div className="space-y-2">
                      <Button 
                        onClick={handleResendVerification} 
                        disabled={resending}
                        className="w-full"
                      >
                        {resending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Resend Verification Email
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setLocation("/login")}
                        className="w-full"
                      >
                        Back to Login
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Help Text */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Need help?{" "}
              <Link href="/login">
                <span className="text-primary hover:underline cursor-pointer">
                  Contact Support
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

