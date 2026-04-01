import { useState, useRef } from 'react'
import { Button, Alert, Card, Spin, Result, Upload, message } from 'antd'
import { ScanOutlined, UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import apiClient from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import styles from './QRCodeScanPage.module.scss'

interface AttendanceData {
  sessionId: string
  courseCode: string
  timestamp: string
}

const QRCodeScanPage = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<AttendanceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      handleScan(text)
    }
    reader.readAsText(file)
    return false
  }

  const handleScan = (qrData: string) => {
    try {
      const attendanceData: AttendanceData = JSON.parse(qrData)
      setScanResult(attendanceData)
      setError(null)
      setScanning(true)
      setTimeout(() => {
        setScanning(false)
      }, 2000)
    } catch (e) {
      setError(t('attendance.invalidQRCode'))
    }
  }

  const startScanning = () => {
    fileInputRef.current?.click()
  }

  const resetScan = () => {
    setScanning(false)
    setScanResult(null)
    setError(null)
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <Card>
          <Result
            status="warning"
            title={t('attendance.notLoggedIn')}
            subTitle={t('attendance.pleaseLogin')}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <ScanOutlined className={styles.icon} />
          <h1 className={styles.title}>{t('attendance.scanQRCode')}</h1>
          <p className={styles.subtitle}>{t('attendance.scanInstruction')}</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file)
          }}
        />

        {!scanning && !scanResult && (
          <div className={styles.actions}>
            <Button
              type="primary"
              size="large"
              icon={<ScanOutlined />}
              onClick={startScanning}
              className={styles.scanButton}
            >
              {t('attendance.startScan')}
            </Button>
            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#999' }}>
              POC版本：请上传包含考勤信息的JSON文件
            </div>
          </div>
        )}

        {scanning && !scanResult && (
          <div className={styles.scanning}>
            <Spin size="large" />
            <p className={styles.scanningText}>{t('attendance.scanning')}</p>
          </div>
        )}

        {scanResult && !scanning && (
          <div className={styles.result}>
            <Result
              status="success"
              title={t('attendance.scanSuccess')}
              subTitle={`${t('attendance.session')}: ${scanResult.sessionId}`}
              extra={[
                <Button key="scan" type="primary" onClick={startScanning}>
                  {t('attendance.scanAnother')}
                </Button>,
              ]}
            />
          </div>
        )}

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            closable
            onClose={() => setError(null)}
            className={styles.error}
          />
        )}

        {scanResult && (
          <div className={styles.details}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>{t('attendance.courseCode')}:</span>
              <span className={styles.detailValue}>{scanResult.courseCode}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>{t('attendance.sessionId')}:</span>
              <span className={styles.detailValue}>{scanResult.sessionId}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>{t('attendance.timestamp')}:</span>
              <span className={styles.detailValue}>{scanResult.timestamp}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default QRCodeScanPage