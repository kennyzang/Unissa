import { useTranslation } from 'react-i18next'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Switch, Slider, InputNumber, Select as AntSelect, Input as AntInput,
} from 'antd'
import {
  Settings, Bot, Shield, Database, TestTube, Save, CheckCircle, XCircle, RefreshCw,
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
  const { t } = useTranslation()
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const addToast = useUIStore(s => s.addToast)
  const qc       = useQueryClient()

  const PROVIDER_OPTIONS = [
    { value: 'openai',    label: t('settings.providerOpenAI') },
    { value: 'anthropic', label: t('settings.providerAnthropic') },
    { value: 'custom',    label: t('settings.providerCustom') },
  ]

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

  const [resetDone, setResetDone] = useState(false)

  const demoResetMutation = useMutation({
    mutationFn: () => apiClient.post('/admin/demo-reset'),
    onSuccess: () => {
      setResetDone(true)
      addToast({ type: 'success', message: t('settings.demoResetToast') })
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] })
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('settings.demoResetFailed') }),
  })

  const saveAiMutation = useMutation({
    mutationFn: (cfg: Partial<AiConfig>) => apiClient.put('/ai/config', cfg),
    onSuccess: () => {
      addToast({ type: 'success', message: t('settings.saveSuccess') })
      qc.invalidateQueries({ queryKey: ['admin', 'ai-config'] })
    },
    onError: (e: any) => addToast({ type: 'error', message: e.response?.data?.message ?? t('settings.saveFailed') }),
  })

  const testMutation = useMutation({
    mutationFn: () => apiClient.post('/ai/config/test'),
    onSuccess: (res) => {
      setTestResult({ success: res.data.success, message: res.data.data?.message ?? t('settings.connected') })
    },
    onError: (e: any) => {
      setTestResult({ success: false, message: e.response?.data?.message ?? t('settings.testFailed') })
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
      <Card title={t('settings.aiModelConfig')} className={styles.configCard}>
        <div className={styles.enableRow}>
          <label className={styles.label}>{t('settings.enableAI')}</label>
          <div className={styles.toggleGroup}>
            <Switch
              checked={aiForm.enabled}
              onChange={checked => setAiForm(f => ({ ...f, enabled: checked }))}
            />
            <span className={styles.toggleLabel}>
              {aiForm.enabled ? t('settings.aiEnabled') : t('settings.aiDisabled')}
            </span>
          </div>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.aiProvider')}</label>
            <AntSelect
              style={{ width: '100%' }}
              value={aiForm.provider}
              onChange={val => handleProviderChange(val as AiConfig['provider'])}
              options={PROVIDER_OPTIONS}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.apiKey')}</label>
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
              {aiForm.provider === 'openai' && t('settings.apiKeyHintOpenAI')}
              {aiForm.provider === 'anthropic' && t('settings.apiKeyHintAnthropic')}
              {aiForm.provider === 'custom' && t('settings.apiKeyHintCustom')}
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.model')}</label>
            {PROVIDER_MODELS[aiForm.provider]?.length > 0 ? (
              <AntSelect
                style={{ width: '100%' }}
                value={aiForm.model}
                onChange={val => setAiForm(f => ({ ...f, model: val }))}
                options={PROVIDER_MODELS[aiForm.provider].map(m => ({ value: m, label: m }))}
              />
            ) : (
              <AntInput
                placeholder={t('settings.modelPlaceholder')}
                value={aiForm.model}
                onChange={e => setAiForm(f => ({ ...f, model: e.target.value }))}
              />
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.baseUrl')}</label>
            <AntInput
              placeholder={PROVIDER_DEFAULTS[aiForm.provider] || 'https://api.your-provider.com/v1'}
              value={aiForm.baseUrl}
              onChange={e => setAiForm(f => ({ ...f, baseUrl: e.target.value }))}
            />
            <span className={styles.fieldHint}>{t('settings.baseUrlHint')}</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              {t('settings.temperature')} <span className={styles.paramValue}>{aiForm.temperature}</span>
            </label>
            <Slider
              min={0} max={1} step={0.1}
              value={aiForm.temperature}
              onChange={val => setAiForm(f => ({ ...f, temperature: val }))}
            />
            <span className={styles.fieldHint}>{t('settings.temperatureNote')}</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.maxTokens')}</label>
            <InputNumber
              min={256} max={8192} step={256}
              style={{ width: '100%' }}
              value={aiForm.maxTokens}
              onChange={val => setAiForm(f => ({ ...f, maxTokens: val ?? 2048 }))}
            />
          </div>

          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>{t('settings.systemPrompt')}</label>
            <AntInput.TextArea
              rows={5}
              placeholder={t('settings.systemPromptPlaceholder')}
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
            {t('settings.testConnection')}
          </Button>
          <Button
            icon={<Save size={14} />}
            onClick={() => saveAiMutation.mutate(aiForm)}
            loading={saveAiMutation.isPending}
          >
            {t('settings.saveConfig')}
          </Button>
        </div>
      </Card>

      <Card title={t('settings.aiGuide')} className={styles.guideCard}>
        <div className={styles.guideList}>
          {[
            { icon: '💬', titleKey: 'guideChatTitle', descKey: 'guideChatDesc' },
            { icon: '📊', titleKey: 'guideRiskTitle', descKey: 'guideRiskDesc' },
            { icon: '🚨', titleKey: 'guideProcurementTitle', descKey: 'guideProcurementDesc' },
          ].map(g => (
            <div key={g.titleKey} className={styles.guideItem}>
              <div className={styles.guideIcon}>{g.icon}</div>
              <div>
                <div className={styles.guideTitle}>{t(`settings.${g.titleKey}`)}</div>
                <div className={styles.guideDesc}>{t(`settings.${g.descKey}`)}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )

  const systemTab = (
    <div className={styles.tabContent}>
      <Card title={t('settings.systemParams')}>
        <div className={styles.sysTable}>
          <table className={styles.configTable}>
            <thead>
              <tr>
                <th>{t('settings.parameter')}</th>
                <th>{t('settings.description')}</th>
                <th>{t('settings.value')}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'max_ch_standard',             descKey: 'sysParamMaxCHStandard',  unit: 'CH' },
                { key: 'max_ch_overload',              descKey: 'sysParamMaxCHOverload',   unit: 'CH' },
                { key: 'min_ch_standard',              descKey: 'sysParamMinCHStandard',   unit: 'CH' },
                { key: 'min_ch_probation',             descKey: 'sysParamMinCHProbation',  unit: 'CH' },
                { key: 'late_fee_per_day',             descKey: 'sysParamLateFee',         unit: 'BND' },
                { key: 'procurement_tender_threshold', descKey: 'sysParamTender',          unit: 'BND' },
                { key: 'anomaly_zscore_threshold',     descKey: 'sysParamAnomaly',         unit: '' },
              ].map(row => (
                <tr key={row.key}>
                  <td className={styles.configKey}>{row.key}</td>
                  <td className={styles.configDesc}>{t(`settings.${row.descKey}`)}</td>
                  <td className={styles.configVal}>
                    <span className={styles.configBadge}>{row.unit}</span>
                    <AntInput defaultValue="—" readOnly style={{ width: 100 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.sysNote}>
          {t('settings.systemParamsNote')} {t('settings.systemParamsContactNote')}
        </p>
      </Card>
    </div>
  )

  const securityTab = (
    <div className={styles.tabContent}>
      <Card title={t('settings.securitySettings')}>
        <div className={styles.securityList}>
          {[
            { labelKey: 'jwtExpiry',      valueKey: 'jwtValue' },
            { labelKey: 'accountLockout', valueKey: 'lockoutValue' },
            { labelKey: 'passwordHashing',valueKey: 'hashingValue' },
            { labelKey: 'corsOrigin',     value: import.meta.env.MODE ?? t('settings.corsValue') },
            { labelKey: 'helmetHeaders',  valueKey: 'helmetValue' },
            { labelKey: 'sqlInjection',   valueKey: 'sqlValue' },
            { labelKey: 'auditLogging',   valueKey: 'auditValue' },
          ].map((item, i) => (
            <div key={i} className={styles.securityItem}>
              <div className={styles.secLabel}>{t(`settings.${item.labelKey}`)}</div>
              <div className={styles.secValue}>
                {item.value ?? t(`settings.${item.valueKey}`)}
              </div>
              <div className={`${styles.secStatus} ${styles.sec_ok}`}>
                <CheckCircle size={14} />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.sysNote}>{t('settings.securityNote')}</p>
      </Card>
    </div>
  )

  const demoTab = (
    <div className={styles.tabContent}>
      <Card title={t('settings.demoInitTitle')} className={styles.configCard}>
        <div className={styles.demoResetDesc}>
          <p>{t('settings.demoInitDesc')}</p>
          <ul>
            <li>{t('settings.demoInitBullet1')}</li>
            <li>{t('settings.demoInitBullet2')}</li>
            <li>{t('settings.demoInitBullet3')}</li>
          </ul>
        </div>
        {resetDone && (
          <div className={`${styles.testResult} ${styles.testOk}`}>
            <CheckCircle size={16} />
            <span>{t('settings.demoResetSuccess')}</span>
          </div>
        )}
        <div className={styles.actions}>
          <Button
            variant="danger"
            icon={<RefreshCw size={14} />}
            loading={demoResetMutation.isPending}
            onClick={() => {
              setResetDone(false)
              demoResetMutation.mutate()
            }}
          >
            {t('settings.demoResetBtn')}
          </Button>
        </div>
      </Card>
    </div>
  )

  const tabItems = [
    { key: 'ai',       label: <span><Bot size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t('settings.aiConfig')}</span>,      children: aiTab },
    { key: 'system',   label: <span><Database size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t('settings.systemConfig')}</span>, children: systemTab },
    { key: 'security', label: <span><Shield size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t('settings.security')}</span>,      children: securityTab },
    { key: 'demo',     label: <span><RefreshCw size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t('settings.demoInitTab')}</span>, children: demoTab },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Settings size={20} />
        <div>
          <h1 className={styles.title}>{t('settings.title')}</h1>
          <p className={styles.sub}>{t('settings.subtitle')}</p>
        </div>
      </div>

      <Tabs items={tabItems} />
    </div>
  )
}

export default SettingsPage
