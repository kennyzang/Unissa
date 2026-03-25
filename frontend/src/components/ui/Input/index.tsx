import React, { forwardRef } from 'react'
import { Input as AntInput } from 'antd'
import type { InputRef } from 'antd'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  prefixIcon?: React.ReactNode
  suffixIcon?: React.ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

const SIZE_MAP = { sm: 'small', md: 'middle', lg: 'large' } as const

const Input = forwardRef<InputRef, InputProps>(({
  label, error, hint, required, prefixIcon, suffixIcon,
  inputSize = 'md', type, className, style, ...rest
}, ref) => {
  const size = SIZE_MAP[inputSize]

  const sharedProps = {
    size,
    prefix: prefixIcon,
    suffix: suffixIcon,
    status: error ? ('error' as const) : undefined,
    className,
    style,
    ...rest,
  } as any

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: '#1d2129' }}>
          {label}
          {required && <span style={{ color: '#F53F3F', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {type === 'password' ? (
        <AntInput.Password ref={ref} {...sharedProps} />
      ) : (
        <AntInput ref={ref} type={type} {...sharedProps} />
      )}
      {error && <span style={{ fontSize: 12, color: '#F53F3F' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 12, color: '#86909C' }}>{hint}</span>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
