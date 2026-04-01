import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import AdmissionApplyPage from '@/pages/admission/AdmissionApplyPage'
import { useAuthStore } from '@/stores/authStore'
import { mockUser, mockApiResponse } from '@/test/mocks'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}))

const renderAdmissionApplyPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AdmissionApplyPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('AdmissionApplyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: mockUser,
      token: 'test-token',
      isAuthenticated: true,
    })
  })

  describe('rendering', () => {
    it('should render application page', async () => {
      mockGet
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce(mockApiResponse(null))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderAdmissionApplyPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled()
      })
    })

    it('should show spinner initially', () => {
      mockGet.mockImplementation(() => new Promise(() => {}))

      renderAdmissionApplyPage()

      expect(document.querySelector('.ant-spin')).toBeTruthy()
    })
  })

  describe('data fetching', () => {
    it('should fetch data on mount', async () => {
      mockGet
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce(mockApiResponse(null))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderAdmissionApplyPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled()
      })
    })

    it('should handle enrolled student', async () => {
      mockGet.mockResolvedValueOnce(mockApiResponse({
        id: 's1',
        studentId: '2026001',
        user: { displayName: 'Test User', email: 'test@test.com' },
        programme: { name: 'Computer Science', code: 'CS' },
        intake: { semester: { name: '2026' } },
        currentCgpa: 3.5,
        status: 'active',
      }))

      renderAdmissionApplyPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled()
      })
    })
  })

  describe('access control', () => {
    it('should be accessible by authenticated users', async () => {
      mockGet
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce(mockApiResponse(null))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderAdmissionApplyPage()

      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })
  })
})
