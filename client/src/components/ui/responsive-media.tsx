import { useState, useEffect, useRef } from "react";
import { getImageDimensions, getVideoDimensions, getAspectRatioClass, getMaxHeightClass, type MediaDimensions } from "@/lib/media-utils";

interface ResponsiveMediaProps {
  src: string;
  type: 'image' | 'video';
  alt?: string;
  className?: string;
  autoplay?: boolean;
  controls?: boolean;
  poster?: string;
  onError?: () => void;
  priority?: boolean; // For prioritizing first 2 posts for instant loading
}

export default function ResponsiveMedia({ 
  src, 
  type, 
  alt = "Media content", 
  className = "",
  autoplay = false,
  controls = true,
  poster,
  onError,
  priority = false
}: ResponsiveMediaProps) {
  const [dimensions, setDimensions] = useState<MediaDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority); // Start in view for priority items
  const mediaRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading (skip for priority items)
  useEffect(() => {
    if (priority || !mediaRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(mediaRef.current);
    return () => observer.disconnect();
  }, [priority]);

  useEffect(() => {
    if (!src || !isInView) return;

    setIsLoading(true);
    setHasError(false);

    const loadDimensions = async () => {
      try {
        const dims = type === 'image' 
          ? await getImageDimensions(src)
          : await getVideoDimensions(src);
        setDimensions(dims);
      } catch (error) {
        console.error('Failed to load media dimensions:', error);
        setHasError(true);
        onError?.();
      } finally {
        setIsLoading(false);
      }
    };

    loadDimensions();
  }, [src, type, onError, isInView]);

  if (hasError) {
    return (
      <div className={`w-full aspect-video bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <div className="text-muted-foreground mb-2">
            {type === 'image' ? '🖼️' : '🎥'}
          </div>
          <p className="text-sm text-muted-foreground">
            {type === 'image' ? 'Image unavailable' : 'Video unavailable'}
          </p>
        </div>
      </div>
    );
  }

  // Show placeholder when not in view
  if (!isInView) {
    return (
      <div ref={mediaRef} className={`w-full aspect-video bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoading || !dimensions) {
    return (
      <div ref={mediaRef} className={`w-full aspect-video bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading {type}...</p>
        </div>
      </div>
    );
  }

  // Use object-contain to preserve aspect ratio without cropping
  const mediaClassName = `w-full max-h-[600px] object-contain rounded-lg ${className}`;

  if (type === 'image') {
    return (
      <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden">
        <img
          src={src}
          alt={alt}
          className={mediaClassName}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center bg-black rounded-lg overflow-hidden">
      <video
        src={src}
        className={mediaClassName}
        controls={controls}
        autoPlay={autoplay}
        muted={autoplay} // Muted autoplay for better UX
        loop={autoplay}
        poster={poster}
        preload="metadata"
        playsInline
        onError={() => {
          setHasError(true);
          onError?.();
        }}
        onLoadedData={() => {
          console.log('✅ Video loaded successfully:', src);
        }}
        onErrorCapture={(e) => {
          console.error('❌ Video error:', e);
          setHasError(true);
          onError?.();
        }}
      />
    </div>
  );
}
