// Utility functions for media handling

export interface MediaDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape' | 'square';
}

export function getMediaOrientation(width: number, height: number): 'portrait' | 'landscape' | 'square' {
  const aspectRatio = width / height;
  
  if (Math.abs(aspectRatio - 1) < 0.1) {
    return 'square';
  } else if (aspectRatio > 1) {
    return 'landscape';
  } else {
    return 'portrait';
  }
}

export function getAspectRatioClass(orientation: 'portrait' | 'landscape' | 'square'): string {
  switch (orientation) {
    case 'portrait':
      return 'aspect-[4/5]'; // 4:5 ratio for portrait
    case 'landscape':
      return 'aspect-video'; // 16:9 ratio for landscape
    case 'square':
      return 'aspect-square'; // 1:1 ratio for square
    default:
      return 'aspect-video';
  }
}

export function getMaxHeightClass(orientation: 'portrait' | 'landscape' | 'square'): string {
  switch (orientation) {
    case 'portrait':
      return 'max-h-[600px]'; // Taller for portrait
    case 'landscape':
      return 'max-h-[400px]'; // Standard for landscape
    case 'square':
      return 'max-h-[500px]'; // Medium for square
    default:
      return 'max-h-[400px]';
  }
}

// Function to load image and get dimensions
export function getImageDimensions(src: string): Promise<MediaDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const dimensions: MediaDimensions = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight,
        orientation: getMediaOrientation(img.naturalWidth, img.naturalHeight)
      };
      resolve(dimensions);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

// Function to get video dimensions
export function getVideoDimensions(src: string): Promise<MediaDimensions> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      const dimensions: MediaDimensions = {
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
        orientation: getMediaOrientation(video.videoWidth, video.videoHeight)
      };
      resolve(dimensions);
    };
    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = src;
  });
}
