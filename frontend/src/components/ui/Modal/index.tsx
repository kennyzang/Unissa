import React, { useEffect } from 'react'
import clsx from 'clsx'
import styles from './Modal.module.scss'
import Button from '../Button'

interface ModalProps {
  open: boolean
  title?: React.ReactNode
  onClose?: () => void
  onOk?: () => void
  okText?: string
  cancelText?: string
  okLoading?: boolean
  okDanger?: boolean
  width?: number | string
  footer?: React.ReactNode | null
  children: React.ReactNode
  className?: string
}

const Modal: React.FC<ModalProps> = ({
  open, title, onClose, onOk, okText = 'Confirm', cancelText = 'Cancel',
  okLoading, okDanger, width = 520, footer, children, className,
}) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={clsx(styles.modal, className)} style={{ width }}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className={styles.body}>{children}</div>

        {/* Footer */}
        {footer !== null && (
          <div className={styles.footer}>
            {footer ?? (
              <>
                <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
                <Button
                  variant={okDanger ? 'danger' : 'primary'}
                  loading={okLoading}
                  onClick={onOk}
                >
                  {okText}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
