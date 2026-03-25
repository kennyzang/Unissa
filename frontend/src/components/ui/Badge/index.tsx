import React from 'react'
import clsx from 'clsx'
import styles from './Badge.module.scss'

export type BadgeColor = 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple' | 'cyan'
export type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  color?: BadgeColor
  size?: BadgeSize
  dot?: boolean
  children: React.ReactNode
  className?: string
}

const Badge: React.FC<BadgeProps> = ({ color = 'blue', size = 'md', dot, children, className }) => (
  <span className={clsx(styles.badge, styles[color], styles[`size-${size}`], className)}>
    {dot && <span className={styles.dot} />}
    {children}
  </span>
)

export default Badge
