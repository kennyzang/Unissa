import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n, { type Language } from '@/lib/i18n'

interface LanguageStore {
  language: Language
  setLanguage: (lang: Language) => void
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: (localStorage.getItem('unissa-lang') as Language) ?? 'en',
      setLanguage: (lang: Language) => {
        i18n.changeLanguage(lang)
        set({ language: lang })
      },
    }),
    {
      name: 'unissa-lang',
      partialize: state => ({ language: state.language }),
    }
  )
)
