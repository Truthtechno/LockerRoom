import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Sidebar from "@/components/navigation/sidebar";
import MobileNav from "@/components/navigation/mobile-nav";
import Header from "@/components/navigation/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AvatarWithFallback from "@/components/ui/avatar-with-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, UserPlus, UserMinus, MapPin, ArrowUpDown, Users, Filter, X } from "lucide-react";
import type { StudentSearchResult } from "@shared/schema";

type SortField = 'name' | 'school' | 'position' | 'sport' | 'followers' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface FilterOptions {
  schools: Array<{ id: string; name: string }>;
  sports: string[];
  positions: string[];
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>('followers');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showAll, setShowAll] = useState(false);
  const [filterSchoolId, setFilterSchoolId] = useState<string>("");
  const [filterSport, setFilterSport] = useState<string>("");
  const [filterPosition, setFilterPosition] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Fetch filter options
  const { data: filterOptions, isLoading: filtersLoading } = useQuery<FilterOptions>({
    queryKey: ["/api/search/filters"],
    queryFn: async () => {
      const response = await fetch("/api/search/filters");
      if (!response.ok) throw new Error('Failed to fetch filters');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Determine if we should fetch results
  const shouldFetch = showAll || debouncedQuery.length >= 2 || !!filterSchoolId || !!filterSport || !!filterPosition;
  const effectiveQuery = showAll ? undefined : debouncedQuery;

  // Check if any filters are active
  const hasActiveFilters = !!filterSchoolId || !!filterSport || !!filterPosition;

  const { data: searchResults, isLoading } = useQuery<StudentSearchResult[]>({
    queryKey: ["/api/search/students", effectiveQuery, user?.id, sortBy, sortOrder, filterSchoolId, filterSport, filterPosition],
    enabled: shouldFetch,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveQuery) {
        params.append('q', effectiveQuery);
      }
      if (user?.id) {
        params.append('userId', user.id);
      }
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('limit', '200'); // Increase limit for "show all" mode
      
      // Add filters
      if (filterSchoolId) {
        params.append('schoolId', filterSchoolId);
      }
      if (filterSport) {
        params.append('sport', filterSport);
      }
      if (filterPosition) {
        params.append('position', filterPosition);
      }
      
      const response = await fetch(`/api/search/students?${params}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    staleTime: 30_000, // Cache search results for 30 seconds
    retry: 2,
  });

  const followMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'follow' | 'unfollow' }) => {
      if (action === 'follow') {
        return apiRequest("POST", `/api/users/${userId}/follow`);
      } else {
        return apiRequest("DELETE", `/api/users/${userId}/follow`);
      }
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.action === 'follow' ? 'Following' : 'Unfollowed',
        description: variables.action === 'follow' 
          ? 'You are now following this player!'
          : 'You have unfollowed this player.',
      });
      
      // Invalidate search results to update follow status
      queryClient.invalidateQueries({ queryKey: ["/api/search/students"] });
    },
    onError: (error: any) => {
      toast({
        title: "Action Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFollow = (userId: string, isCurrentlyFollowing: boolean) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to follow players.",
        variant: "destructive",
      });
      return;
    }

    followMutation.mutate({
      userId,
      action: isCurrentlyFollowing ? 'unfollow' : 'follow'
    });
  };

  const handleShowAll = () => {
    setShowAll(true);
    setSearchQuery("");
  };

  const handleSearch = (query: string) => {
    setShowAll(false);
    setSearchQuery(query);
  };

  const handleClearFilters = () => {
    setFilterSchoolId("");
    setFilterSport("");
    setFilterPosition("");
    setSearchQuery("");
    setShowAll(false);
  };

  const sortOptions = [
    { value: 'followers', label: 'Most Followed' },
    { value: 'name', label: 'Name' },
    { value: 'school', label: 'Academy' },
    { value: 'position', label: 'Position' },
    { value: 'sport', label: 'Sport' },
    { value: 'createdAt', label: 'Newest' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1 pb-24 lg:pb-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>

        {/* Search Content */}
        <main className="flex-1">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Search Header */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <Search className="w-8 h-8 text-primary mr-3" />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Search Players</h1>
                  <p className="text-muted-foreground">Find and follow athletes</p>
                </div>
              </div>

              {/* Search Input and Controls */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search by name, sport, position, or academy..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10 py-3 text-lg"
                      data-testid="search-input"
                    />
                  </div>
                  <Button
                    onClick={handleShowAll}
                    variant={showAll ? "default" : "outline"}
                    className="whitespace-nowrap"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Show All Players
                  </Button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Filters</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasActiveFilters && (
                        <Button
                          onClick={handleClearFilters}
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear Filters
                        </Button>
                      )}
                      <Button
                        onClick={() => setFiltersOpen((o) => !o)}
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                      >
                        {filtersOpen ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </div>
                  {filtersOpen && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Academy Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Academy</label>
                      <Select value={filterSchoolId} onValueChange={(v) => setFilterSchoolId(v === "__all__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Academies" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Academies</SelectItem>
                          {filterOptions?.schools.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                              {school.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sport Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Sport</label>
                      <Select value={filterSport} onValueChange={(v) => setFilterSport(v === "__all__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Sports" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Sports</SelectItem>
                          {filterOptions?.sports.map((sport) => (
                            <SelectItem key={sport} value={sport}>
                              {sport}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Position Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Position</label>
                      <Select value={filterPosition} onValueChange={(v) => setFilterPosition(v === "__all__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Positions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Positions</SelectItem>
                          {filterOptions?.positions.map((position) => (
                            <SelectItem key={position} value={position}>
                              {position}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  )}
                </div>

                {/* Advanced Search Controls */}
                {shouldFetch && (
                  <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
                    </div>
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortField)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                      </SelectContent>
                    </Select>
                    {searchResults && (
                      <div className="ml-auto text-sm text-muted-foreground">
                        {searchResults.length} {searchResults.length === 1 ? 'player' : 'players'} found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Search Results */}
            {shouldFetch && (
              <div className="space-y-6">
                {isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-3 mb-4">
                            <Skeleton className="w-12 h-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="flex space-x-2">
                              <Skeleton className="h-6 w-16" />
                              <Skeleton className="h-6 w-20" />
                            </div>
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                          <Skeleton className="h-3 w-full mb-2" />
                          <Skeleton className="h-3 w-4/5 mb-4" />
                          <Skeleton className="h-9 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {searchResults.map((player) => (
                        <Card 
                          key={player.id} 
                          className="hover:shadow-lg transition-shadow cursor-pointer group" 
                          data-testid={`search-result-${player.id}`}
                          onClick={() => navigate(`/profile/${player.user.id}`)}
                        >
                          <CardContent className="p-6">
                            {/* Profile Picture and Basic Info */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <AvatarWithFallback 
                                  src={player.profilePicUrl || player.profilePic}
                                  alt={player.user.name || 'Player'}
                                  size="lg"
                                />
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                    {player.user.name}
                                  </h3>
                                  {player.followersCount > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      {player.followersCount} {player.followersCount === 1 ? 'follower' : 'followers'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Sports Info */}
                            <div className="space-y-2 mb-4">
                              {player.sport && (
                                <div className="flex items-center flex-wrap gap-2">
                                  <Badge variant="secondary">{player.sport}</Badge>
                                  {player.position && (
                                    <Badge variant="outline">{player.position}</Badge>
                                  )}
                                </div>
                              )}
                              
                              {player.school && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                                  <span className="truncate">{player.school.name}</span>
                                </div>
                              )}
                            </div>

                            {/* Bio Preview */}
                            {player.bio && (
                              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                {player.bio}
                              </p>
                            )}

                            {/* Follow Button */}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFollow(player.userId, player.isFollowing || false);
                              }}
                              disabled={followMutation.isPending}
                              variant={player.isFollowing ? "outline" : "default"}
                              className={`w-full ${!player.isFollowing ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}`}
                              data-testid={`follow-button-${player.id}`}
                            >
                              {followMutation.isPending ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                  Processing...
                                </div>
                              ) : player.isFollowing ? (
                                <>
                                  <UserMinus className="w-4 h-4 mr-2" />
                                  Unfollow
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Follow
                                </>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No players found</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || hasActiveFilters
                        ? "Try adjusting your search or filters to find more players"
                        : "No players available at the moment"}
                    </p>
                    {hasActiveFilters && (
                      <Button onClick={handleClearFilters} variant="outline" className="mt-4">
                        <X className="w-4 h-4 mr-2" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Empty State - No search initiated */}
            {!shouldFetch && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Start searching</h3>
                <p className="text-muted-foreground mb-4">
                  Enter at least 2 characters to search for players, use filters, or click "Show All Players" to browse
                </p>
                <Button onClick={handleShowAll} variant="outline">
                  <Users className="w-4 h-4 mr-2" />
                  Show All Players
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
