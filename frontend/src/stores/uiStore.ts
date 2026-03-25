import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface UIStore {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  toasts: Toast[]
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIStore>()(set => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  toasts: [],

  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: v => set({ sidebarCollapsed: v }),
  openMobileSidebar:  () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

  addToast: toast => {
    const id = crypto.randomUUID()
    set(s => ({ toasts: [...s.toasts, { ...toast, id }] }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, toast.duration ?? 4000)
  },

  removeToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
