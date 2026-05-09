import { create } from "zustand";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  tone: "info" | "error";
}

interface NotificationStore {
  items: NotificationItem[];
  pushNotification: (item: NotificationItem) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  items: [],
  pushNotification(item) {
    set((state) => ({ items: [...state.items, item] }));
  },
  removeNotification(id) {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  }
}));
