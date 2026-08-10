import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  businessName?: string;
  defaultCurrency?: string;
  hasPseb?: boolean;
  psebId?: string | null;
  isFiler?: boolean;
  isAdmin?: boolean;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string, user: UserProfile) => void;
  logout: () => void;
  setTokens: (accessToken: string) => void;
  setUser: (user: UserProfile) => void;
}

const dummyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      login: (accessToken, user) =>
        set({
          accessToken,
          isAuthenticated: true,
          user,
        }),
      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),
      setTokens: (accessToken) =>
        set({ accessToken }),
      setUser: (user) => set({ user }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : dummyStorage)),
    }
  )
);
