import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import CampusServicesPage from '@/pages/campus/CampusServicesPage'
import LmsCoursesPage from '@/pages/lms/LmsCoursesPage'
import { useAuthStore } from '@/stores/authStore'
import { mockUser, mockStudent, mockApiResponse } from '@/test/mocks'

const mockGet = vi.fn()

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
  },
}))

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('CampusServicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: mockUser,
      token: 'test-token',
      isAuthenticated: true,
    })
  })

  it('should render campus services page', async () => {
    mockGet.mockResolvedValueOnce(mockApiResponse(mockStudent))

    renderWithProviders(<CampusServicesPage />)

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled()
    })
  })

  it('should fetch student data on mount', async () => {
    mockGet.mockResolvedValueOnce(mockApiResponse(mockStudent))

    renderWithProviders(<CampusServicesPage />)

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/students/me')
    })
  })
})

describe('LmsCoursesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: mockUser,
      token: 'test-token',
      isAuthenticated: true,
    })
  })

  it('should render lms courses page', async () => {
    mockGet.mockResolvedValueOnce(mockApiResponse(mockStudent))
    mockGet.mockResolvedValueOnce(mockApiResponse([]))

    renderWithProviders(<LmsCoursesPage />)

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled()
    })
  })
})
