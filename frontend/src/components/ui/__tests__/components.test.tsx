import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

describe('Card Component', () => {
  it('should render children correctly', () => {
    render(
      <Card>
        <div>Card Content</div>
      </Card>
    )

    expect(screen.getByText('Card Content')).toBeTruthy()
  })

  it('should render with title', () => {
    render(
      <Card title="Card Title">
        <div>Content</div>
      </Card>
    )

    expect(screen.getByText('Card Title')).toBeTruthy()
  })
})

describe('Input Component', () => {
  it('should render input element', () => {
    render(<Input placeholder="Enter text" />)

    expect(screen.getByPlaceholderText('Enter text')).toBeTruthy()
  })

  it('should handle value changes', () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })

    expect(handleChange).toHaveBeenCalled()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Input disabled />)

    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })
})

describe('Modal Component', () => {
  it('should render when open', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    )

    expect(screen.getByText('Modal Content')).toBeTruthy()
  })

  it('should not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    )

    expect(screen.queryByText('Modal Content')).toBeFalsy()
  })
})

describe('Badge Component', () => {
  it('should render children correctly', () => {
    render(<Badge>Badge Text</Badge>)

    expect(screen.getByText('Badge Text')).toBeTruthy()
  })

  it('should render with different colors', () => {
    const { container } = render(<Badge color="green">Success</Badge>)

    expect(container.querySelector('span')).toBeTruthy()
  })

  it('should render with different sizes', () => {
    const { container } = render(<Badge size="sm">Small Badge</Badge>)

    expect(container.querySelector('span')).toBeTruthy()
  })
})

describe('Button Component Integration', () => {
  it('should work with other components', () => {
    render(
      <Card>
        <Badge color="blue">New</Badge>
        <Button>Click Me</Button>
      </Card>
    )

    expect(screen.getByText('New')).toBeTruthy()
    expect(screen.getByText('Click Me')).toBeTruthy()
  })
})
