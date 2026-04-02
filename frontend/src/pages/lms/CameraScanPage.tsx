import QRScanner from '@/components/QRScanner/QRScanner'
import styles from './CameraScanPage.module.scss'

const CameraScanPage = () => {
  return (
    <div className={styles.page}>
      <QRScanner />
    </div>
  )
}

export default CameraScanPage