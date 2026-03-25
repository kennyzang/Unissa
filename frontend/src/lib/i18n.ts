import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en'
import zh from '@/locales/zh'
import ms from '@/locales/ms'

export type Language = 'en' | 'zh' | 'ms'

export const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English',        nativeLabel: 'English' },
  { code: 'zh', label: 'Chinese',        nativeLabel: '中文' },
  { code: 'ms', label: 'Bahasa Melayu',  nativeLabel: 'Melayu' },
]

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      ms: { translation: ms },
    },
    lng: (localStorage.getItem('unissa-lang') as Language) ?? 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
