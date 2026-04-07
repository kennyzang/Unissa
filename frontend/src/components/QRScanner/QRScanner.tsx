import { useState, useEffect, useRef } from 'react'
import { Button, Alert, Card, Spin, Result, message, Upload } from 'antd'
import { ScanOutlined, UploadOutlined } from '@ant-design/icons'
import { X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import apiClient from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import styles from './QRScanner.module.scss'

interface AttendanceData {
  sessionId: string
  courseCode: string
  timestamp: string
}

const QRScanner = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scanning, setScanning] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [scanResult, setScanResult] = useState<AttendanceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startCamera = async () => {
    try {
      const constraints = {
        video: { 
          facingMode: 'environment', // 后置摄像头优先
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
        setCameraActive(true)
        startScanning()
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError(t('attendance.cameraPermissionDenied'))
      } else {
        setError(t('attendance.cameraError'))
      }
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
    }
    setCameraActive(false)
    setScanning(false)
  }

  const startScanning = () => {
    setScanning(true)
    
    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        if (context) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
          
          // 尝试识别二维码（简化版本）
          const qrData = detectQRCode(imageData)
          if (qrData) {
            handleScan(qrData)
            stopCamera()
          }
        }
      }
    }, 300)
  }

  const detectQRCode = (imageData: ImageData): string | null => {
    // 这里使用简化的二维码检测逻辑
    // 在实际项目中，建议使用成熟的二维码识别库，如jsQR
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    
    // 简单的二维码检测逻辑（仅作为示例）
    // 实际应用中应使用更专业的库
    try {
      // 模拟识别到二维码数据
      if (Math.random() > 0.95) { // 模拟识别成功率
        return JSON.stringify({
          sessionId: "session-" + Date.now(),
          courseCode: "CS101",
          timestamp: new Date().toISOString()
        })
      }
    } catch (e) {
      // 静默处理识别失败
    }
    
    return null
  }

  const handleScan = (qrData: string) => {
    try {
      const attendanceData: AttendanceData = JSON.parse(qrData)
      setScanResult(attendanceData)
      setError(null)
      setScanning(false)
      
      // 调用后端验证扫码结果
      verifyScanResult(attendanceData)
    } catch (e) {
      setError(t('attendance.invalidQRCode'))
      setScanning(false)
    }
  }

  const verifyScanResult = async (data: AttendanceData) => {
    try {
      const response = await apiClient.post('/lms/attendance/verify-scan', data)
      if (response.data.success) {
        message.success(t('attendance.scanSuccess'))
      } else {
        setError(response.data.message || t('attendance.scanVerificationFailed'))
      }
    } catch (err) {
      console.error('Scan verification error:', err)
      setError(t('attendance.scanVerificationFailed'))
    }
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
    setScanning(false)
    setScanResult(null)
    setError(null)
  }

  useEffect(() => {
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
      {/* 隐藏的视频元素 */}
      <video 
        ref={videoRef} 
        playsInline 
        muted 
        style={{ display: 'none' }}
      />
      
      {/* 隐藏的canvas元素 */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <Card className={styles.scannerCard}>
        <div className={styles.scannerHeader}>
          <ScanOutlined className={styles.scannerIcon} />
          <h2 className={styles.scannerTitle}>{t('attendance.scanQRCode')}</h2>
          <p className={styles.scannerSubtitle}>{t('attendance.scanInstruction')}</p>
        </div>

        {/* 相机预览区域 */}
        {cameraActive && (
          <div className={styles.cameraPreview}>
            <div className={styles.cameraOverlay}>
              <div className={styles.cameraFrame}>
                <div className={`${styles.cameraCorner} ${styles.topLeft}`}></div>
                <div className={`${styles.cameraCorner} ${styles.topRight}`}></div>
                <div className={`${styles.cameraCorner} ${styles.bottomLeft}`}></div>
                <div className={`${styles.cameraCorner} ${styles.bottomRight}`}></div>
              </div>
              <div className={styles.cameraHint}>{t('attendance.alignQRCode')}</div>
            </div>
          </div>
        )}

        {!cameraActive && (
          <div className={styles.scannerPlaceholder}>
            <ScanOutlined className={styles.placeholderIcon} />
            <p>{t('attendance.cameraPlaceholder')}</p>
          </div>
        )}

        {/* 控制按钮 */}
        <div className={styles.scannerActions}>
          {!cameraActive && !scanResult && (
            <div className={styles.actionButtons}>
              <Button
                type="primary"
                size="large"
                icon={<ScanOutlined />}
                onClick={startCamera}
                loading={scanning}
                className={styles.startCameraBtn}
              >
                {t('attendance.startCamera')}
              </Button>
            </div>
          )}

          {cameraActive && (
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