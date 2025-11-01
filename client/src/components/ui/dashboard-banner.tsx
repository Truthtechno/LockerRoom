import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Info, AlertTriangle, CheckCircle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export type Banner = {
  id: string;
  title: string;
  message: string;
  category: 'info' | 'warning' | 'success' | 'error' | 'announcement';
  targetRoles: string[];
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  priority: number;
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
};

export function DashboardBanner() {
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());

  const { data: bannersData, isLoading } = useQuery({
    queryKey: ["/api/banners/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/banners/active");
      if (!response.ok) return { banners: [] };
      const data = await response.json();
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const banners = (bannersData?.banners || []).filter(
    (banner: Banner) => !dismissedBanners.has(banner.id)
  );

  const getCategoryClasses = (category: string) => {
    switch (category) {
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-100';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100';
      case 'announcement':
        return 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-100';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900 dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    const iconClass = "w-5 h-5";
    switch (category) {
      case 'info':
        return <Info className={iconClass} />;
      case 'warning':
        return <AlertTriangle className={iconClass} />;
      case 'success':
        return <CheckCircle className={iconClass} />;
      case 'error':
        return <XCircle className={iconClass} />;
      case 'announcement':
        return <AlertCircle className={iconClass} />;
      default:
        return <Info className={iconClass} />;
    }
  };

  const handleDismiss = (bannerId: string) => {
    setDismissedBanners(prev => new Set(prev).add(bannerId));
  };

  if (isLoading || banners.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {banners.map((banner: Banner) => (
        <div
          key={banner.id}
          className={`p-4 rounded-lg border ${getCategoryClasses(banner.category)}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-0.5 flex-shrink-0">
                {getCategoryIcon(banner.category)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold mb-1">{banner.title}</h3>
                <p className="text-sm leading-relaxed">{banner.message}</p>
                {banner.endDate && (
                  <p className="text-xs mt-2 opacity-75">
                    Until {new Date(banner.endDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 h-8 w-8 p-0 opacity-70 hover:opacity-100"
              onClick={() => handleDismiss(banner.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

