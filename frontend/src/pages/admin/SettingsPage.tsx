import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Bot, Shield, Database, TestTube, Save, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import styles from './SettingsPage.module.scss'

type Tab = 'ai' | 'system' | 'security'

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

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('ai')
  const [showKey, setShowKey]     = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const addToast = useUIStore(s => s.addToast)
  const qc       = useQueryClient()

  // AI Config state
  const [aiForm, setAiForm] = useState<AiConfig>({
    enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini',
    baseUrl: '', systemPrompt: '', temperature: 0.7, maxTokens: 2048,
  })

  // Load AI config
  const { isLoading: aiLoading, data: aiData } = useQuery<AiConfig>({
    queryKey: ['admin', 'ai-config'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ai/config')
      return data.data
    },
  })
  useEffect(() => { if (aiData) setAiForm(aiData) }, [aiData])

  // Load system configs
  const { data: sysConfigs = [] } = useQuery<SystemConfig[]>({
    queryKey: ['admin', 'sys-config'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ai/config')
      return [] // Placeholder – extend if needed
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

  const handleSaveAi = () => {
    saveAiMutation.mutate(aiForm)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Settings size={20} />
        <div>
          <h1 className={styles.title}>System Settings</h1>
          <p className={styles.sub}>Configure AI models, system parameters, and security settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {([
          { key: 'ai',     label: 'AI Configuration', icon: <Bot size={14} /> },
          { key: 'system', label: 'System Config',     icon: <Database size={14} /> },
          { key: 'security',label: 'Security',         icon: <Shield size={14} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* AI Configuration Tab */}
      {activeTab === 'ai' && (
        <div className={styles.tabContent}>
          <Card title="AI Model Configuration" className={styles.configCard}>
            <div className={styles.enableRow}>
              <label className={styles.label}>Enable AI Responses</label>
              <div className={styles.toggleGroup}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={aiForm.enabled}
                    onChange={e => setAiForm(f => ({ ...f, enabled: e.target.checked }))}
                  />
                  <span className={styles.slider} />
                </label>
                <span className={styles.toggleLabel}>
                  {aiForm.enabled ? 'Enabled – using real AI' : 'Disabled – using demo responses'}
                </span>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>AI Provider</label>
                <select
                  className={styles.select}
                  value={aiForm.provider}
                  onChange={e => handleProviderChange(e.target.value as AiConfig['provider'])}
                >
                  <option value="openai">OpenAI (GPT-4, GPT-3.5, etc.)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="custom">Custom / OpenAI-compatible (Ollama, DeepSeek, etc.)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>API Key</label>
                <div className={styles.inputGroup}>
                  <input
                    className={styles.input}
                    type={showKey ? 'text' : 'password'}
                    placeholder={aiForm.provider === 'openai' ? 'sk-...' : aiForm.provider === 'anthropic' ? 'sk-ant-...' : 'API key or token'}
                    value={aiForm.apiKey}
                    onChange={e => setAiForm(f => ({ ...f, apiKey: e.target.value }))}
                  />
                  <button className={styles.eyeBtn} onClick={() => setShowKey(s => !s)} type="button">
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <span className={styles.fieldHint}>
                  {aiForm.provider === 'openai' && 'Get your key at platform.openai.com'}
                  {aiForm.provider === 'anthropic' && 'Get your key at console.anthropic.com'}
                  {aiForm.provider === 'custom' && 'API key for your custom endpoint (can be empty for local models)'}
                </span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Model</label>
                {PROVIDER_MODELS[aiForm.provider]?.length > 0 ? (
                  <select
                    className={styles.select}
                    value={aiForm.model}
                    onChange={e => setAiForm(f => ({ ...f, model: e.target.value }))}
                  >
                    {PROVIDER_MODELS[aiForm.provider].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={styles.input}
                    placeholder="e.g. llama3.2, deepseek-chat, mistral"
                    value={aiForm.model}
                    onChange={e => setAiForm(f => ({ ...f, model: e.target.value }))}
                  />
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Base URL</label>
                <input
                  className={styles.input}
                  placeholder={PROVIDER_DEFAULTS[aiForm.provider] || 'https://api.your-provider.com/v1'}
                  value={aiForm.baseUrl}
                  onChange={e => setAiForm(f => ({ ...f, baseUrl: e.target.value }))}
                />
                <span className={styles.fieldHint}>Leave empty to use the default URL for the selected provider</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Temperature <span className={styles.paramValue}>{aiForm.temperature}</span></label>
                <input
                  type="range" min="0" max="1" step="0.1"
                  className={styles.range}
                  value={aiForm.temperature}
                  onChange={e => setAiForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
                />
                <span className={styles.fieldHint}>Lower = more focused, Higher = more creative (0.7 recommended)</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Max Tokens</label>
                <input
                  type="number" min="256" max="8192" step="256"
                  className={styles.input}
                  value={aiForm.maxTokens}
                  onChange={e => setAiForm(f => ({ ...f, maxTokens: parseInt(e.target.value) }))}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>Custom System Prompt (optional)</label>
                <textarea
                  className={styles.textarea}
                  rows={5}
                  placeholder="Leave empty to use the default UNIBOT system prompt. You can customise the AI's persona and behaviour here."
                  value={aiForm.systemPrompt}
                  onChange={e => setAiForm(f => ({ ...f, systemPrompt: e.target.value }))}
                />
              </div>
            </div>

            {/* Test Result */}
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
                onClick={handleSaveAi}
                loading={saveAiMutation.isPending}
              >
                Save Configuration
              </Button>
            </div>
          </Card>

          <Card title="AI Feature Guide" className={styles.guideCard}>
            <div className={styles.guideList}>
              <div className={styles.guideItem}>
                <div className={styles.guideIcon}>💬</div>
                <div>
                  <div className={styles.guideTitle}>UNIBOT Chat (All pages)</div>
                  <div className={styles.guideDesc}>Floating chat bubble on every page. Answers student/staff questions using university context.</div>
                </div>
              </div>
              <div className={styles.guideItem}>
                <div className={styles.guideIcon}>📊</div>
                <div>
                  <div className={styles.guideTitle}>Risk Analytics Dashboard</div>
                  <div className={styles.guideDesc}>AI-predicted student risk scores based on attendance, quiz performance, and submission rates.</div>
                </div>
              </div>
              <div className={styles.guideItem}>
                <div className={styles.guideIcon}>🚨</div>
                <div>
                  <div className={styles.guideTitle}>Procurement Anomaly Detection</div>
                  <div className={styles.guideDesc}>AI flags unusual procurement patterns like price outliers, split billing, and repeat vendor bias.</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* System Config Tab */}
      {activeTab === 'system' && (
        <div className={styles.tabContent}>
          <Card title="University System Parameters">
            <div className={styles.sysTable}>
              <table className={styles.configTable}>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Description</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'max_ch_standard',    desc: 'Max credit hours (standard)',   unit: 'CH' },
                    { key: 'max_ch_overload',     desc: 'Max credit hours (CGPA ≥ 3.5)', unit: 'CH' },
                    { key: 'min_ch_standard',     desc: 'Min credit hours (standard)',   unit: 'CH' },
                    { key: 'min_ch_probation',    desc: 'Min credit hours (probation)',  unit: 'CH' },
                    { key: 'late_fee_per_day',    desc: 'Late fee per day',              unit: 'BND' },
                    { key: 'procurement_tender_threshold', desc: 'Tender threshold', unit: 'BND' },
                    { key: 'anomaly_zscore_threshold',     desc: 'Anomaly Z-score threshold', unit: '' },
                  ].map(row => (
                    <tr key={row.key}>
                      <td className={styles.configKey}>{row.key}</td>
                      <td className={styles.configDesc}>{row.desc}</td>
                      <td className={styles.configVal}>
                        <span className={styles.configBadge}>{row.unit}</span>
                        <input className={styles.configInput} defaultValue="—" readOnly />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.sysNote}>System parameters are managed via the database seed file and apply globally. Contact your system administrator to modify these values.</p>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className={styles.tabContent}>
          <Card title="Security Settings">
            <div className={styles.securityList}>
              {[
                { label: 'JWT Token Expiry',       value: '4 hours',   status: 'ok' },
                { label: 'Account Lockout',        value: '5 failed attempts → 30 min lock', status: 'ok' },
                { label: 'Password Hashing',       value: 'bcryptjs (10 rounds)',  status: 'ok' },
                { label: 'CORS Origin',            value: import.meta.env.MODE ?? 'Configured', status: 'ok' },
                { label: 'Helmet.js Security Headers', value: 'Enabled',  status: 'ok' },
                { label: 'SQL Injection',          value: 'Prisma ORM (parameterised queries)', status: 'ok' },
                { label: 'Audit Logging',          value: 'All user actions logged', status: 'ok' },
              ].map((item, i) => (
                <div key={i} className={styles.securityItem}>
                  <div className={styles.secLabel}>{item.label}</div>
                  <div className={styles.secValue}>{item.value}</div>
                  <div className={`${styles.secStatus} ${styles[`sec_${item.status}`]}`}>
                    <CheckCircle size={14} />
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.sysNote}>For production deployment, ensure JWT_SECRET is changed from the default value and HTTPS is enabled on your server.</p>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
