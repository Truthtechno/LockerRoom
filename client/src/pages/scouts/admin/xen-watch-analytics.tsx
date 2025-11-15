import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Eye, 
  CheckCircle,
  Clock,
  Star,
  BarChart3,
  Download,
  Calendar,
  Activity,
  Target,
  Award
} from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';

interface AnalyticsData {
  totals: {
    total_submissions: number;
    paid: number;
    reviewed: number;
    feedback_sent: number;
    avg_rating: number;
    total_scouts: number;
    total_revenue?: number;
    avg_submission_value?: number;
  };
  topStudents: Array<{
    student_id: string;
    name: string;
    avg_rating: number;
    total_submissions: number;
  }>;
  topSchools: Array<{
    school_id: string;
    name: string;
    avg_rating: number;
    total_submissions: number;
  }>;
}

export default function XenWatchAnalytics() {
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState('all');
  const [isCreatingSampleData, setIsCreatingSampleData] = useState(false);

  // Fetch analytics data
  const { data: analytics, isLoading, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ["/api/xen-watch/analytics/overview", timeFilter],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/xen-watch/analytics/overview?timeFilter=${timeFilter}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to fetch analytics`);
        }
        const data = await response.json();
        return data;
      } catch (err) {
        console.error('Analytics fetch error:', err);
        throw err;
      }
    },
    retry: 2,
    retryDelay: 1000,
    refetchInterval: 30000 // Refetch every 30 seconds for real-time updates
  });

  // Fetch scout performance data separately
  const { data: scoutData, isLoading: scoutLoading } = useQuery({
    queryKey: ["/api/scouts/analytics", timeFilter],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/scouts/analytics?timeFilter=${timeFilter}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to fetch scout data`);
        }
        const data = await response.json();
        return data;
      } catch (err) {
        console.error('Scout data fetch error:', err);
        throw err;
      }
    },
    retry: 2,
    retryDelay: 1000
  });

  // Prepare chart data from topStudents
  const chartData = useMemo(() => {
    if (!analytics?.topStudents || !Array.isArray(analytics.topStudents)) return [];
    
    return analytics.topStudents
      .slice(0, 10)
      .map(student => ({
        name: student.name.split(' ')[0], // First name only
        reviews: student.total_submissions,
        rating: student.avg_rating,
        efficiency: 100 // All players have completed their submissions
      }));
  }, [analytics]);

  const revenueData = useMemo(() => {
    if (!analytics?.totals) return [];
    
    return [
      { name: 'Paid Submissions', value: analytics.totals.paid },
      { name: 'Pending', value: (analytics.totals.total_submissions || 0) - analytics.totals.paid }
    ];
  }, [analytics]);

  const submissionTrendData = useMemo(() => {
    if (!analytics?.totals) return [];
    
    return [
      { name: 'In Review', value: analytics.totals.reviewed, color: '#3b82f6' },
      { name: 'Finalized', value: analytics.totals.feedback_sent, color: '#10b981' },
      { name: 'Rejected', value: 0, color: '#ef4444' } // No rejected submissions in current data
    ];
  }, [analytics]);

  // Export to Excel
  const exportToExcel = () => {
    if (!analytics) return;

    // Prepare comprehensive analytics report
    const exportData = [
      // Summary data
      {
        'Metric': 'Total Submissions',
        'Value': analytics.totals.total_submissions || 0,
        'Category': 'Submissions'
      },
      {
        'Metric': 'In Review',
        'Value': analytics.totals.reviewed || 0,
        'Category': 'Submissions'
      },
      {
        'Metric': 'Finalized',
        'Value': analytics.totals.feedback_sent || 0,
        'Category': 'Submissions'
      },
      {
        'Metric': 'Rejected',
        'Value': 0, // No rejected submissions in current data
        'Category': 'Submissions'
      },
      {
        'Metric': 'Average Final Rating',
        'Value': analytics.totals.avg_rating?.toFixed(2) || 'N/A',
        'Category': 'Quality'
      },
      {
        'Metric': 'Total Revenue',
        'Value': `$${(analytics.totals.total_revenue || 0).toFixed(2)}`,
        'Category': 'Revenue'
      },
      {
        'Metric': 'Paid Submissions',
        'Value': analytics.totals.paid || 0,
        'Category': 'Revenue'
      },
      {
        'Metric': 'Average Submission Value',
        'Value': analytics.totals.avg_submission_value 
          ? `$${Number(analytics.totals.avg_submission_value).toFixed(2)}`
          : '$0.00',
        'Category': 'Revenue'
      },
      {
        'Metric': 'Active Scouts',
        'Value': analytics.totals.total_scouts || 0,
        'Category': 'Scouts'
      }
    ];

    // Add scout performance data
    if (Array.isArray(scoutData?.scoutStats)) {
      scoutData.scoutStats.forEach((scout: any, index: number) => {
        exportData.push({
          'Metric': `Scout ${index + 1} - ${scout.name}`,
          'Value': `${scout.completed_reviews} reviews (${scout.avg_rating?.toFixed(1) || 'N/A'} avg rating)`,
          'Category': 'Scout Performance'
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'XEN Watch Analytics Report');
    
    // Style the worksheet
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellAddress]) continue;
        
        if (row === 0) {
          // Header row styling
          ws[cellAddress].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4472C4" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        } else {
          ws[cellAddress].s = {
            alignment: { horizontal: "left", vertical: "center" }
          };
        }
      }
    }

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Metric
      { wch: 25 }, // Value
      { wch: 20 }  // Category
    ];

    XLSX.writeFile(wb, `xen-watch-analytics-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Complete",
      description: "XEN Watch analytics report has been exported to Excel.",
    });
  };

  const createSampleData = async () => {
    try {
      setIsCreatingSampleData(true);
      const response = await apiRequest("POST", "/api/scouts/create-sample-data");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(errorData.error?.message || 'Failed to create sample data');
      }

      const result = await response.json();
      
      toast({
        title: "Sample Data Created",
        description: result.message || "Sample scouts, submissions, and reviews have been created successfully",
      });

      // Refresh the analytics data
      refetch();
    } catch (error) {
      console.error('Error creating sample data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create sample data",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSampleData(false);
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (isLoading || scoutLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64 pb-24 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="text-destructive mb-4 text-lg font-semibold">
                Failed to load analytics
              </div>
              <div className="text-muted-foreground mb-6 max-w-md mx-auto">
                {error instanceof Error ? error.message : 'An unexpected error occurred while loading analytics data.'}
              </div>
              <div className="space-x-4">
                <Button onClick={() => refetch()} variant="default">
                  Try Again
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Refresh Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle empty data state
  if (analytics && analytics.totals.total_submissions === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <MobileNav />
        <div className="lg:pl-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Mobile Header */}
            <div className="lg:hidden">
              <Header />
            </div>
            
            {/* Page Title */}
            <div className="mb-8">
              <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">XEN Watch Analytics</h1>
                  <p className="text-muted-foreground text-sm lg:text-base">
                    Comprehensive revenue and performance insights for the XEN Watch system
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <Calendar className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="6m">Last 6 Months</SelectItem>
                      <SelectItem value="1y">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Empty State */}
            <div className="text-center py-16">
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                <BarChart3 className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No Analytics Data Available</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                There's no data to display yet. Analytics will appear once scouts are added and submissions are created.
              </p>
              <div className="space-x-4">
                <Button onClick={() => window.location.href = '/scouts/admin/manage-scouts'} variant="default">
                  Create Scouts
                </Button>
                <Button onClick={() => window.location.href = '/xen-watch/scout-queue'} variant="outline">
                  View Submissions
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <div className="lg:pl-64 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Title */}
          <div className="mb-8">
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">XEN Watch Analytics</h1>
                <p className="text-muted-foreground text-sm lg:text-base">
                  Comprehensive revenue and performance insights for the XEN Watch system
                </p>
              </div>
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="6m">Last 6 Months</SelectItem>
                    <SelectItem value="1y">Last Year</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex space-x-2">
                  <Button onClick={exportToExcel} variant="outline" className="flex items-center space-x-2 flex-1 sm:flex-none">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export Excel</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                  <Button 
                    onClick={createSampleData} 
                    variant="secondary" 
                    className="flex items-center space-x-2 flex-1 sm:flex-none"
                    disabled={isCreatingSampleData}
                  >
                    <Activity className="w-4 h-4" />
                    <span className="hidden sm:inline">{isCreatingSampleData ? 'Creating...' : 'Create Sample Data'}</span>
                    <span className="sm:hidden">{isCreatingSampleData ? 'Creating...' : 'Sample'}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl leading-tight tabular-nums font-bold text-green-600">
                  ${(analytics?.totals.total_revenue || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {analytics?.totals.paid || 0} paid submissions
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Submission Volume</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl leading-tight tabular-nums font-bold text-blue-600">
                  {analytics?.totals.total_submissions || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total submissions processed
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl leading-tight tabular-nums font-bold text-purple-600">
                  {analytics?.totals.total_submissions 
                    ? Math.round(((analytics.totals.feedback_sent || 0) / analytics.totals.total_submissions) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Submissions finalized
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl leading-tight tabular-nums font-bold text-yellow-600">
                  {analytics?.totals.avg_rating ? Number(analytics.totals.avg_rating).toFixed(1) : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Out of 5.0 stars
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            {/* Top Performing Scouts */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Scouts</CardTitle>
                <CardDescription>
                  Scouts with the highest review completion rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 lg:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="reviews" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Submission Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Submission Status Distribution</CardTitle>
                <CardDescription>
                  Current status of all submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 lg:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={submissionTrendData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {submissionTrendData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Analytics */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>
                  Paid vs pending submission revenue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 lg:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {revenueData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Metrics</CardTitle>
                <CardDescription>
                  Key financial performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Average Submission Value</p>
                        <p className="text-xs text-muted-foreground">Per paid submission</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        ${analytics?.totals.avg_submission_value 
                          ? Number(analytics.totals.avg_submission_value).toFixed(2)
                          : '0.00'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Conversion Rate</p>
                        <p className="text-xs text-muted-foreground">Paid vs total submissions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {analytics?.totals.total_submissions 
                          ? Math.round(((analytics.totals.paid || 0) / analytics.totals.total_submissions) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Activity className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Active Scouts</p>
                        <p className="text-xs text-muted-foreground">Currently reviewing</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{analytics?.totals.total_scouts || 0}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scout Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Scout Performance Overview</CardTitle>
              <CardDescription>
                Individual scout statistics and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80 lg:h-96">
                <div className="space-y-4">
                  {Array.isArray(scoutData?.scoutStats) && scoutData.scoutStats.map((scout: any, index: number) => (
                    <div key={scout.id} className="flex flex-col space-y-3 p-4 bg-muted rounded-lg lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{scout.name}</p>
                          <p className="text-sm text-muted-foreground">{scout.xen_id}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 lg:flex lg:items-center lg:space-x-6 text-sm">
                        <div className="text-center">
                          <p className="font-semibold text-blue-600">{scout.completed_reviews}</p>
                          <p className="text-xs text-muted-foreground">Reviews</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-yellow-600">{scout.avg_rating ? Number(scout.avg_rating).toFixed(1) : 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">Avg Rating</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-green-600">{scout.high_quality_reviews}</p>
                          <p className="text-xs text-muted-foreground">High Quality</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-red-600">{scout.low_quality_reviews}</p>
                          <p className="text-xs text-muted-foreground">Low Quality</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
