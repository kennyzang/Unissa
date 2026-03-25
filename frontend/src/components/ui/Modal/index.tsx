import React from 'react'
import { Modal as AntModal } from 'antd'

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
}) => (
  <AntModal
    open={open}
    title={title}
    onCancel={onClose}
    onOk={onOk}
    okText={okText}
    cancelText={cancelText}
    confirmLoading={okLoading}
    okButtonProps={{ danger: okDanger }}
    width={width}
    footer={footer === null ? null : footer ?? undefined}
    className={className}
    destroyOnClose
  >
    {children}
  </AntModal>
)

export default Modal
