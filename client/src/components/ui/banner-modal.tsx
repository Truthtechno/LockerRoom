import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import type { Banner } from "@/components/admin/banner-management";

interface BannerModalProps {
  banner?: Banner | null; // If provided, edit mode; otherwise, create mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BannerModal({ banner, open, onOpenChange }: BannerModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    category: 'info' as 'info' | 'warning' | 'success' | 'error' | 'announcement',
    targetRoles: [] as string[],
    targetSchoolIds: [] as string[], // Only used when school_admin is selected
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    priority: 0,
    isActive: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!banner;
  
  // Fetch schools list when school_admin role is selected
  const { data: schoolsData } = useQuery({
    queryKey: ["/api/system-admin/schools"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/system-admin/schools");
      if (!response.ok) throw new Error('Failed to fetch schools');
      return response.json();
    },
    enabled: formData.targetRoles.includes('school_admin') && open, // Only fetch when school_admin is selected and modal is open
  });
  const schools = schoolsData?.schools || [];

  // Initialize form data when banner is provided or modal opens
  useEffect(() => {
    if (banner) {
      // Edit mode - populate form with existing data
      const startDateTime = banner.startDate ? new Date(banner.startDate) : null;
      const endDateTime = banner.endDate ? new Date(banner.endDate) : null;
      
      setFormData({
        title: banner.title,
        message: banner.message,
        category: banner.category,
        targetRoles: banner.targetRoles || [],
        targetSchoolIds: (banner as any).targetSchoolIds || [],
        startDate: startDateTime ? startDateTime.toISOString().split('T')[0] : '',
        startTime: startDateTime ? startDateTime.toTimeString().slice(0, 5) : '',
        endDate: endDateTime ? endDateTime.toISOString().split('T')[0] : '',
        endTime: endDateTime ? endDateTime.toTimeString().slice(0, 5) : '',
        priority: banner.priority || 0,
        isActive: banner.isActive,
      });
    } else {
      // Create mode - reset form
      setFormData({
        title: '',
        message: '',
        category: 'info',
        targetRoles: [],
        targetSchoolIds: [],
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        priority: 0,
        isActive: true,
      });
    }
  }, [banner, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and message for the banner.",
        variant: "destructive",
      });
      return;
    }

    if (formData.targetRoles.length === 0) {
      toast({
        title: "Missing Target Roles",
        description: "Please select at least one target role.",
        variant: "destructive",
      });
      return;
    }

    // Combine date and time for start/end dates
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (formData.startDate) {
      if (formData.startTime) {
        startDate = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
      } else {
        startDate = new Date(`${formData.startDate}T00:00:00`).toISOString();
      }
    }

    if (formData.endDate) {
      if (formData.endTime) {
        endDate = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();
      } else {
        endDate = new Date(`${formData.endDate}T23:59:59`).toISOString();
      }
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      toast({
        title: "Invalid Date Range",
        description: "End date must be after start date.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Note: School selection is optional - if no schools selected, banner targets all schools

      const payload: any = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        category: formData.category,
        targetRoles: formData.targetRoles,
        startDate: startDate,
        endDate: endDate,
        priority: formData.priority,
        isActive: formData.isActive,
      };

      // Only include targetSchoolIds if school_admin is in targetRoles
      if (formData.targetRoles.includes('school_admin')) {
        payload.targetSchoolIds = formData.targetSchoolIds.length > 0 ? formData.targetSchoolIds : null;
      }

      const endpoint = isEditMode
        ? `/api/system-admin/banners/${banner!.id}`
        : '/api/system-admin/banners';
      
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await apiRequest(method, endpoint, payload);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to save banner');
      }

      toast({
        title: isEditMode ? "Banner Updated" : "Banner Created",
        description: `Your banner has been ${isEditMode ? 'updated' : 'created'} successfully!`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/system-admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners/active"] });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save banner",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: string) => {
    setFormData(prev => {
      const isCurrentlySelected = prev.targetRoles.includes(role);
      const newTargetRoles = isCurrentlySelected
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role];
      
      // Clear targetSchoolIds if school_admin is deselected
      const newTargetSchoolIds = role === 'school_admin' && isCurrentlySelected
        ? []
        : prev.targetSchoolIds;
      
      return {
        ...prev,
        targetRoles: newTargetRoles,
        targetSchoolIds: newTargetSchoolIds,
      };
    });
  };

  const handleSchoolToggle = (schoolId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      targetSchoolIds: checked
        ? [...prev.targetSchoolIds, schoolId]
        : prev.targetSchoolIds.filter(id => id !== schoolId),
    }));
  };

  const handleSelectAllSchools = () => {
    setFormData(prev => ({
      ...prev,
      targetSchoolIds: schools.length === prev.targetSchoolIds.length
        ? []
        : schools.map((s: any) => s.id),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-accent" />
            {isEditMode ? 'Edit Banner' : 'Create Banner'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update your banner details below.'
              : 'Create a new banner that will appear on dashboards for selected roles.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <form onSubmit={handleSubmit} id="banner-form" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter banner title..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter banner message..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info (Blue)</SelectItem>
                  <SelectItem value="warning">Warning (Yellow)</SelectItem>
                  <SelectItem value="success">Success (Green)</SelectItem>
                  <SelectItem value="error">Error (Red)</SelectItem>
                  <SelectItem value="announcement">Announcement (Purple)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Roles *</Label>
              <div className="space-y-2">
                {['scout_admin', 'school_admin', 'xen_scout', 'xen_watch'].map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`role-${role}`}
                      checked={formData.targetRoles.includes(role)}
                      onChange={() => handleRoleToggle(role)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`role-${role}`} className="font-normal cursor-pointer">
                      {role === 'scout_admin' ? 'Scout Admin' : 
                       role === 'school_admin' ? 'School Admin' : 
                       role === 'xen_scout' ? 'XEN Scout' : 
                       'XEN Watch Page'}
                    </Label>
                  </div>
                ))}
              </div>
              
            </div>

            {/* School Selection - Only show when School Admin is selected */}
            {formData.targetRoles.includes('school_admin') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Schools</Label>
                  {schools.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllSchools}
                      className="h-auto py-1 text-xs"
                    >
                      {formData.targetSchoolIds.length === schools.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-background">
                  {schools.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                      <p>Loading schools...</p>
                    </div>
                  ) : (
                    schools.map((school: any) => (
                      <div key={school.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`school-${school.id}`}
                          checked={formData.targetSchoolIds.includes(school.id)}
                          onCheckedChange={(checked) => handleSchoolToggle(school.id, checked === true)}
                        />
                        <Label
                          htmlFor={`school-${school.id}`}
                          className="flex-1 font-normal cursor-pointer text-sm"
                        >
                          {school.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {formData.targetSchoolIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formData.targetSchoolIds.length} school{formData.targetSchoolIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
                {formData.targetSchoolIds.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No schools selected - banner will appear for all school admins. Select specific schools to target them only.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date (Optional)</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time (Optional)</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time (Optional)</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                placeholder="0 (higher = displayed first)"
              />
              <p className="text-xs text-muted-foreground">
                Higher priority banners are displayed first. Default is 0.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Banner is active
              </Label>
            </div>
          </form>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="banner-form"
            disabled={loading}
            className="bg-accent hover:bg-accent/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                {isEditMode ? 'Update Banner' : 'Create Banner'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

