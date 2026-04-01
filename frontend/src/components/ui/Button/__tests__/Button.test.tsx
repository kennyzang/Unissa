import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Button from '@/components/ui/Button'

describe('Button Component', () => {
  describe('rendering', () => {
    it('should render children correctly', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
    })

    it('should render with icon', () => {
      render(<Button icon={<span data-testid="icon">🔍</span>}>Search</Button>)
      expect(screen.getByTestId('icon')).toBeInTheDocument()
    })

    it('should render with iconRight', () => {
      render(<Button iconRight={<span data-testid="icon-right">→</span>}>Next</Button>)
      expect(screen.getByTestId('icon-right')).toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('should render primary variant by default', () => {
      render(<Button>Primary</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/primary/)
    })

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/secondary/)
    })

    it('should render danger variant', () => {
      render(<Button variant="danger">Danger</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/danger/)
    })

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/ghost/)
    })

    it('should render text variant', () => {
      render(<Button variant="text">Text</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/text/)
    })
  })

  describe('sizes', () => {
    it('should render medium size by default', () => {
      render(<Button>Medium</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/size-md/)
    })

    it('should render small size', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/size-sm/)
    })

    it('should render large size', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/size-lg/)
    })
  })

  describe('states', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should be disabled when loading', () => {
      render(<Button loading>Loading</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should show spinner when loading', () => {
      render(<Button loading>Loading</Button>)
      const button = screen.getByRole('button')
      const spinner = button.querySelector('span')
      expect(spinner).toBeInTheDocument()
    })

    it('should not show icon when loading', () => {
      render(<Button loading icon={<span data-testid="icon">🔍</span>}>Loading</Button>)
      expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
    })
  })

  describe('block', () => {
    it('should have block class when block prop is true', () => {
      render(<Button block>Block Button</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/block/)
    })
  })

  describe('interactions', () => {
    it('should call onClick handler', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)

      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<Button disabled onClick={handleClick}>Disabled</Button>)

      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when loading', () => {
      const handleClick = vi.fn()
      render(<Button loading onClick={handleClick}>Loading</Button>)

      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('custom-class')
    })
  })
})
