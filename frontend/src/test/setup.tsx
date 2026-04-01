import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import React from 'react'

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
})

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

class IntersectionObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds = []
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
})

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

class MockBlob {
  constructor(public parts: any[] = [], public options: any = {}) {}
  size = 0
  type = ''
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0))
  }
  slice() {
    return new MockBlob()
  }
  text() {
    return Promise.resolve('')
  }
}

Object.defineProperty(window, 'Blob', {
  value: MockBlob,
})

class MockFile extends MockBlob {
  name: string
  lastModified: number
  constructor(parts: any[], name: string, options: any = {}) {
    super(parts, options)
    this.name = name
    this.lastModified = options.lastModified || Date.now()
  }
}

Object.defineProperty(window, 'File', {
  value: MockFile,
})

class MockFileReader {
  result: string | ArrayBuffer | null = null
  error: any = null
  onload: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  readAsDataURL() {
    this.result = 'data:text/plain;base64,dGVzdA=='
    if (this.onload) this.onload({})
  }
  readAsText() {
    this.result = 'test'
    if (this.onload) this.onload({})
  }
  readAsArrayBuffer() {
    this.result = new ArrayBuffer(0)
    if (this.onload) this.onload({})
  }
  abort() {}
}

Object.defineProperty(window, 'FileReader', {
  value: MockFileReader,
})

HTMLCanvasElement.prototype.getContext = vi.fn() as any
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,test')

vi.mock('../lib/i18n', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    default: {
      t: (key: string, options?: any) => {
        const translations: Record<string, string> = {
          'common.loading': 'Loading…',
          'common.save': 'Save',
          'common.cancel': 'Cancel',
          'common.submit': 'Submit',
          'common.error': 'Error',
          'common.success': 'Success',
        }
        let result = translations[key] || key
        if (options) {
          Object.entries(options).forEach(([k, v]) => {
            result = result.replace(`{{${k}}}`, String(v))
          })
        }
        return result
      },
      changeLanguage: vi.fn(),
      language: 'en',
    },
    LANGUAGES: [
      { code: 'en', name: 'English' },
      { code: 'zh', name: '中文' },
      { code: 'ms', name: 'Bahasa Melayu' },
    ],
  }
})

export const mockNavigate = vi.fn()
export const mockLocation = { pathname: '/', search: '', hash: '', state: null }

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    Link: ({ children, to, ...props }: any) =>
      React.createElement('a', { href: to, ...props }, children),
    NavLink: ({ children, to, className, ...props }: any) =>
      React.createElement('a', {
        href: to,
        className: typeof className === 'function' ? className({ isActive: false }) : className,
        ...props,
      }, children),
  }
})

console.error = vi.fn()
console.warn = vi.fn()
