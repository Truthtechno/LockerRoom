import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { login } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { updateUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const demoAccounts = [
    { role: "System Admin", email: "admin@lockerroom.com", password: "Admin123!" },
    { role: "School Admin", email: "school@lockerroom.com", password: "School123!" },
    { role: "Student", email: "student@lockerroom.com", password: "Student123!" },
    { role: "Public Viewer", email: "viewer@lockerroom.com", password: "Viewer123!" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await login(formData.email, formData.password);
      updateUser(user);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
      });

      // Redirect based on role
      switch (user.role) {
        case "system_admin":
          setLocation("/system-admin");
          break;
        case "school_admin":
          setLocation("/school-admin");
          break;
        case "student":
          setLocation("/feed");
          break;
        default:
          setLocation("/feed");
      }
    } catch (error) {
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
            <div className="mx-auto w-20 h-20 bg-primary rounded-xl flex items-center justify-center mb-4">
              <span className="text-primary-foreground font-bold text-2xl">LR</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground">LockerRoom</h1>
            <p className="text-muted-foreground mt-2">XEN Sports Armoury</p>
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
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter your password"
                      className="mt-2"
                      data-testid="input-password"
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>

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
    </div>
  );
}
