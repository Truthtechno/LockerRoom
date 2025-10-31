import { useState, useRef, useEffect } from 'react';

interface LazyMediaProps {
  src: string;
  alt: string;
  type: 'image' | 'video';
  className?: string;
  onError?: () => void;
  style?: React.CSSProperties;
}

// HLS.js types (basic)
declare global {
  interface Window {
    Hls?: {
      new(): {
        loadSource(url: string): void;
        attachMedia(element: HTMLVideoElement): void;
        on(event: string, callback: () => void): void;
        destroy(): void;
      };
      isSupported(): boolean;
    };
  }
}

export default function LazyMedia({ src, alt, type, className, onError, style }: LazyMediaProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hlsError, setHlsError] = useState(false);
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (mediaRef.current) {
      observer.observe(mediaRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // HLS handling effect
  useEffect(() => {
    if (!isInView || type !== 'video' || !src.includes('.m3u8') || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const isHLS = src.includes('.m3u8');

    if (isHLS) {
      // Load HLS.js dynamically
      const loadHLS = async () => {
        try {
          // Check if HLS is already loaded
          if (!window.Hls) {
            const hlsScript = document.createElement('script');
            hlsScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
            hlsScript.onload = () => {
              initializeHLS();
            };
            hlsScript.onerror = () => {
              console.error('Failed to load HLS.js');
              setHlsError(true);
            };
            document.head.appendChild(hlsScript);
          } else {
            initializeHLS();
          }
        } catch (error) {
          console.error('HLS loading error:', error);
          setHlsError(true);
        }
      };

      const initializeHLS = () => {
        if (window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls();
          hlsRef.current = hls;
          
          hls.loadSource(src);
          hls.attachMedia(video);
          
          hls.on('error', (event, data) => {
            console.error('HLS error:', data);
            if (data.fatal) {
              setHlsError(true);
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          video.src = src;
        } else {
          console.error('HLS not supported');
          setHlsError(true);
        }
      };

      loadHLS();
    } else {
      // Regular video
      video.src = src;
    }

    // Cleanup function
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isInView, src, type]);

  // Handle empty src
  if (!src || src.trim() === '') {
    return (
      <div className={className} style={style}>
        <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">
              {type === 'video' ? '🎥' : '🖼️'}
            </div>
            <p className="text-sm text-muted-foreground">
              {type === 'video' ? 'Video unavailable' : 'Image unavailable'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={mediaRef} className={className} style={style}>
      {isInView ? (
        type === 'video' ? (
          hlsError ? (
            <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-muted-foreground mb-2">⚠️</div>
                <p className="text-sm text-muted-foreground">Video playback failed</p>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={src} // Use src directly - no image transforms for videos
              className="w-full rounded-lg"
              controls
              preload="metadata"
              onError={(e) => {
                console.error("❌ LazyMedia video error", src, e);
                onError?.();
              }}
              onLoadedData={() => setIsLoaded(true)}
              style={{ maxHeight: '600px' }}
              playsInline
              muted={true} // Muted for autoplay compatibility
              loop={false}
              {...(src.includes('.m3u8') && {
                crossOrigin: 'anonymous'
              })}
            />
          )
        ) : (
          <img
            src={src}
            alt={alt}
            className="w-full aspect-video object-cover rounded-lg"
            onError={onError}
            onLoad={() => setIsLoaded(true)}
          />
        )
      ) : (
        <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}
    </div>
  );
}
