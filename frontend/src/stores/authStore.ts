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

const clearSessionStorage = () => {
  sessionStorage.removeItem('admission-apply-step')
  sessionStorage.removeItem('admission-apply-form')
  sessionStorage.removeItem('admission-apply-resubmit')
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        clearSessionStorage()
        set({ user, token, isAuthenticated: true })
      },

      clearAuth: () => {
        clearSessionStorage()
        set({ user: null, token: null, isAuthenticated: false })
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
