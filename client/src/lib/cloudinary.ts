// client/src/lib/cloudinary.ts
export interface CloudinaryUploadResult {
  url: string;
  secure_url: string;
  public_id: string;
}

// Test function to verify environment variables are loaded
export function testCloudinaryEnv(): void {
  console.log("🧪 Testing Cloudinary environment variables:");
  console.log("VITE_CLOUDINARY_CLOUD_NAME:", import.meta.env.VITE_CLOUDINARY_CLOUD_NAME);
  console.log("VITE_CLOUDINARY_UPLOAD_PRESET:", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  console.log("All env vars:", import.meta.env);
  
  if (!import.meta.env.VITE_CLOUDINARY_CLOUD_NAME) {
    console.error("❌ VITE_CLOUDINARY_CLOUD_NAME is missing!");
  } else {
    console.log("✅ VITE_CLOUDINARY_CLOUD_NAME is loaded:", import.meta.env.VITE_CLOUDINARY_CLOUD_NAME);
  }
  
  if (!import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET) {
    console.error("❌ VITE_CLOUDINARY_UPLOAD_PRESET is missing!");
  } else {
    console.log("✅ VITE_CLOUDINARY_UPLOAD_PRESET is loaded:", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  }
}

export async function uploadToCloudinary(file: File, folder: string) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`/api/upload/image?folder=${encodeURIComponent(folder)}`, {
    method: "POST",
    body: fd,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Upload failed");
  }

  return {
    url: data.url,
    secure_url: data.secure_url || data.url,
    public_id: data.public_id,
    thumbnail_url: data.thumbnail_url,
  };
}

export async function createPostWithMedia(file: File, caption: string, studentId: string, onProgress?: (progress: number) => void) {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("caption", caption);
  fd.append("studentId", studentId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData?.error || "Post creation failed"));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was cancelled'));
    });

    xhr.open('POST', '/api/upload/post');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(fd);
  });
}
