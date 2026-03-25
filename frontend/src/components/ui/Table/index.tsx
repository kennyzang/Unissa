import React from 'react'
import clsx from 'clsx'
import styles from './Table.module.scss'

export interface ColumnDef<T> {
  key: string
  title: React.ReactNode
  dataIndex?: keyof T
  width?: number | string
  align?: 'left' | 'center' | 'right'
  render?: (value: any, record: T, index: number) => React.ReactNode
  fixed?: 'left' | 'right'
}

interface TableProps<T> {
  columns: ColumnDef<T>[]
  dataSource: T[]
  rowKey: keyof T | ((record: T) => string)
  loading?: boolean
  emptyText?: string
  size?: 'sm' | 'md'
  striped?: boolean
  className?: string
  onRowClick?: (record: T) => void
}

function Table<T extends Record<string, any>>({
  columns, dataSource, rowKey, loading, emptyText = 'No data',
  size = 'md', striped, className, onRowClick,
}: TableProps<T>) {
  const getKey = (record: T) =>
    typeof rowKey === 'function' ? rowKey(record) : String(record[rowKey])

  return (
    <div className={clsx(styles.tableWrapper, className)}>
      <table className={clsx(styles.table, styles[`size-${size}`], { [styles.striped]: striped })}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align ?? 'left' }}
                className={styles.th}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} className={styles.loading}>Loading...</td></tr>
          ) : dataSource.length === 0 ? (
            <tr><td colSpan={columns.length} className={styles.empty}>{emptyText}</td></tr>
          ) : (
            dataSource.map((record, idx) => (
              <tr
                key={getKey(record)}
                className={clsx(styles.tr, { [styles.clickable]: !!onRowClick })}
                onClick={() => onRowClick?.(record)}
              >
                {columns.map(col => (
                  <td key={col.key} style={{ textAlign: col.align ?? 'left' }} className={styles.td}>
                    {col.render
                      ? col.render(col.dataIndex ? record[col.dataIndex] : record, record, idx)
                      : col.dataIndex ? record[col.dataIndex] : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default Table
