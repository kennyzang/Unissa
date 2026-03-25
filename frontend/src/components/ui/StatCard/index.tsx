import React from 'react'
import clsx from 'clsx'
import styles from './StatCard.module.scss'

interface StatCardProps {
  title: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  trend?: { value: number; label?: string }
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple'
  className?: string
  onClick?: () => void
}

const StatCard: React.FC<StatCardProps> = ({
  title, value, sub, icon, trend, color = 'blue', className, onClick,
}) => (
  <div
    className={clsx(styles.card, styles[color], { [styles.clickable]: !!onClick }, className)}
    onClick={onClick}
  >
    <div className={styles.top}>
      <span className={styles.title}>{title}</span>
      {icon && <span className={styles.icon}>{icon}</span>}
    </div>
    <div className={styles.value}>{value}</div>
    <div className={styles.bottom}>
      {sub && <span className={styles.sub}>{sub}</span>}
      {trend && (
        <span className={clsx(styles.trend, trend.value >= 0 ? styles.up : styles.down)}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          {trend.label && <span className={styles.trendLabel}> {trend.label}</span>}
        </span>
      )}
    </div>
  </div>
)

export default StatCard
