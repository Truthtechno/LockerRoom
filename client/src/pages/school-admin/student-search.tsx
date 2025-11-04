import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Search, User, BarChart3, Mail, Phone, Heart, MessageCircle, Bookmark, Eye, Users, Calendar, Menu, X } from "lucide-react";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { formatHeight } from "@/lib/height-utils";

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
  height?: string;
  weight?: string;
  createdAt: string;
};

type StudentStats = {
  posts: number;
  followers: number;
  likes: number;
  comments: number;
  saves: number;
  views: number;
  engagement: number;
  activePostDays: number;
};

const STUDENTS_PER_PAGE = 10;

// Component for post media preview
function PostMediaPreview({ post }: { post: any }) {
  const [imageError, setImageError] = useState(false);
  const mediaUrl = post.effectiveMediaUrl || post.mediaUrl || '';
  const mediaType = post.effectiveMediaType || post.mediaType || 'image';
  const hasMedia = !!mediaUrl;
  
  if (!hasMedia || imageError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl">
        📄
      </div>
    );
  }
  
  if (mediaType === 'video') {
    return (
      <>
        <video
          src={mediaUrl}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-6 h-6 border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-0 h-0 border-l-[6px] border-l-white border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5"></div>
          </div>
        </div>
      </>
    );
  }
  
  return (
    <img
      src={mediaUrl}
      alt="Post preview"
      className="w-full h-full object-cover"
      onError={() => setImageError(true)}
    />
  );
}

export default function StudentSearch() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

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

  // Fetch stats for selected student
  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery<StudentStats>({
    queryKey: ["/api/students", selectedStudent?.id, "stats"],
    queryFn: async () => {
      if (!selectedStudent?.id) {
        throw new Error("No student selected");
      }
      const response = await apiRequest("GET", `/api/students/${selectedStudent.id}/stats`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch stats: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Student stats loaded:", data);
      return data;
    },
    enabled: !!selectedStudent?.id,
    retry: 1,
  });

  // Fetch posts for selected student
  const { data: studentPosts, isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/posts/student", selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent?.id) {
        throw new Error("No student selected");
      }
      const response = await apiRequest("GET", `/api/posts/student/${selectedStudent.id}?limit=50`);
      if (!response.ok) {
        throw new Error("Failed to fetch student posts");
      }
      const data = await response.json();
      return data;
    },
    enabled: !!selectedStudent?.id,
  });

  const students = searchQuery ? searchResults : allStudents;
  const isLoading = searchQuery ? searchLoading : allStudentsLoading;

  // Pagination logic
  const totalPages = Math.ceil((students?.length || 0) / STUDENTS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    if (!students) return [];
    const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
    const endIndex = startIndex + STUDENTS_PER_PAGE;
    return students.slice(startIndex, endIndex);
  }, [students, currentPage]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Handle student selection (close mobile drawer when selecting)
  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setIsMobileListOpen(false);
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
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/school-admin")}
                className="justify-start -ml-2"
                data-testid="back-to-admin"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileListOpen(true)}
                className="lg:hidden"
              >
                <Menu className="w-4 h-4 mr-2" />
                Browse Students
              </Button>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Student Search</h1>
              <p className="text-sm text-muted-foreground">Search students and view their profile statistics</p>
            </div>
          </div>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden lg:block bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Student Search</h1>
                <p className="text-sm text-muted-foreground">Search students and view their profile statistics</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Search & Student List - Desktop */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
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
                    onChange={(e) => handleSearchChange(e.target.value)}
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
                  <>
                    <div className="space-y-3">
                      {paginatedStudents.map((student) => (
                        <div
                          key={student.id}
                          onClick={() => handleStudentSelect(student)}
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
                    {totalPages > 1 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              return (
                                <PaginationItem key={pageNum}>
                                  <PaginationLink
                                    onClick={() => setCurrentPage(pageNum)}
                                    isActive={currentPage === pageNum}
                                    className="cursor-pointer"
                                  >
                                    {pageNum}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            })}
                            <PaginationItem>
                              <PaginationNext 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Page {currentPage} of {totalPages} • Showing {((currentPage - 1) * STUDENTS_PER_PAGE) + 1}-{Math.min(currentPage * STUDENTS_PER_PAGE, students.length)} of {students.length}
                        </p>
                      </div>
                    )}
                  </>
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

          {/* Mobile Search Bar - Always visible on mobile */}
          <div className="lg:hidden mb-6">
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
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {!selectedStudent && (
                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    onClick={() => setIsMobileListOpen(true)}
                  >
                    <Menu className="w-4 h-4 mr-2" />
                    Browse All Students
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Student Details & Statistics */}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsMobileListOpen(true)}
                        className="lg:hidden"
                      >
                        <Menu className="w-4 h-4 mr-2" />
                        Change Student
                      </Button>
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

                        {/* Physical Attributes */}
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                          {selectedStudent.height && (
                            <div>
                              <h4 className="font-medium text-sm mb-1">Height</h4>
                              <p className="text-sm text-muted-foreground">{formatHeight(selectedStudent.height)}</p>
                            </div>
                          )}
                          {selectedStudent.weight && (
                            <div>
                              <h4 className="font-medium text-sm mb-1">Weight</h4>
                              <p className="text-sm text-muted-foreground">{selectedStudent.weight} kg</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Student Stats Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          <BarChart3 className="w-5 h-5 mr-2 text-accent" />
                          Student Statistics
                        </CardTitle>
                        <CardDescription>
                          Overview of student's page activity and engagement metrics
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                      </div>
                    ) : statsError ? (
                      <div className="text-center py-12">
                        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Statistics</h3>
                        <p className="text-muted-foreground">
                          {statsError instanceof Error ? statsError.message : 'Failed to load statistics. Please try again.'}
                        </p>
                      </div>
                    ) : statsData !== undefined && statsData !== null ? (
                      <div className="space-y-6">
                        {/* Main Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-muted-foreground">Posts</p>
                              <BarChart3 className="w-4 h-4 text-accent" />
                            </div>
                            <p className="text-2xl font-bold">{statsData.posts}</p>
                          </div>
                          
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-muted-foreground">Followers</p>
                              <Users className="w-4 h-4 text-accent" />
                            </div>
                            <p className="text-2xl font-bold">{statsData.followers}</p>
                          </div>
                          
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-muted-foreground">Total Engagement</p>
                              <BarChart3 className="w-4 h-4 text-accent" />
                            </div>
                            <p className="text-2xl font-bold">{statsData.engagement.toLocaleString()}</p>
                          </div>
                          
                          <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-muted-foreground">Active Days</p>
                              <Calendar className="w-4 h-4 text-accent" />
                            </div>
                            <p className="text-2xl font-bold">{statsData.activePostDays}</p>
                          </div>
                        </div>

                        {/* Engagement Breakdown */}
                        <div>
                          <h4 className="font-medium text-sm mb-4">Engagement Breakdown</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-background border border-border rounded-lg">
                              <div className="flex items-center space-x-2 mb-1">
                                <Heart className="w-4 h-4 text-red-500" />
                                <p className="text-sm text-muted-foreground">Likes</p>
                              </div>
                              <p className="text-xl font-semibold">{statsData.likes.toLocaleString()}</p>
                            </div>
                            
                            <div className="p-3 bg-background border border-border rounded-lg">
                              <div className="flex items-center space-x-2 mb-1">
                                <MessageCircle className="w-4 h-4 text-blue-500" />
                                <p className="text-sm text-muted-foreground">Comments</p>
                              </div>
                              <p className="text-xl font-semibold">{statsData.comments.toLocaleString()}</p>
                            </div>
                            
                            <div className="p-3 bg-background border border-border rounded-lg">
                              <div className="flex items-center space-x-2 mb-1">
                                <Bookmark className="w-4 h-4 text-yellow-500" />
                                <p className="text-sm text-muted-foreground">Saves</p>
                              </div>
                              <p className="text-xl font-semibold">{statsData.saves.toLocaleString()}</p>
                            </div>
                            
                            <div className="p-3 bg-background border border-border rounded-lg">
                              <div className="flex items-center space-x-2 mb-1">
                                <Eye className="w-4 h-4 text-purple-500" />
                                <p className="text-sm text-muted-foreground">Views</p>
                              </div>
                              <p className="text-xl font-semibold">{statsData.views.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        {/* Additional Metrics */}
                        <div className="pt-4 border-t border-border">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">Average Engagement per Post</p>
                              <p className="text-lg font-semibold">
                                {statsData.posts > 0 
                                  ? (statsData.engagement / statsData.posts).toFixed(1) 
                                  : '0.0'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Engagement Rate</p>
                              <p className="text-lg font-semibold">
                                {statsData.views > 0 
                                  ? ((statsData.engagement / statsData.views) * 100).toFixed(1) + '%'
                                  : 'N/A'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {statsData.views > 0 
                                  ? `${statsData.engagement} engagements / ${statsData.views} views`
                                  : 'No views yet'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Student Posts with Engagement */}
                        {selectedStudent && (
                          <div className="pt-6 border-t border-border mt-6">
                            <h4 className="font-medium text-sm mb-4">Student Posts & Engagement</h4>
                            {postsLoading ? (
                              <div className="text-center py-8 text-muted-foreground">
                                Loading posts...
                              </div>
                            ) : studentPosts && studentPosts.length > 0 ? (
                              <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                                {studentPosts.map((post) => {
                                  return (
                                    <div 
                                      key={post.id}
                                      onClick={() => window.location.href = `/post/${post.id}`}
                                      className="p-4 bg-background border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                    >
                                      <div className="flex items-start gap-4">
                                        {/* Media Preview */}
                                        <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted relative">
                                          <PostMediaPreview post={post} />
                                        </div>
                                        
                                        {/* Post Content */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2">
                                            <p className="text-xs text-muted-foreground">
                                              {new Date(post.createdAt).toLocaleDateString()}
                                            </p>
                                          </div>
                                          {post.caption && (
                                            <p className="text-sm text-foreground mb-3 line-clamp-2">
                                              {post.caption}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                              <Eye className="w-3 h-3" />
                                              <span>{post.viewCount || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Heart className="w-3 h-3 text-red-500" />
                                              <span>{post.likesCount || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <MessageCircle className="w-3 h-3 text-blue-500" />
                                              <span>{post.commentsCount || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Bookmark className="w-3 h-3 text-yellow-500" />
                                              <span>{post.savesCount || 0}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <p>No posts found for this student.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No Statistics Available</h3>
                        <p className="text-muted-foreground">
                          Statistics will appear once the student starts posting content.
                        </p>
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
                  Search for a student on the left or select one from the list to view their profile and statistics.
                </p>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Mobile Student List Sheet */}
      <Sheet open={isMobileListOpen} onOpenChange={setIsMobileListOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Students</SheetTitle>
            <SheetDescription>
              {searchQuery ? `Search Results (${students?.length || 0})` : `All Students (${students?.length || 0})`}
            </SheetDescription>
          </SheetHeader>
          
          {/* Mobile Search */}
          <div className="mt-6 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name, email, grade, or jersey number..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Mobile Student List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
              </div>
            ) : students && students.length > 0 ? (
              <>
                {paginatedStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                      selectedStudent?.id === student.id ? "bg-muted ring-2 ring-accent" : ""
                    }`}
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
                
                {totalPages > 1 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNum)}
                                isActive={currentPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Page {currentPage} of {totalPages} • Showing {((currentPage - 1) * STUDENTS_PER_PAGE) + 1}-{Math.min(currentPage * STUDENTS_PER_PAGE, students.length)} of {students.length}
                    </p>
                  </div>
                )}
              </>
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
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}