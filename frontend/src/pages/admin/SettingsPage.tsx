import { useTranslation } from 'react-i18next'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Switch, Slider, InputNumber, Select as AntSelect, Input as AntInput,
} from 'antd'
import {
  Settings, Bot, Shield, Database, TestTube, Save, CheckCircle, XCircle,
} from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import styles from './SettingsPage.module.scss'

interface AiConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'custom'
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt: string
  temperature: number
  maxTokens: number
}

interface SystemConfig {
  key: string
  value: string
  description?: string
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  custom:    [],
}

const PROVIDER_DEFAULTS: Record<string, string> = {
  openai:    'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  custom:    '',
}

const PROVIDER_OPTIONS = [
  { value: 'openai',    label: 'OpenAI (GPT-4, GPT-3.5, etc.)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'custom',    label: 'Custom / OpenAI-compatible (Ollama, DeepSeek, etc.)' },
]

const SettingsPage: React.FC = () => {
  const { t } = useTranslation()
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const addToast = useUIStore(s => s.addToast)
  const qc       = useQueryClient()

  const [aiForm, setAiForm] = useState<AiConfig>({
    enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini',
    baseUrl: '', systemPrompt: '', temperature: 0.7, maxTokens: 2048,
  })

  const { isLoading: aiLoading, data: aiData } = useQuery<AiConfig>({
    queryKey: ['admin', 'ai-config'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ai/config')
      return data.data
    },
  })
  useEffect(() => { if (aiData) setAiForm(aiData) }, [aiData])

  const { data: sysConfigs = [] } = useQuery<SystemConfig[]>({
    queryKey: ['admin', 'sys-config'],
    queryFn: async () => {
      await apiClient.get('/ai/config')
      return []
    },
  })

  const saveAiMutation = useMutation({
    mutationFn: (cfg: Partial<AiConfig>) => apiClient.put('/ai/config', cfg),
    onSuccess: () => {
      addToast({ type: 'success', message: 'AI configuration saved successfully' })
      qc.invalidateQueries({ queryKey: ['admin', 'ai-config'] })
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? 'Save failed' }),
  })

  const testMutation = useMutation({
    mutationFn: () => apiClient.post('/ai/config/test'),
    onSuccess: (res) => {
      setTestResult({ success: res.data.success, message: res.data.data?.message ?? 'Connected' })
    },
    onError: (e: any) => {
      setTestResult({ success: false, message: e.response?.data?.message ?? 'Test failed' })
    },
  })

  const handleProviderChange = (provider: AiConfig['provider']) => {
    setAiForm(f => ({
      ...f,
      provider,
      model:   PROVIDER_MODELS[provider]?.[0] ?? '',
      baseUrl: PROVIDER_DEFAULTS[provider] ?? '',
    }))
  }

  const aiTab = (
    <div className={styles.tabContent}>
      <Card title="AI Model Configuration" className={styles.configCard}>
        <div className={styles.enableRow}>
          <label className={styles.label}>Enable AI Responses</label>
          <div className={styles.toggleGroup}>
            <Switch
              checked={aiForm.enabled}
              onChange={checked => setAiForm(f => ({ ...f, enabled: checked }))}
            />
            <span className={styles.toggleLabel}>
              {aiForm.enabled ? 'Enabled – using real AI' : 'Disabled – using demo responses'}
            </span>
          </div>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>AI Provider</label>
            <AntSelect
              style={{ width: '100%' }}
              value={aiForm.provider}
              onChange={val => handleProviderChange(val as AiConfig['provider'])}
              options={PROVIDER_OPTIONS}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>API Key</label>
            <AntInput.Password
              placeholder={
                aiForm.provider === 'openai' ? 'sk-...'
                  : aiForm.provider === 'anthropic' ? 'sk-ant-...'
                  : 'API key or token'
              }
              value={aiForm.apiKey}
              onChange={e => setAiForm(f => ({ ...f, apiKey: e.target.value }))}
            />
            <span className={styles.fieldHint}>
              {aiForm.provider === 'openai' && 'Get your key at platform.openai.com'}
              {aiForm.provider === 'anthropic' && 'Get your key at console.anthropic.com'}
              {aiForm.provider === 'custom' && 'API key for your custom endpoint (can be empty for local models)'}
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Model</label>
            {PROVIDER_MODELS[aiForm.provider]?.length > 0 ? (
              <AntSelect
                style={{ width: '100%' }}
                value={aiForm.model}
                onChange={val => setAiForm(f => ({ ...f, model: val }))}
                options={PROVIDER_MODELS[aiForm.provider].map(m => ({ value: m, label: m }))}
              />
            ) : (
              <AntInput
                placeholder="e.g. llama3.2, deepseek-chat, mistral"
                value={aiForm.model}
                onChange={e => setAiForm(f => ({ ...f, model: e.target.value }))}
              />
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Base URL</label>
            <AntInput
              placeholder={PROVIDER_DEFAULTS[aiForm.provider] || 'https://api.your-provider.com/v1'}
              value={aiForm.baseUrl}
              onChange={e => setAiForm(f => ({ ...f, baseUrl: e.target.value }))}
            />
            <span className={styles.fieldHint}>Leave empty to use the default URL for the selected provider</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Temperature <span className={styles.paramValue}>{aiForm.temperature}</span>
            </label>
            <Slider
              min={0} max={1} step={0.1}
              value={aiForm.temperature}
              onChange={val => setAiForm(f => ({ ...f, temperature: val }))}
            />
            <span className={styles.fieldHint}>Lower = more focused, Higher = more creative (0.7 recommended)</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Max Tokens</label>
            <InputNumber
              min={256} max={8192} step={256}
              style={{ width: '100%' }}
              value={aiForm.maxTokens}
              onChange={val => setAiForm(f => ({ ...f, maxTokens: val ?? 2048 }))}
            />
          </div>

          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Custom System Prompt (optional)</label>
            <AntInput.TextArea
              rows={5}
              placeholder="Leave empty to use the default UNIBOT system prompt. You can customise the AI's persona and behaviour here."
              value={aiForm.systemPrompt}
              onChange={e => setAiForm(f => ({ ...f, systemPrompt: e.target.value }))}
            />
          </div>
        </div>

        {testResult && (
          <div className={`${styles.testResult} ${testResult.success ? styles.testOk : styles.testFail}`}>
            {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className={styles.actions}>
          <Button
            variant="secondary"
            icon={<TestTube size={14} />}
            onClick={() => { setTestResult(null); testMutation.mutate() }}
            loading={testMutation.isPending}
            disabled={!aiForm.apiKey || !aiForm.model}
          >
            Test Connection
          </Button>
          <Button
            icon={<Save size={14} />}
            onClick={() => saveAiMutation.mutate(aiForm)}
            loading={saveAiMutation.isPending}
          >
            Save Configuration
          </Button>
        </div>
      </Card>

      <Card title="AI Feature Guide" className={styles.guideCard}>
        <div className={styles.guideList}>
          {[
            { icon: '💬', title: 'UNIBOT Chat (All pages)', desc: 'Floating chat bubble on every page. Answers student/staff questions using university context.' },
            { icon: '📊', title: 'Risk Analytics Dashboard', desc: 'AI-predicted student risk scores based on attendance, quiz performance, and submission rates.' },
            { icon: '🚨', title: 'Procurement Anomaly Detection', desc: 'AI flags unusual procurement patterns like price outliers, split billing, and repeat vendor bias.' },
          ].map(g => (
            <div key={g.title} className={styles.guideItem}>
              <div className={styles.guideIcon}>{g.icon}</div>
              <div>
                <div className={styles.guideTitle}>{g.title}</div>
                <div className={styles.guideDesc}>{g.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )

  const systemTab = (
    <div className={styles.tabContent}>
      <Card title="University System Parameters">
        <div className={styles.sysTable}>
          <table className={styles.configTable}>
            <thead>
              <tr><th>Parameter</th><th>Description</th><th>Value</th></tr>
            </thead>
            <tbody>
              {[
                { key: 'max_ch_standard',    desc: 'Max credit hours (standard)',   unit: 'CH' },
                { key: 'max_ch_overload',     desc: 'Max credit hours (CGPA ≥ 3.5)', unit: 'CH' },
                { key: 'min_ch_standard',     desc: 'Min credit hours (standard)',   unit: 'CH' },
                { key: 'min_ch_probation',    desc: 'Min credit hours (probation)',  unit: 'CH' },
                { key: 'late_fee_per_day',    desc: 'Late fee per day',              unit: 'BND' },
                { key: 'procurement_tender_threshold', desc: 'Tender threshold',     unit: 'BND' },
                { key: 'anomaly_zscore_threshold',     desc: 'Anomaly Z-score threshold', unit: '' },
              ].map(row => (
                <tr key={row.key}>
                  <td className={styles.configKey}>{row.key}</td>
                  <td className={styles.configDesc}>{row.desc}</td>
                  <td className={styles.configVal}>
                    <span className={styles.configBadge}>{row.unit}</span>
                    <AntInput defaultValue="—" readOnly style={{ width: 100 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.sysNote}>System parameters are managed via the database seed file and apply globally. Contact your system administrator to modify these values.</p>
      </Card>
    </div>
  )

  const securityTab = (
    <div className={styles.tabContent}>
      <Card title="Security Settings">
        <div className={styles.securityList}>
          {[
            { label: 'JWT Token Expiry',           value: '4 hours' },
            { label: 'Account Lockout',            value: '5 failed attempts → 30 min lock' },
            { label: 'Password Hashing',           value: 'bcryptjs (10 rounds)' },
            { label: 'CORS Origin',                value: import.meta.env.MODE ?? 'Configured' },
            { label: 'Helmet.js Security Headers', value: 'Enabled' },
            { label: 'SQL Injection',              value: 'Prisma ORM (parameterised queries)' },
            { label: 'Audit Logging',              value: 'All user actions logged' },
          ].map((item, i) => (
            <div key={i} className={styles.securityItem}>
              <div className={styles.secLabel}>{item.label}</div>
              <div className={styles.secValue}>{item.value}</div>
              <div className={`${styles.secStatus} ${styles.sec_ok}`}>
                <CheckCircle size={14} />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.sysNote}>For production deployment, ensure JWT_SECRET is changed from the default value and HTTPS is enabled on your server.</p>
      </Card>
    </div>
  )

  const tabItems = [
    { key: 'ai',       label: <span><Bot size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />AI Configuration</span>,  children: aiTab },
    { key: 'system',   label: <span><Database size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />System Config</span>,   children: systemTab },
    { key: 'security', label: <span><Shield size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Security</span>,          children: securityTab },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Settings size={20} />
        <div>
          <h1 className={styles.title}>{t('settings.title')}</h1>
          <p className={styles.sub}>Configure AI models, system parameters, and security settings</p>
        </div>
      </div>

      <Tabs items={tabItems} />
    </div>
  )
}

export default SettingsPage
