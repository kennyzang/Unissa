import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useAuthStore } from '@/stores/authStore'
import { mockUser, mockAdminUser, mockLecturerUser } from '@/test/mocks'

describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  })

  describe('setAuth', () => {
    it('should set user and token correctly', () => {
      act(() => {
        useAuthStore.getState().setAuth(mockUser, 'test-token')
      })

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.token).toBe('test-token')
      expect(state.isAuthenticated).toBe(true)
    })

    it('should update isAuthenticated to true', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)

      act(() => {
        useAuthStore.getState().setAuth(mockUser, 'test-token')
      })

      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })
  })

  describe('clearAuth', () => {
    it('should clear user and token', () => {
      act(() => {
        useAuthStore.getState().setAuth(mockUser, 'test-token')
      })

      expect(useAuthStore.getState().isAuthenticated).toBe(true)

      act(() => {
        useAuthStore.getState().clearAuth()
      })

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('hasRole', () => {
    it('should return true when user has the required role', () => {
      act(() => {
        useAuthStore.getState().setAuth(mockUser, 'test-token')
      })

      expect(useAuthStore.getState().hasRole('student')).toBe(true)
      expect(useAuthStore.getState().hasRole('admin')).toBe(false)
    })

    it('should return true when user has one of the required roles', () => {
      act(() => {
        useAuthStore.getState().setAuth(mockUser, 'test-token')
      })

      expect(useAuthStore.getState().hasRole('student', 'admin')).toBe(true)
      expect(useAuthStore.getState().hasRole('admin', 'lecturer')).toBe(false)
    })

    it('should return false when no user is logged in', () => {
      expect(useAuthStore.getState().hasRole('student')).toBe(false)
      expect(useAuthStore.getState().hasRole('admin', 'lecturer')).toBe(false)
    })

    it('should work for admin role', () => {
      act(() => {
        useAuthStore.getState().setAuth(mockAdminUser, 'admin-token')
      })

      expect(useAuthStore.getState().hasRole('admin')).toBe(true)
      expect(useAuthStore.getState().hasRole('student')).toBe(false)
    })

    it('should work for lecturer role', () => {
      act(() => {
        useAuthStore.getState().setAuth(mockLecturerUser, 'lecturer-token')
      })

      expect(useAuthStore.getState().hasRole('lecturer')).toBe(true)
      expect(useAuthStore.getState().hasRole('student')).toBe(false)
      expect(useAuthStore.getState().hasRole('lecturer', 'admin')).toBe(true)
    })
  })

  describe('state persistence', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })
})
