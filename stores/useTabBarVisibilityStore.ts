import { create } from "zustand";

interface TabBarVisibilityState {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

export const useTabBarVisibilityStore = create<TabBarVisibilityState>((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}));
