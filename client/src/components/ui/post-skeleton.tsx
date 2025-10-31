import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl mb-6 shadow-sm">
      {/* Post Header Skeleton */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
      </div>

      {/* Post Media Skeleton */}
      <div className="relative">
        <Skeleton className="w-full aspect-video rounded-lg" />
      </div>

      {/* Post Content Skeleton */}
      <div className="p-6">
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Interaction Buttons Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Skeleton className="w-6 h-6" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="w-6 h-6" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="w-6 h-6" />
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
