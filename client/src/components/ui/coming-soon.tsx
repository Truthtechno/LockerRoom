import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, Clock, User } from "lucide-react";

interface ComingSoonProps {
  role: string;
}

export function ComingSoon({ role }: ComingSoonProps) {
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "moderator":
        return "Moderator";
      case "finance":
        return "Finance";
      case "support":
        return "Support";
      case "coach":
        return "Coach";
      case "analyst":
        return "Analyst";
      default:
        return role;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "moderator":
        return <Badge variant="outline" className="bg-purple-600 text-white"><User className="w-3 h-3 mr-1" />Moderator</Badge>;
      case "finance":
        return <Badge variant="outline" className="bg-green-600 text-white"><User className="w-3 h-3 mr-1" />Finance</Badge>;
      case "support":
        return <Badge variant="outline" className="bg-blue-600 text-white"><User className="w-3 h-3 mr-1" />Support</Badge>;
      case "coach":
        return <Badge variant="outline" className="bg-orange-600 text-white"><User className="w-3 h-3 mr-1" />Coach</Badge>;
      case "analyst":
        return <Badge variant="outline" className="bg-indigo-600 text-white"><User className="w-3 h-3 mr-1" />Analyst</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Construction className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">🚧 Coming Soon</CardTitle>
          <CardDescription className="text-lg">
            This feature is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <span className="text-sm text-muted-foreground">Your role:</span>
              {getRoleBadge(role)}
            </div>
            
            <p className="text-sm text-muted-foreground">
              Please check back later for updates.
            </p>
            
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>We're working hard to bring you the best experience</span>
            </div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-sm">What's Next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Dashboard features for {getRoleDisplayName(role)} role</li>
              <li>• Role-specific tools and functionality</li>
              <li>• Enhanced user experience</li>
              <li>• Regular updates and improvements</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

