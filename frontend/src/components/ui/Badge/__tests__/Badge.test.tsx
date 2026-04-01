import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from '@/components/ui/Badge'

describe('Badge Component', () => {
  describe('rendering', () => {
    it('should render children correctly', () => {
      render(<Badge>Active</Badge>)
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('should render with dot', () => {
      render(<Badge dot>Status</Badge>)
      const badge = screen.getByText('Status').closest('span')
      const dotElement = badge?.querySelector('span')
      expect(dotElement).toBeInTheDocument()
    })

    it('should render without dot by default', () => {
      render(<Badge>Status</Badge>)
      const badge = screen.getByText('Status').closest('span')
      const dotElement = badge?.querySelector('span')
      expect(dotElement).not.toBeInTheDocument()
    })
  })

  describe('colors', () => {
    const colors: Array<'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple' | 'cyan'> = 
      ['blue', 'green', 'red', 'orange', 'gray', 'purple', 'cyan']

    colors.forEach(color => {
      it(`should render ${color} color`, () => {
        render(<Badge color={color}>{color}</Badge>)
        const badge = screen.getByText(color).closest('span')
        expect(badge?.className).toMatch(new RegExp(color))
      })
    })

    it('should render blue color by default', () => {
      render(<Badge>Default</Badge>)
      const badge = screen.getByText('Default').closest('span')
      expect(badge?.className).toMatch(/blue/)
    })
  })

  describe('sizes', () => {
    it('should render medium size by default', () => {
      render(<Badge>Medium</Badge>)
      const badge = screen.getByText('Medium').closest('span')
      expect(badge?.className).toMatch(/size-md/)
    })

    it('should render small size', () => {
      render(<Badge size="sm">Small</Badge>)
      const badge = screen.getByText('Small').closest('span')
      expect(badge?.className).toMatch(/size-sm/)
    })
  })

  describe('custom className and style', () => {
    it('should apply custom className', () => {
      render(<Badge className="custom-badge">Custom</Badge>)
      const badge = screen.getByText('Custom').closest('span')
      expect(badge?.className).toContain('custom-badge')
    })

    it('should apply custom style', () => {
      render(<Badge style={{ backgroundColor: 'pink' }}>Styled</Badge>)
      const badge = screen.getByText('Styled').closest('span')
      expect(badge?.style.backgroundColor).toBe('pink')
    })
  })
})
