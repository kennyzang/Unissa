import { useTranslation } from 'react-i18next'
import styles from './AttendancePage.module.scss'

const AttendancePage = () => {
  const { t } = useTranslation()
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('attendance.title')}</h1>
      <p className={styles.coming}>{t('attendance.underDev')}</p>
    </div>
  )
}

export default AttendancePage
