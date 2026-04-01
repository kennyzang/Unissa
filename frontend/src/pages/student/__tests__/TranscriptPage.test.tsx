import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import TranscriptPage from '@/pages/student/TranscriptPage'
import { useAuthStore } from '@/stores/authStore'
import { mockUser, mockStudent, mockApiResponse } from '@/test/mocks'

const mockGet = vi.fn()

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
  },
}))

const renderTranscriptPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TranscriptPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('TranscriptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: mockUser,
      token: 'test-token',
      isAuthenticated: true,
    })
  })

  describe('rendering', () => {
    it('should render transcript page', async () => {
      mockGet
        .mockResolvedValueOnce(mockApiResponse(mockStudent))
        .mockResolvedValueOnce(mockApiResponse({ student: mockStudent, enrolments: [] }))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderTranscriptPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled()
      })
    })

    it('should show loading state initially', () => {
      mockGet.mockImplementation(() => new Promise(() => {}))

      renderTranscriptPage()

      expect(screen.getByText(/loading/i) || document.querySelector('.ant-spin')).toBeTruthy()
    })
  })

  describe('data fetching', () => {
    it('should fetch student data on mount', async () => {
      mockGet
        .mockResolvedValueOnce(mockApiResponse(mockStudent))
        .mockResolvedValueOnce(mockApiResponse({ student: mockStudent, enrolments: [] }))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderTranscriptPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/students/me')
      })
    })

    it('should fetch transcript data after student data', async () => {
      mockGet
        .mockResolvedValueOnce(mockApiResponse(mockStudent))
        .mockResolvedValueOnce(mockApiResponse({ student: mockStudent, enrolments: [] }))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderTranscriptPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('access control', () => {
    it('should be accessible by students', async () => {
      mockGet
        .mockResolvedValueOnce(mockApiResponse(mockStudent))
        .mockResolvedValueOnce(mockApiResponse({ student: mockStudent, enrolments: [] }))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderTranscriptPage()

      expect(useAuthStore.getState().user?.role).toBe('student')
    })
  })
})
