import React, { forwardRef, useCallback } from 'react'
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

// Ant Design's InputRef wraps the native <input> element inside a `.input` property.
// react-hook-form's `register` expects a ref pointing to the actual HTMLInputElement,
// not InputRef, so we bridge them here to ensure `{...register(...)}` works correctly.
const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, required, prefixIcon, suffixIcon,
  inputSize = 'md', type, className, style, ...rest
}, ref) => {
  const size = SIZE_MAP[inputSize]

  const setAntRef = useCallback((antInput: InputRef | null) => {
    const nativeEl = antInput?.input ?? null
    if (typeof ref === 'function') {
      ref(nativeEl)
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLInputElement | null>).current = nativeEl
    }
  }, [ref])

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
        <AntInput.Password ref={setAntRef} {...sharedProps} />
      ) : (
        <AntInput ref={setAntRef} type={type} {...sharedProps} />
      )}
      {error && <span style={{ fontSize: 12, color: '#F53F3F' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 12, color: '#86909C' }}>{hint}</span>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
