import { create } from 'zustand';

let nextId = 1;

export const useToastStore = create((set) => ({
  toasts: [],
  show: (message, type = 'success', duration = 3000) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}));
