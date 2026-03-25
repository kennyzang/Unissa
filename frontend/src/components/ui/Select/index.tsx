import React from 'react'
import { Select as AntSelect } from 'antd'

interface SelectOption {
  label: string
  value: string | number
}

interface SelectProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  options: SelectOption[]
  placeholder?: string
  value?: string | number
  defaultValue?: string | number
  onChange?: (value: string | number) => void
  onBlur?: () => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  name?: string
  size?: 'small' | 'middle' | 'large'
}

const Select: React.FC<SelectProps> = ({
  label, error, hint, required, options, placeholder,
  value, defaultValue, onChange, onBlur, disabled,
  className, style, size = 'middle',
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && (
      <label style={{ fontSize: 13, fontWeight: 500, color: '#1d2129' }}>
        {label}
        {required && <span style={{ color: '#F53F3F', marginLeft: 2 }}>*</span>}
      </label>
    )}
    <AntSelect
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      status={error ? 'error' : undefined}
      className={className}
      style={{ width: '100%', ...style }}
      size={size}
      options={options}
    />
    {error && <span style={{ fontSize: 12, color: '#F53F3F' }}>{error}</span>}
    {hint && !error && <span style={{ fontSize: 12, color: '#86909C' }}>{hint}</span>}
  </div>
)

export default Select
