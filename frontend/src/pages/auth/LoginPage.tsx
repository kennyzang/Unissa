import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Form, Input, Button, Alert, Modal } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronLeft, KeyRound } from 'lucide-react'
import apiClient from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
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

const DEMO_ACCOUNTS = [
  ['Student',    'noor',       'Demo@2026'],
  ['Admissions', 'admissions', 'Demo@2026'],
  ['Lecturer',   'drsiti',     'Demo@2026'],
  ['Lecturer',   'drahmad',    'Demo@2026'],
  ['Manager',    'manager',    'Demo@2026'],
  ['HR Admin',   'hradmin',    'Demo@2026'],
  ['Finance',    'finance',    'Demo@2026'],
  ['Admin',      'admin',      'Demo@2026'],
]

const LoginPage = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { addToast } = useUIStore()
  const { t } = useTranslation()
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [demoOpen, setDemoOpen] = useState(true)
  const [mobileDemoOpen, setMobileDemoOpen] = useState(false)
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
      addToast({ type: 'success', message: t('login.welcomeBack', { name: data.user.displayName }) })
      const redirect = ROLE_REDIRECTS[data.user.role] ?? '/dashboard'
      navigate(redirect, { replace: true })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? t('login.invalidCredentials')
      setFailedAttempts(p => p + 1)
      addToast({ type: 'error', message: msg })
    },
  })

  const onFinish = (values: FormValues) => loginMutation.mutate(values)

  return (
    <div className={styles.wrapper}>
      {/* Login card */}
      <div className={styles.card}>
        {/* Language switcher */}
        <div className={styles.langBar}>
          <LanguageSwitcher variant="buttons" theme="light" />
        </div>

        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>U</div>
          <div className={styles.logoText}>
            <div className={styles.logoTitle}>UNISSA</div>
            <div className={styles.logoSub}>{t('login.logoSub')}</div>
          </div>
        </div>

        <div className={styles.divider} />

        <h2 className={styles.heading}>{t('login.title')}</h2>
        <p className={styles.subheading}>{t('login.subtitle')}</p>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          className={styles.form}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label={t('login.username')}
            rules={[{ required: true, message: t('login.usernameRequired') }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#C9CDD4' }} />}
              placeholder={t('login.usernamePlaceholder')}
              autoComplete="username"
              autoFocus
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('login.password')}
            rules={[{ required: true, message: t('login.passwordRequired') }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#C9CDD4' }} />}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              size="large"
            />
          </Form.Item>

          {failedAttempts >= 3 && (
            <Form.Item>
              <Alert
                type="warning"
                message={t('login.lockWarning', { count: 5 - failedAttempts })}
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
              {t('login.signIn')}
            </Button>
          </Form.Item>
        </Form>

        <div className={styles.footer}>
          {t('login.footer')}
        </div>

        {/* Mobile-only demo trigger – hidden on desktop where the floating panel shows */}
        <div className={styles.mobileDemo}>
          <button
            type="button"
            className={styles.mobileDemoTrigger}
            onClick={() => setMobileDemoOpen(true)}
          >
            <KeyRound size={13} />
            <span>{t('login.demoAccounts')}</span>
          </button>
        </div>
      </div>

      {/* Demo accounts modal (mobile) */}
      <Modal
        open={mobileDemoOpen}
        onCancel={() => setMobileDemoOpen(false)}
        footer={null}
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><KeyRound size={15} />{t('login.demoAccounts')}</span>}
        centered
        width={320}
      >
        <p className={styles.demoModalHint}>{t('login.demoClickFill')}</p>
        <div className={styles.demoModalList}>
          {DEMO_ACCOUNTS.map(([role, user, pwd]) => (
            <button
              key={user}
              type="button"
              className={styles.demoModalItem}
              onClick={() => {
                form.setFieldsValue({ username: user, password: pwd })
                setMobileDemoOpen(false)
              }}
            >
              <span className={styles.demoModalRole}>{role}</span>
              <code className={styles.demoModalUser}>{user}</code>
            </button>
          ))}
        </div>
      </Modal>

      {/* Demo accounts — floating panel to the right */}
      <div className={`${styles.demoPanel} ${demoOpen ? styles.demoPanelOpen : ''}`}>
        <button
          className={styles.demoPanelToggle}
          onClick={() => setDemoOpen(v => !v)}
        >
          <KeyRound size={14} />
          <span>{t('login.demoAccounts')}</span>
          {demoOpen
            ? <ChevronLeft size={14} className={styles.demoChevron} />
            : <ChevronRight size={14} className={styles.demoChevron} />
          }
        </button>

        {demoOpen && (
          <div className={styles.demoPanelBody}>
            <p className={styles.demoPanelHint}>
              {t('login.demoClickFill')}
            </p>
            <table className={styles.demoTable}>
              <thead>
                <tr>
                  <th>{t('login.demoRole')}</th>
                  <th>{t('login.demoUsername')}</th>
                  <th>{t('login.demoPassword')}</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ACCOUNTS.map(([role, user, pwd]) => (
                  <tr
                    key={user}
                    className={styles.demoRow}
                    onClick={() => form.setFieldsValue({ username: user, password: pwd })}
                    title={`Click to fill: ${user}`}
                  >
                    <td>{role}</td>
                    <td><code>{user}</code></td>
                    <td><code>{pwd}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginPage
