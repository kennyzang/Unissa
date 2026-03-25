import React, { forwardRef, useState } from 'react'
import clsx from 'clsx'
import styles from './Input.module.scss'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  prefixIcon?: React.ReactNode
  suffixIcon?: React.ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, required, prefixIcon, suffixIcon, inputSize = 'md',
  className, type, ...rest
}, ref) => {
  const [showPw, setShowPw] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.inputWrapper}>
        {prefixIcon && <span className={styles.prefixIcon}>{prefixIcon}</span>}
        <input
          ref={ref}
          type={isPassword ? (showPw ? 'text' : 'password') : type}
          className={clsx(
            styles.input,
            styles[`size-${inputSize}`],
            { [styles.hasPrefix]: !!prefixIcon },
            { [styles.hasSuffix]: !!suffixIcon || isPassword },
            { [styles.error]: !!error },
            className
          )}
          {...rest}
        />
        {isPassword && (
          <span className={styles.suffixIcon} onClick={() => setShowPw(p => !p)}>
            {showPw ? '🙈' : '👁'}
          </span>
        )}
        {!isPassword && suffixIcon && <span className={styles.suffixIcon}>{suffixIcon}</span>}
      </div>
      {error && <span className={styles.errorMsg}>{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
