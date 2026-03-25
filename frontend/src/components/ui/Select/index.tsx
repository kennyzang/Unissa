import React, { forwardRef } from 'react'
import clsx from 'clsx'
import styles from './Select.module.scss'

interface SelectOption { label: string; value: string | number }

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, error, hint, required, options, placeholder, className, ...rest
}, ref) => (
  <div className={styles.wrapper}>
    {label && (
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
    )}
    <select
      ref={ref}
      className={clsx(styles.select, { [styles.error]: !!error }, className)}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    {error && <span className={styles.errorMsg}>{error}</span>}
    {hint && !error && <span className={styles.hint}>{hint}</span>}
  </div>
))

Select.displayName = 'Select'
export default Select
