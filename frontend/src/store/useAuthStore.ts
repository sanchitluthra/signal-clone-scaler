import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../lib/api";

export interface User {
  id: number;
  phone: string;
  username: string | null;
  display_name: string;
  about: string;
  avatar_color: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => {
        set({ token, user, isAuthenticated: true });
        if (typeof window !== "undefined") localStorage.setItem("token", token);
      },
      setUser: (user) => set({ user }),
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch (e) {} // ignore if already logged out
        set({ token: null, user: null, isAuthenticated: false });
        if (typeof window !== "undefined") localStorage.removeItem("token");
      },
      checkAuth: async () => {
        const token = get().token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
        if (!token) {
          set({ isAuthenticated: false, token: null, user: null });
          return;
        }
        try {
          // ensure token is saved in localStorage for the api wrapper
          if (typeof window !== "undefined" && !localStorage.getItem("token")) {
             localStorage.setItem("token", token);
          }
          const user = await api.get("/users/me");
          set({ user, isAuthenticated: true, token });
        } catch (e) {
          set({ token: null, user: null, isAuthenticated: false });
          if (typeof window !== "undefined") localStorage.removeItem("token");
        }
      },
    }),
    {
      name: "signal-auth-storage",
      partialize: (state) => ({ token: state.token }), // only persist token
    }
  )
);
