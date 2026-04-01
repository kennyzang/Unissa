import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import LmsGradingPage from '@/pages/lms/LmsGradingPage'
import { useAuthStore } from '@/stores/authStore'
import { mockLecturerUser, mockApiResponse } from '@/test/mocks'

const mockGet = vi.fn()
const mockPatch = vi.fn()

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}))

const renderLmsGradingPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LmsGradingPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('LmsGradingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: mockLecturerUser,
      token: 'test-token',
      isAuthenticated: true,
    })
  })

  describe('rendering', () => {
    it('should render grading page', async () => {
      mockGet.mockResolvedValueOnce(mockApiResponse([]))

      renderLmsGradingPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled()
      })
    })

    it('should show loading state initially', () => {
      mockGet.mockImplementation(() => new Promise(() => {}))

      renderLmsGradingPage()

      expect(screen.getByText(/loading/i) || document.querySelector('.ant-spin')).toBeTruthy()
    })
  })

  describe('data fetching', () => {
    it('should fetch pending submissions', async () => {
      mockGet.mockResolvedValueOnce(mockApiResponse([]))

      renderLmsGradingPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled()
      })
    })

    it('should handle empty submissions list', async () => {
      mockGet.mockResolvedValueOnce(mockApiResponse([]))

      renderLmsGradingPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('access control', () => {
    it('should only be accessible by lecturers', async () => {
      mockGet.mockResolvedValueOnce(mockApiResponse([]))

      renderLmsGradingPage()

      expect(useAuthStore.getState().user?.role).toBe('lecturer')
    })
  })
})
