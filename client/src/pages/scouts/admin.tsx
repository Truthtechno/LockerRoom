import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Plus, 
  Eye, 
  CheckCircle, 
  Clock, 
  Star, 
  TrendingUp,
  UserPlus,
  Settings,
  BarChart3,
  FileText,
  Send
} from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Scout {
  id: string;
  name: string;
  email: string;
  role: string;
  xenId: string;
  profilePicUrl?: string | null;
  createdAt: string;
}

interface SubmissionStats {
  totalSubmissions: number;
  inReviewSubmissions: number;
  finalizedSubmissions: number;
  rejectedSubmissions: number;
  totalReviews: number;
  submittedReviews: number;
  avgRating: number;
}

export default function ScoutAdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for create scout modal
  const [isCreateScoutOpen, setIsCreateScoutOpen] = useState(false);
  const [scoutForm, setScoutForm] = useState({
    name: '',
    email: '',
    role: 'xen_scout',
    xenId: '',
    otp: ''
  });

  // Fetch scouts list
  const { data: scouts = [], isLoading: scoutsLoading } = useQuery<Scout[]>({
    queryKey: ["/api/scouts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/scouts");
      if (!response.ok) throw new Error('Failed to fetch scouts');
      return response.json();
    }
  });

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery<SubmissionStats>({
    queryKey: ["/api/scout-admin/dashboard"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/scout-admin/dashboard");
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      return response.json().then(data => data.analytics);
    }
  });

  // Create scout mutation
  const createScoutMutation = useMutation({
    mutationFn: async (scoutData: typeof scoutForm) => {
      const response = await apiRequest("POST", "/api/scout-admin/create-scout", scoutData);
      if (!response.ok) throw new Error('Failed to create scout');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scout Created",
        description: "New scout has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scouts/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/admin/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xen-watch/analytics/overview"] });
      setIsCreateScoutOpen(false);
      setScoutForm({ name: '', email: '', role: 'xen_scout', xenId: '', otp: '' });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create scout",
        variant: "destructive",
      });
    }
  });

  const handleCreateScout = () => {
    if (!scoutForm.name || !scoutForm.email || !scoutForm.xenId || !scoutForm.otp) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createScoutMutation.mutate(scoutForm);
  };

  const generateXenId = () => {
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const rolePrefix = scoutForm.role === 'scout_admin' ? 'XSA' : 'XSC';
    setScoutForm(prev => ({ ...prev, xenId: `${rolePrefix}-${randomNum}` }));
  };

  const generateOTP = () => {
    const otp = Math.floor(Math.random() * 900000) + 100000;
    setScoutForm(prev => ({ ...prev, otp: otp.toString() }));
  };

  if (scoutsLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Scout Admin Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Manage scouts and monitor submissions</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button 
                  onClick={() => setIsCreateScoutOpen(true)}
                  className="gold-gradient text-accent-foreground"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Scout
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Statistics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Scouts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scouts.length}</div>
                <p className="text-xs text-muted-foreground">Active scouts</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalSubmissions || 0}</div>
                <p className="text-xs text-muted-foreground">All submissions</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Review</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats?.inReviewSubmissions || 0}</div>
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Finalized</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats?.finalizedSubmissions || 0}</div>
                <p className="text-xs text-muted-foreground">Completed reviews</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/xen-watch/scout-queue'}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="w-5 h-5 mr-2 text-blue-600" />
                  Review Submissions
                </CardTitle>
                <CardDescription>View and manage all submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Access the submission review queue to monitor scout progress and finalize reviews.</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/xen-watch/admin-finalize'}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Send className="w-5 h-5 mr-2 text-green-600" />
                  Finalize Reviews
                </CardTitle>
                <CardDescription>Publish final feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Review scout feedback and publish final results to students.</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setIsCreateScoutOpen(true)}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserPlus className="w-5 h-5 mr-2 text-purple-600" />
                  Manage Scouts
                </CardTitle>
                <CardDescription>Create and manage scout accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Add new scouts to the platform and manage existing scout accounts.</p>
              </CardContent>
            </Card>
          </div>

          {/* Scouts List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Scout Management</span>
                <Badge variant="outline">{scouts.length} Scouts</Badge>
              </CardTitle>
              <CardDescription>Manage scout accounts and monitor their activity</CardDescription>
            </CardHeader>
            <CardContent>
              {scouts.length > 0 ? (
                <div className="space-y-4">
                  {scouts.map((scout) => (
                    <div key={scout.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{scout.name}</h3>
                          <p className="text-sm text-muted-foreground">{scout.email}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline" className="text-xs">{scout.xenId}</Badge>
                            <Badge variant={scout.role === 'scout_admin' ? 'default' : 'secondary'} className="text-xs">
                              {scout.role === 'scout_admin' ? 'Admin' : 'Scout'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(scout.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Scouts Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first scout to start managing submissions.
                  </p>
                  <Button onClick={() => setIsCreateScoutOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create First Scout
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Scout Modal */}
      <Dialog open={isCreateScoutOpen} onOpenChange={setIsCreateScoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Scout</DialogTitle>
            <DialogDescription>
              Add a new scout to the platform with their credentials and XEN ID.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={scoutForm.name}
                onChange={(e) => setScoutForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter scout's full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={scoutForm.email}
                onChange={(e) => setScoutForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter scout's email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={scoutForm.role} onValueChange={(value) => setScoutForm(prev => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xen_scout">Scout</SelectItem>
                  <SelectItem value="scout_admin">Scout Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="xenId">XEN ID *</Label>
              <div className="flex space-x-2">
                <Input
                  id="xenId"
                  value={scoutForm.xenId}
                  onChange={(e) => setScoutForm(prev => ({ ...prev, xenId: e.target.value }))}
                  placeholder="XSC-1234"
                />
                <Button type="button" variant="outline" onClick={generateXenId}>
                  Generate
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp">One-Time Password *</Label>
              <div className="flex space-x-2">
                <Input
                  id="otp"
                  value={scoutForm.otp}
                  onChange={(e) => setScoutForm(prev => ({ ...prev, otp: e.target.value }))}
                  placeholder="123456"
                />
                <Button type="button" variant="outline" onClick={generateOTP}>
                  Generate
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setIsCreateScoutOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateScout}
              disabled={createScoutMutation.isPending}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Scout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}