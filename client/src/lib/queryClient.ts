import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Clone the response before reading so the original stream isn't consumed
    const clonedRes = res.clone();
    let errorMessage = res.statusText;
    try {
      const errorData = await clonedRes.json();
      if (errorData.error && errorData.error.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // If JSON parsing fails, clone again and try text
      const textRes = res.clone();
      const text = await textRes.text();
      if (text) {
        errorMessage = text;
      }
    }
    
    const error = new Error(errorMessage);
    (error as any).status = res.status;
    (error as any).code = res.status;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  
  // Always attach token if available
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  let body: string | FormData | undefined;
  
  if (data) {
    if (data instanceof FormData) {
      // Don't set Content-Type for FormData - let the browser set it with boundary
      body = data;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    
    // Always attach token if available
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000, // 30 seconds
      retry: (failureCount, error: any) => {
        // Don't retry on 404 (profile not found)
        if (error?.status === 404) return false;
        return failureCount < 3;
      },
      gcTime: 2 * 60 * 1000, // 2 minutes
    },
    mutations: {
      retry: false,
    },
  },
});
