import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useUIStore } from '@/stores/uiStore'

describe('UIStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUIStore.setState({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      toasts: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('sidebarCollapsed', () => {
    it('should have correct initial state', () => {
      const state = useUIStore.getState()
      expect(state.sidebarCollapsed).toBe(false)
    })

    it('should toggle sidebar collapsed state', () => {
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)

      act(() => {
        useUIStore.getState().toggleSidebar()
      })

      expect(useUIStore.getState().sidebarCollapsed).toBe(true)

      act(() => {
        useUIStore.getState().toggleSidebar()
      })

      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    it('should set sidebar collapsed to specific value', () => {
      act(() => {
        useUIStore.getState().setSidebarCollapsed(true)
      })

      expect(useUIStore.getState().sidebarCollapsed).toBe(true)

      act(() => {
        useUIStore.getState().setSidebarCollapsed(false)
      })

      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })
  })

  describe('mobileSidebarOpen', () => {
    it('should have correct initial state', () => {
      expect(useUIStore.getState().mobileSidebarOpen).toBe(false)
    })

    it('should open mobile sidebar', () => {
      act(() => {
        useUIStore.getState().openMobileSidebar()
      })

      expect(useUIStore.getState().mobileSidebarOpen).toBe(true)
    })

    it('should close mobile sidebar', () => {
      act(() => {
        useUIStore.getState().openMobileSidebar()
      })

      expect(useUIStore.getState().mobileSidebarOpen).toBe(true)

      act(() => {
        useUIStore.getState().closeMobileSidebar()
      })

      expect(useUIStore.getState().mobileSidebarOpen).toBe(false)
    })
  })

  describe('toasts', () => {
    it('should start with empty toasts', () => {
      expect(useUIStore.getState().toasts).toEqual([])
    })

    it('should add a toast', () => {
      act(() => {
        useUIStore.getState().addToast({ type: 'success', message: 'Test toast' })
      })

      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].message).toBe('Test toast')
      expect(toasts[0].id).toBeDefined()
    })

    it('should add multiple toasts', () => {
      act(() => {
        useUIStore.getState().addToast({ type: 'success', message: 'Toast 1' })
        useUIStore.getState().addToast({ type: 'error', message: 'Toast 2' })
      })

      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(2)
    })

    it('should remove a toast by id', () => {
      act(() => {
        useUIStore.getState().addToast({ type: 'success', message: 'Test toast' })
      })

      const toastId = useUIStore.getState().toasts[0].id

      act(() => {
        useUIStore.getState().removeToast(toastId)
      })

      expect(useUIStore.getState().toasts).toHaveLength(0)
    })

    it('should auto-remove toast after default duration (4 seconds)', () => {
      act(() => {
        useUIStore.getState().addToast({ type: 'success', message: 'Test toast' })
      })

      expect(useUIStore.getState().toasts).toHaveLength(1)

      act(() => {
        vi.advanceTimersByTime(4000)
      })

      expect(useUIStore.getState().toasts).toHaveLength(0)
    })

    it('should auto-remove toast after custom duration', () => {
      act(() => {
        useUIStore.getState().addToast({ type: 'success', message: 'Test toast', duration: 2000 })
      })

      expect(useUIStore.getState().toasts).toHaveLength(1)

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(useUIStore.getState().toasts).toHaveLength(0)
    })

    it('should support different toast types', () => {
      const types: Array<'success' | 'error' | 'warning' | 'info'> = ['success', 'error', 'warning', 'info']

      types.forEach(type => {
        act(() => {
          useUIStore.getState().addToast({ type, message: `${type} toast` })
        })
      })

      const toasts = useUIStore.getState().toasts
      expect(toasts).toHaveLength(4)
      expect(toasts.map(t => t.type)).toEqual(types)
    })

    it('should generate unique ids for toasts', () => {
      act(() => {
        useUIStore.getState().addToast({ type: 'success', message: 'Toast 1' })
        useUIStore.getState().addToast({ type: 'success', message: 'Toast 2' })
      })

      const toasts = useUIStore.getState().toasts
      expect(toasts[0].id).not.toBe(toasts[1].id)
    })
  })
})

import { afterEach } from 'vitest'
