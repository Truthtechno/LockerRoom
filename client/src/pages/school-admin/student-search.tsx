import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Search, User, Star, Plus, Edit, Trash2, Mail, Phone } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";

type Student = {
  id: string;
  userId: string;
  schoolId: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  grade?: string;
  guardianContact?: string;
  profilePicUrl?: string;
  roleNumber?: string;
  position?: string;
  sport?: string;
  bio?: string;
  createdAt: string;
};

type StudentRating = {
  id: string;
  studentId: string;
  rating: number;
  comments?: string;
  category: string;
  ratedBy: string;
  createdAt: string;
};

const addRatingFormSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().optional(),
  category: z.enum(["overall", "academic", "athletic", "behavior"]).default("overall"),
});

type AddRatingFormData = z.infer<typeof addRatingFormSchema>;

export default function StudentSearch() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showAddRating, setShowAddRating] = useState(false);

  const ratingForm = useForm<AddRatingFormData>({
    resolver: zodResolver(addRatingFormSchema),
    defaultValues: {
      rating: 5,
      category: "overall",
    },
  });

  // Fetch all students when no search query
  const { data: allStudents, isLoading: allStudentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/schools", user?.schoolId, "students"],
    enabled: !!user?.schoolId && !searchQuery,
  });

  // Search students when there's a query
  const { data: searchResults, isLoading: searchLoading } = useQuery<Student[]>({
    queryKey: ["/api/schools", user?.schoolId, "students/search", searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/schools/${user?.schoolId}/students/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: !!user?.schoolId && searchQuery.length > 0,
  });

  // Fetch ratings for selected student
  const { data: ratingsData, isLoading: ratingsLoading } = useQuery<{
    ratings: StudentRating[];
    averageRating: number;
  }>({
    queryKey: ["/api/students", selectedStudent?.id, "ratings"],
    enabled: !!selectedStudent,
  });

  const addRatingMutation = useMutation({
    mutationFn: async (data: AddRatingFormData) => {
      const response = await apiRequest("POST", `/api/students/${selectedStudent?.id}/ratings`, {
        ...data,
        ratedBy: user?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", selectedStudent?.id, "ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "analytics"] });
      // Also invalidate school admin dashboard queries
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "top-performers"] });
      ratingForm.reset();
      setShowAddRating(false);
      toast({
        title: "Rating Added",
        description: "Student rating has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add student rating.",
        variant: "destructive",
      });
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: async (ratingId: string) => {
      const response = await apiRequest("DELETE", `/api/ratings/${ratingId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", selectedStudent?.id, "ratings"] });
      // Also invalidate school admin dashboard queries
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId, "top-performers"] });
      toast({
        title: "Rating Deleted",
        description: "Student rating has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete rating.",
        variant: "destructive",
      });
    },
  });

  const onAddRating = (data: AddRatingFormData) => {
    addRatingMutation.mutate(data);
  };

  const students = searchQuery ? searchResults : allStudents;
  const isLoading = searchQuery ? searchLoading : allStudentsLoading;

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "bg-green-100 text-green-800 border-green-200";
    if (rating >= 3.5) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (rating >= 2.5) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "academic": return "🎓";
      case "athletic": return "⚽";
      case "behavior": return "👍";
      default: return "⭐";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
          {/* Mobile Back Button and Title */}
          <div className="bg-card border-b border-border px-4 py-4 space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/school-admin")}
              className="w-full justify-start -ml-2"
              data-testid="back-to-admin"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Student Search & Ratings</h1>
              <p className="text-sm text-muted-foreground">Search students and manage their performance ratings</p>
            </div>
          </div>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden lg:block bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Student Search & Ratings</h1>
                <p className="text-sm text-muted-foreground">Search students and manage their performance ratings</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Search & Student List */}
          <div className="lg:col-span-1 space-y-6">
            {/* Search Bar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Search className="w-5 h-5 mr-2 text-accent" />
                  Search Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by name, email, grade, or jersey number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Student List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {searchQuery ? `Search Results (${students?.length || 0})` : `All Students (${students?.length || 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                  </div>
                ) : students && students.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                          selectedStudent?.id === student.id ? "bg-muted ring-2 ring-accent" : ""
                        }`}
                        data-testid={`student-${student.id}`}
                      >
                        <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                          {student.profilePicUrl ? (
                            <img
                              src={student.profilePicUrl}
                              alt={student.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-accent" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{student.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.grade && `Grade ${student.grade}`}
                            {student.sport && ` • ${student.sport}`}
                            {student.roleNumber && ` #${student.roleNumber}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      {searchQuery ? "No results found" : "No students"}
                    </h3>
                    <p className="text-muted-foreground">
                      {searchQuery 
                        ? "Try adjusting your search terms"
                        : "No students have been registered yet"
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Student Details & Ratings */}
          <div className="lg:col-span-2">
            {selectedStudent ? (
              <div className="space-y-6">
                {/* Student Profile */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <User className="w-5 h-5 mr-2 text-accent" />
                        Student Profile
                      </div>
                      <div className="flex items-center space-x-2">
                        {ratingsData && (
                          <Badge 
                            variant="outline" 
                            className={getRatingColor(ratingsData.averageRating)}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            {ratingsData.averageRating.toFixed(1)}/5
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start space-x-6">
                      <div className="w-24 h-24 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        {selectedStudent.profilePicUrl ? (
                          <img
                            src={selectedStudent.profilePicUrl}
                            alt={selectedStudent.name}
                            className="w-24 h-24 rounded-lg object-cover"
                          />
                        ) : (
                          <User className="w-12 h-12 text-accent" />
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h3 className="text-lg font-semibold">{selectedStudent.name}</h3>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-2" />
                                {selectedStudent.email}
                              </div>
                              {selectedStudent.phone && (
                                <div className="flex items-center">
                                  <Phone className="w-3 h-3 mr-2" />
                                  {selectedStudent.phone}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            {selectedStudent.grade && (
                              <Badge variant="outline">Grade {selectedStudent.grade}</Badge>
                            )}
                            {selectedStudent.sport && (
                              <Badge variant="outline">{selectedStudent.sport}</Badge>
                            )}
                            {selectedStudent.position && (
                              <Badge variant="outline">{selectedStudent.position}</Badge>
                            )}
                            {selectedStudent.roleNumber && (
                              <Badge variant="outline">#{selectedStudent.roleNumber}</Badge>
                            )}
                          </div>
                        </div>

                        {selectedStudent.bio && (
                          <div>
                            <h4 className="font-medium text-sm mb-1">Bio</h4>
                            <p className="text-sm text-muted-foreground">{selectedStudent.bio}</p>
                          </div>
                        )}

                        {selectedStudent.guardianContact && (
                          <div>
                            <h4 className="font-medium text-sm mb-1">Guardian Contact</h4>
                            <p className="text-sm text-muted-foreground">{selectedStudent.guardianContact}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ratings Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          <Star className="w-5 h-5 mr-2 text-accent" />
                          Performance Ratings
                        </CardTitle>
                        <CardDescription>
                          {ratingsData?.ratings.length || 0} rating(s) • Average: {ratingsData?.averageRating.toFixed(1) || '0.0'}/5
                        </CardDescription>
                      </div>
                      
                      <Dialog open={showAddRating} onOpenChange={setShowAddRating}>
                        <DialogTrigger asChild>
                          <Button className="gold-gradient text-accent-foreground" data-testid="button-add-rating">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Rating
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Performance Rating</DialogTitle>
                            <DialogDescription>
                              Rate {selectedStudent.name}'s performance in different areas.
                            </DialogDescription>
                          </DialogHeader>
                          <Form {...ratingForm}>
                            <form onSubmit={ratingForm.handleSubmit(onAddRating)} className="space-y-4">
                              <FormField
                                control={ratingForm.control}
                                name="category"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-rating-category">
                                          <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="overall">Overall Performance</SelectItem>
                                        <SelectItem value="academic">Academic</SelectItem>
                                        <SelectItem value="athletic">Athletic</SelectItem>
                                        <SelectItem value="behavior">Behavior</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={ratingForm.control}
                                name="rating"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Rating (1-5 stars)</FormLabel>
                                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-rating-value">
                                          <SelectValue placeholder="Select rating" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent (5)</SelectItem>
                                        <SelectItem value="4">⭐⭐⭐⭐ Good (4)</SelectItem>
                                        <SelectItem value="3">⭐⭐⭐ Average (3)</SelectItem>
                                        <SelectItem value="2">⭐⭐ Below Average (2)</SelectItem>
                                        <SelectItem value="1">⭐ Poor (1)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={ratingForm.control}
                                name="comments"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Comments (Optional)</FormLabel>
                                    <FormControl>
                                      <Textarea 
                                        placeholder="Additional feedback..." 
                                        {...field} 
                                        data-testid="textarea-rating-comments"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <DialogFooter>
                                <Button 
                                  type="submit" 
                                  disabled={addRatingMutation.isPending}
                                  data-testid="button-submit-rating"
                                >
                                  {addRatingMutation.isPending ? "Adding..." : "Add Rating"}
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {ratingsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                      </div>
                    ) : ratingsData?.ratings && ratingsData.ratings.length > 0 ? (
                      <div className="space-y-4">
                        {ratingsData.ratings.map((rating) => (
                          <div
                            key={rating.id}
                            className="flex items-start justify-between p-4 bg-muted rounded-lg"
                            data-testid={`rating-${rating.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-lg">{getCategoryIcon(rating.category)}</span>
                                <Badge variant="outline" className={getRatingColor(rating.rating)}>
                                  {rating.rating}/5
                                </Badge>
                                <Badge variant="secondary" className="capitalize">
                                  {rating.category}
                                </Badge>
                              </div>
                              {rating.comments && (
                                <p className="text-sm text-muted-foreground mb-2">{rating.comments}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Added {new Date(rating.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRatingMutation.mutate(rating.id)}
                              disabled={deleteRatingMutation.isPending}
                              data-testid={`delete-rating-${rating.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No Ratings Yet</h3>
                        <p className="text-muted-foreground mb-6">
                          This student hasn't been rated yet. Add their first performance rating.
                        </p>
                        <Button 
                          onClick={() => setShowAddRating(true)}
                          className="gold-gradient text-accent-foreground"
                          data-testid="button-add-first-rating"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Rating
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-20">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-xl font-medium text-foreground mb-4">Select a Student</h3>
                <p className="text-muted-foreground mb-8">
                  Search for a student on the left or select one from the list to view their profile and ratings.
                </p>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}