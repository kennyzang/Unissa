import { useUIStore } from '@/stores/uiStore'
import styles from './Toast.module.scss'
import clsx from 'clsx'

const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }

const ToastContainer = () => {
  const { toasts, removeToast } = useUIStore()
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={clsx(styles.toast, styles[t.type])}>
          <span className={styles.icon}>{icons[t.type]}</span>
          <span className={styles.msg}>{t.message}</span>
          <button className={styles.close} onClick={() => removeToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
