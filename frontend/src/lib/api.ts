// API Fetch wrapper to automatically include the auth token

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(public status: number, public message: string) {
    super(message);
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return null;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, data?.detail || res.statusText || "Something went wrong");
  }

  return data;
}

export const api = {
  get: (endpoint: string) => fetchWithAuth(endpoint),
  post: (endpoint: string, data?: any) => fetchWithAuth(endpoint, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: (endpoint: string, data?: any) => fetchWithAuth(endpoint, { method: "PATCH", body: JSON.stringify(data) }),
  put: (endpoint: string, data?: any) => fetchWithAuth(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  delete: (endpoint: string) => fetchWithAuth(endpoint, { method: "DELETE" }),
  upload: (endpoint: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetchWithAuth(endpoint, { method: "POST", body: formData });
  }
};
