import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

interface WrapperProps {
  children: React.ReactNode
}

export const AllProviders: React.FC<WrapperProps> = ({ children }) => {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllProviders, ...options })
}

export const mockApiSuccess = (data: any) => ({
  data: {
    success: true,
    data,
  },
})

export const mockApiError = (message: string, status = 400) => ({
  response: {
    status,
    data: {
      success: false,
      message,
    },
  },
})

export const createMockFile = (name: string, type: string, content: string = 'test content') => {
  return new File([content], name, { type })
}

export const flushPromises = () =>
  new Promise(resolve => setTimeout(resolve, 0))

export const waitForLoadingToFinish = () =>
  new Promise(resolve => setTimeout(resolve, 100))

export const mockIntersectionObserver = () => {
  const mockObserve = vi.fn()
  const mockUnobserve = vi.fn()
  const mockDisconnect = vi.fn()

  window.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: mockObserve,
    unobserve: mockUnobserve,
    disconnect: mockDisconnect,
  })) as any

  return { mockObserve, mockUnobserve, mockDisconnect }
}

export const mockResizeObserver = () => {
  const mockObserve = vi.fn()
  const mockUnobserve = vi.fn()
  const mockDisconnect = vi.fn()

  window.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: mockObserve,
    unobserve: mockUnobserve,
    disconnect: mockDisconnect,
  })) as any

  return { mockObserve, mockUnobserve, mockDisconnect }
}

export * from '@testing-library/react'
export { screen, fireEvent, waitFor, within } from '@testing-library/react'
