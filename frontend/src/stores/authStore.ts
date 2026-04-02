import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@/types'

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  hasRole: (...roles: UserRole[]) => boolean
}

const clearAllClientStorage = () => {
  // Clear all localStorage (includes persisted auth token)
  localStorage.clear()
  // Clear all sessionStorage (includes multi-step form drafts, etc.)
  sessionStorage.clear()
  // Clear all cookies for this origin
  document.cookie.split(';').forEach(c => {
    const name = c.trim().split('=')[0]
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`
  })
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        set({ user, token, isAuthenticated: true })
      },

      clearAuth: () => {
        set({ user: null, token: null, isAuthenticated: false })
        clearAllClientStorage()
      },

      hasRole: (...roles) => {
        const { user } = get()
        return user ? roles.includes(user.role) : false
      },
    }),
    {
      name: 'unissa-auth',
      partialize: state => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
