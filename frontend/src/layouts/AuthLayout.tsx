import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import styles from './AuthLayout.module.scss'

const AuthLayout = () => {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return (
    <div className={styles.root}>
      <div className={styles.background}>
        <div className={styles.circle1} />
        <div className={styles.circle2} />
      </div>
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}

export default AuthLayout
