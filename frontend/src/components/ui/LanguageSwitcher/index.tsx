import { useLanguageStore } from '@/stores/languageStore'
import { LANGUAGES, type Language } from '@/lib/i18n'
import styles from './LanguageSwitcher.module.scss'

interface Props {
  variant?: 'buttons' | 'select'
  theme?: 'dark' | 'light'  // dark = white text (for dark/gradient bg), light = colored text (for white bg)
}

const LanguageSwitcher = ({ variant = 'buttons', theme = 'dark' }: Props) => {
  const { language, setLanguage } = useLanguageStore()

  if (variant === 'select') {
    return (
      <select
        className={styles.select}
        value={language}
        onChange={e => setLanguage(e.target.value as Language)}
      >
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.nativeLabel}</option>
        ))}
      </select>
    )
  }

  return (
    <div className={`${styles.buttons} ${theme === 'light' ? styles.light : ''}`}>
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          className={`${styles.btn} ${language === l.code ? styles.active : ''}`}
          onClick={() => setLanguage(l.code)}
        >
          {l.nativeLabel}
        </button>
      ))}
    </div>
  )
}

export default LanguageSwitcher
