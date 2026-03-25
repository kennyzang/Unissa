import React from 'react'
import clsx from 'clsx'
import styles from './Card.module.scss'

interface CardProps {
  title?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  noPadding?: boolean
  bordered?: boolean
}

const Card: React.FC<CardProps> = ({
  title, extra, children, className, bodyClassName, noPadding, bordered = true,
}) => (
  <div className={clsx(styles.card, { [styles.bordered]: bordered }, className)}>
    {(title || extra) && (
      <div className={styles.header}>
        {title && <div className={styles.title}>{title}</div>}
        {extra && <div className={styles.extra}>{extra}</div>}
      </div>
    )}
    <div className={clsx(styles.body, { [styles.noPadding]: noPadding }, bodyClassName)}>
      {children}
    </div>
  </div>
)

export default Card
