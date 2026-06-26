export interface ApiResponse<T = any> {
  error?: string;
  success?: boolean; // For public API
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async get<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });
    
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return (data.data !== undefined ? data.data : data) as T;
  }

  async post<T>(url: string, body?: any): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return (data.data !== undefined ? data.data : data) as T;
  }

  async put<T>(url: string, body?: any): Promise<T> {
    const res = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return (data.data !== undefined ? data.data : data) as T;
  }

  async delete<T>(url: string, body?: any): Promise<T> {
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return (data.data !== undefined ? data.data : data) as T;
  }
}

export const apiClient = new ApiClient();
