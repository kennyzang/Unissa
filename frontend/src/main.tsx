import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router/routes'
import '@/styles/global.scss'

const antdTheme = {
  token: {
    colorPrimary: '#165DFF',
    colorSuccess: '#00B42A',
    colorWarning: '#FF7D00',
    colorError: '#F53F3F',
    colorInfo: '#165DFF',
    borderRadius: 4,
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
    fontSize: 14,
  },
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={antdTheme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConfigProvider>
  </StrictMode>
)
