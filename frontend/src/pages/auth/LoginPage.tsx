import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Form, Input, Button, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import apiClient from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import type { User } from '@/types'
import styles from './LoginPage.module.scss'

interface FormValues {
  username: string
  password: string
}

const ROLE_REDIRECTS: Record<string, string> = {
  admin:      '/dashboard',
  manager:    '/dashboard',
  finance:    '/dashboard',
  admissions: '/admission/review',
  lecturer:   '/lms/courses',
  student:    '/admission/apply',
}

const LoginPage = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { addToast } = useUIStore()
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [form] = Form.useForm<FormValues>()

  const loginMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiClient.post<{ success: boolean; data: { user: User; token: string }; message?: string }>(
        '/auth/login', data
      )
      return res.data
    },
    onSuccess: ({ data }) => {
      setAuth(data.user, data.token)
      addToast({ type: 'success', message: `Welcome back, ${data.user.displayName}!` })
      const redirect = ROLE_REDIRECTS[data.user.role] ?? '/dashboard'
      navigate(redirect, { replace: true })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Invalid credentials'
      setFailedAttempts(p => p + 1)
      addToast({ type: 'error', message: msg })
    },
  })

  const onFinish = (values: FormValues) => loginMutation.mutate(values)

  return (
    <div className={styles.card}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>U</div>
        <div className={styles.logoText}>
          <div className={styles.logoTitle}>UNISSA</div>
          <div className={styles.logoSub}>Smart University Platform</div>
        </div>
      </div>

      <div className={styles.divider} />

      <h2 className={styles.heading}>Sign In</h2>
      <p className={styles.subheading}>Use your demo account credentials to continue</p>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        className={styles.form}
        requiredMark={false}
      >
        <Form.Item
          name="username"
          label="Username"
          rules={[{ required: true, message: 'Username is required' }]}
        >
          <Input
            prefix={<UserOutlined style={{ color: '#C9CDD4' }} />}
            placeholder="e.g. noor, admin, manager"
            autoComplete="username"
            autoFocus
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Password is required' }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#C9CDD4' }} />}
            placeholder="Demo@2026"
            autoComplete="current-password"
            size="large"
          />
        </Form.Item>

        {failedAttempts >= 3 && (
          <Form.Item>
            <Alert
              type="warning"
              message={`Account will be locked after ${5 - failedAttempts} more failed attempt${5 - failedAttempts !== 1 ? 's' : ''}`}
              showIcon
              style={{ fontSize: 13 }}
            />
          </Form.Item>
        )}

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loginMutation.isPending}
            size="large"
          >
            Sign In
          </Button>
        </Form.Item>
      </Form>

      {/* Demo accounts hint */}
      <details className={styles.demoHint}>
        <summary>Demo Accounts</summary>
        <table className={styles.demoTable}>
          <thead>
            <tr><th>Role</th><th>Username</th><th>Password</th></tr>
          </thead>
          <tbody>
            {[
              ['Student',    'noor',       'Demo@2026'],
              ['Admissions', 'admissions', 'Demo@2026'],
              ['Lecturer',   'drsiti',     'Demo@2026'],
              ['Lecturer',   'drahmad',    'Demo@2026'],
              ['Manager',    'manager',    'Demo@2026'],
              ['HR Admin',   'hradmin',    'Demo@2026'],
              ['Finance',    'finance',    'Demo@2026'],
              ['Admin',      'admin',      'Demo@2026'],
            ].map(([role, user, pwd]) => (
              <tr key={user}>
                <td>{role}</td>
                <td><code>{user}</code></td>
                <td><code>{pwd}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className={styles.footer}>
        UNISSA/LTK/RKN-PTM(01)/2026 · POC Demo v5.0
      </div>
    </div>
  )
}

export default LoginPage
