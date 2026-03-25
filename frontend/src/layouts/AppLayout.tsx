import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import ToastContainer from '@/components/ui/Toast'
import AiChatBubble from '@/components/AiChatBubble/AiChatBubble'
import BottomTab from '@/components/BottomTab/BottomTab'
import { useUIStore } from '@/stores/uiStore'
import styles from './AppLayout.module.scss'
import clsx from 'clsx'

const AppLayout = () => {
  const collapsed          = useUIStore(s => s.sidebarCollapsed)
  const closeMobileSidebar = useUIStore(s => s.closeMobileSidebar)
  const location           = useLocation()

  // Close mobile sidebar on route change
  useEffect(() => { closeMobileSidebar() }, [location.pathname, closeMobileSidebar])

  return (
    <div className={clsx(styles.root, { [styles.collapsed]: collapsed })}>
      <Sidebar />
      <div className={styles.main}>
        <Navbar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
      <ToastContainer />
      <AiChatBubble />
      <BottomTab />
    </div>
  )
}

export default AppLayout
