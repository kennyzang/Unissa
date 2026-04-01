import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from '@/pages/auth/LoginPage'
import { useAuthStore } from '@/stores/authStore'
import { mockUser, mockApiErrorResponse, mockApiResponse } from '@/test/mocks'

const mockPost = vi.fn()

vi.mock('@/lib/apiClient', () => ({
  default: {
    post: (...args: any[]) => mockPost(...args),
  },
}))

const renderLoginPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  })

  describe('rendering', () => {
    it('should render login form', () => {
      renderLoginPage()

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should render demo accounts section', () => {
      renderLoginPage()

      expect(screen.getAllByText(/demo accounts/i).length).toBeGreaterThan(0)
    })
  })

  describe('form validation', () => {
    it('should show error when username is empty', async () => {
      renderLoginPage()

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument()
      })
    })

    it('should show error when password is empty', async () => {
      renderLoginPage()

      const usernameInput = screen.getByLabelText(/username/i)
      fireEvent.change(usernameInput, { target: { value: 'testuser' } })

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('login flow', () => {
    it('should call login API with correct credentials', async () => {
      mockPost.mockResolvedValueOnce(mockApiResponse({ user: mockUser, token: 'test-token' }))

      renderLoginPage()

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)

      fireEvent.change(usernameInput, { target: { value: 'noor' } })
      fireEvent.change(passwordInput, { target: { value: 'Demo@2026' } })

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/auth/login', {
          username: 'noor',
          password: 'Demo@2026',
        })
      })
    })

    it('should update auth store on successful login', async () => {
      mockPost.mockResolvedValueOnce(mockApiResponse({ user: mockUser, token: 'test-token' }))

      renderLoginPage()

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)

      fireEvent.change(usernameInput, { target: { value: 'noor' } })
      fireEvent.change(passwordInput, { target: { value: 'Demo@2026' } })

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true)
      })
    })
  })

  describe('demo account quick fill', () => {
    it('should fill credentials when clicking demo account row', async () => {
      renderLoginPage()

      const noorRow = screen.getByText(/noor/i).closest('tr')
      if (noorRow) {
        fireEvent.click(noorRow)
      }

      const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement
      expect(usernameInput.value).toBe('noor')
    })
  })
})
