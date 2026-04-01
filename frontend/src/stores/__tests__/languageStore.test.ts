import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useLanguageStore } from '@/stores/languageStore'

vi.mock('@/lib/i18n', () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}))

describe('LanguageStore', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'en' })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have English as default language', () => {
      expect(useLanguageStore.getState().language).toBe('en')
    })
  })

  describe('setLanguage', () => {
    it('should change language to Chinese', () => {
      act(() => {
        useLanguageStore.getState().setLanguage('zh')
      })

      expect(useLanguageStore.getState().language).toBe('zh')
    })

    it('should change language to Malay', () => {
      act(() => {
        useLanguageStore.getState().setLanguage('ms')
      })

      expect(useLanguageStore.getState().language).toBe('ms')
    })

    it('should change language back to English', () => {
      act(() => {
        useLanguageStore.getState().setLanguage('zh')
      })

      expect(useLanguageStore.getState().language).toBe('zh')

      act(() => {
        useLanguageStore.getState().setLanguage('en')
      })

      expect(useLanguageStore.getState().language).toBe('en')
    })

    it('should call i18n.changeLanguage when language is set', async () => {
      const i18n = await import('@/lib/i18n')

      act(() => {
        useLanguageStore.getState().setLanguage('zh')
      })

      expect(i18n.default.changeLanguage).toHaveBeenCalledWith('zh')
    })
  })
})
