import React from 'react'
import clsx from 'clsx'
import styles from './Button.module.scss'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'text'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  icon,
  iconRight,
  children,
  disabled,
  className,
  ...rest
}) => {
  return (
    <button
      className={clsx(
        styles.btn,
        styles[variant],
        styles[`size-${size}`],
        { [styles.block]: block },
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
}

export default Button
