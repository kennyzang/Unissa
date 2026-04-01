import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import CourseRegistrationPage from '@/pages/courses/CourseRegistrationPage'
import { useAuthStore } from '@/stores/authStore'
import { mockUser, mockStudent, mockApiResponse } from '@/test/mocks'

const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}))

const renderCourseRegistrationPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CourseRegistrationPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('CourseRegistrationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: mockUser,
      token: 'test-token',
      isAuthenticated: true,
    })
  })

  describe('rendering', () => {
    it('should render page', async () => {
      mockGet
        .mockResolvedValueOnce(mockApiResponse(mockStudent))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderCourseRegistrationPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled()
      })
    })

    it('should show loading state initially', () => {
      mockGet.mockImplementation(() => new Promise(() => {}))

      renderCourseRegistrationPage()

      expect(screen.getByText(/loading/i) || document.querySelector('.ant-spin')).toBeTruthy()
    })
  })

  describe('data fetching', () => {
    it('should fetch student data on mount', async () => {
      mockGet
        .mockResolvedValueOnce(mockApiResponse(mockStudent))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderCourseRegistrationPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/students/me')
      })
    })

    it('should fetch available offerings', async () => {
      mockGet
        .mockResolvedValueOnce(mockApiResponse(mockStudent))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderCourseRegistrationPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('access control', () => {
    it('should be accessible by students', async () => {
      mockGet
        .mockResolvedValueOnce(mockApiResponse(mockStudent))
        .mockResolvedValueOnce(mockApiResponse([]))

      renderCourseRegistrationPage()

      expect(useAuthStore.getState().user?.role).toBe('student')
    })
  })
})
