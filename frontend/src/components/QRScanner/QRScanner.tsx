import { useState, useEffect, useRef } from 'react'
import { Button, Alert, Card, Result, message, Upload } from 'antd'
import { ScanOutlined, UploadOutlined } from '@ant-design/icons'
import { X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import apiClient from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { Html5Qrcode } from 'html5-qrcode'
import styles from './QRScanner.module.scss'

interface AttendanceData {
  sessionId: string
  courseCode: string
  timestamp: string
}

const QRScanner = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<AttendanceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScan = (decodedText: string) => {
    try {
      let attendanceData: AttendanceData
      
      // 尝试解析为JSON格式
      try {
        attendanceData = JSON.parse(decodedText)
        console.log('QRScanner: Scanned JSON format:', attendanceData)
      } catch (jsonError) {
        // 如果解析失败，说明是字符串格式的token
        console.log('QRScanner: Scanned string format, using as sessionId:', decodedText)
        attendanceData = {
          sessionId: decodedText,
          courseCode: '',
          timestamp: new Date().toISOString()
        }
      }
      
      setScanResult(attendanceData)
      setError(null)
      setScanning(false)
      
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(err => console.error('Error stopping scanner:', err))
      }
      
      // 调用后端验证扫码结果
      verifyScanResult(attendanceData)
    } catch (e) {
      console.error('QRScanner: Error processing scan result:', e)
      setError(t('attendance.invalidQRCode'))
      setScanning(false)
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(err => console.error('Error stopping scanner:', err))
      }
    }
  }

  const verifyScanResult = async (data: AttendanceData) => {
    try {
      console.log('QRScanner: Verifying scan result with token:', data.sessionId)
      const response = await apiClient.post('/lms/attendance/check-in', {
        token: data.sessionId
      })
      console.log('QRScanner: Verification response:', response.data)
      if (response.data.success) {
        message.success(t('attendance.scanSuccess'))
      } else {
        setError(response.data.message || t('attendance.scanVerificationFailed'))
      }
    } catch (err) {
      console.error('Scan verification error:', err)
      // 显示更具体的错误信息
      if (err instanceof Error) {
        setError(`Verification error: ${err.message}`)
      } else {
        setError(t('attendance.scanVerificationFailed'))
      }
    }
  }

  const startCamera = async () => {
    console.log('QRScanner: startCamera called')
    
    // 先设置scanning为true，确保DOM元素渲染
    setScanning(true)
    setError(null)
    
    // 等待DOM更新
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!scannerRef.current) {
      console.error('QRScanner: scannerRef is null after waiting')
      setError('Scanner element not found')
      setScanning(false)
      return
    }
    
    console.log('QRScanner: scannerRef found, starting camera...')
    
    try {
      // 尝试使用后置摄像头
      console.log('QRScanner: Creating Html5Qrcode instance...')
      html5QrcodeRef.current = new Html5Qrcode('qr-code-scanner')
      
      console.log('QRScanner: Starting camera with environment facing mode...')
      await html5QrcodeRef.current.start(
        {
          facingMode: 'environment'
        },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          console.log('QRScanner: QR code detected:', decodedText)
          handleScan(decodedText)
        },
        (errorMessage) => {
          // 忽略扫描错误，只在连续错误时显示
          console.log('Scan error:', errorMessage)
        }
      )
      console.log('QRScanner: Camera started successfully!')
    } catch (err) {
      console.error('Error starting camera:', err)
      setScanning(false)
      if (err instanceof Error) {
        console.error('Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        })
        if (err.name === 'NotAllowedError') {
          setError(t('attendance.cameraPermissionDenied'))
        } else if (err.name === 'NotFoundError') {
          setError('No camera found')
        } else {
          setError(`Camera error: ${err.message}`)
        }
      } else {
        setError(t('attendance.cameraError'))
      }
    }
  }

  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      html5QrcodeRef.current = null
    }
    setScanning(false)
  }

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      handleScan(text)
    }
    reader.readAsText(file)
    return false
  }

  const resetScan = () => {
    stopCamera()
    setScanResult(null)
    setError(null)
    // 重置后重新启动相机
    setTimeout(() => {
      startCamera()
    }, 100)
  }

  useEffect(() => {
    // 页面加载时自动启动相机
    console.log('QRScanner: Component mounted, starting camera...')
    startCamera()
    
    return () => {
      stopCamera()
    }
  }, [])

  if (!user) {
    return (
      <Card>
        <Result
          status="warning"
          title={t('attendance.notLoggedIn')}
          subTitle={t('attendance.pleaseLogin')}
        />
      </Card>
    )
  }

  return (
    <div className={styles.scannerContainer}>
      <Card className={styles.scannerCard}>
        <div className={styles.scannerHeader}>
          <ScanOutlined className={styles.scannerIcon} />
          <h2 className={styles.scannerTitle}>{t('attendance.scanQRCode')}</h2>
          <p className={styles.scannerSubtitle}>{t('attendance.scanInstruction')}</p>
        </div>

        {/* 相机预览区域 */}
        {scanning && (
          <div className={styles.cameraPreview}>
            <div
              id="qr-code-scanner"
              ref={scannerRef}
              className={styles.scannerElement}
            />
            <div className={styles.cameraFrame}>
              <div className={`${styles.cameraCorner} ${styles.topLeft}`}></div>
              <div className={`${styles.cameraCorner} ${styles.topRight}`}></div>
              <div className={`${styles.cameraCorner} ${styles.bottomLeft}`}></div>
              <div className={`${styles.cameraCorner} ${styles.bottomRight}`}></div>
            </div>
            <div className={styles.cameraHint}>{t('attendance.alignQRCode')}</div>
          </div>
        )}

        {!scanning && !scanResult && !error && (
          <div className={styles.scannerPlaceholder}>
            <ScanOutlined className={styles.placeholderIcon} />
            <p>{t('attendance.cameraPlaceholder')}</p>
          </div>
        )}

        {/* 控制按钮 */}
        <div className={styles.scannerActions}>
          {scanning && (
            <div className={styles.cameraControls}>
              <Button
                type="primary"
                size="large"
                danger
                icon={<XIcon />}
                onClick={resetScan}
                className={styles.stopCameraBtn}
              >
                {t('attendance.stopScan')}
              </Button>
            </div>
          )}

          {scanResult && (
            <div className={styles.resultSection}>
              <Result
                status="success"
                title={t('attendance.scanSuccess')}
                subTitle={`${t('attendance.session')}: ${scanResult.sessionId}`}
                extra={[
                  <Button key="scan" type="primary" onClick={resetScan}>
                    {t('attendance.scanAnother')}
                  </Button>,
                ]}
              />
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            closable
            onClose={() => setError(null)}
            className={styles.errorAlert}
          />
        )}

        {/* 备用文件上传 */}
        <div className={styles.fallbackUpload}>
          <Upload
            name="file"
            accept=".txt,.json"
            multiple={false}
            showUploadList={false}
            beforeUpload={(file) => {
              handleFileUpload(file)
              return false
            }}
          >
            <Button
              size="small"
              icon={<UploadOutlined />}
              className={styles.fallbackUploadBtn}
            >
              {t('attendance.uploadFallback')}
            </Button>
          </Upload>
          <p className={styles.fallbackNote}>{t('attendance.fallbackNote')}</p>
        </div>

        {/* 扫描详情 */}
        {scanResult && (
          <div className={styles.scanDetails}>
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

export default QRScanner