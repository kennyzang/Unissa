import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Package } from 'lucide-react'
import { Pagination } from 'antd'
import { apiClient } from '@/lib/apiClient'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import type { ColumnDef } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import styles from './ProductsPage.module.scss'

interface Product {
  id: string
  code: string
  name: string
  description?: string
  unit: string
  defaultUnitPrice: number
  isActive: boolean
  category?: { id: string; name: string }
  createdAt: string
}

interface ItemCategory { id: string; code: string; name: string }

const UNIT_OPTIONS = [
  { value: 'pcs',  label: 'pcs (pieces)' },
  { value: 'unit', label: 'unit' },
  { value: 'box',  label: 'box' },
  { value: 'set',  label: 'set' },
  { value: 'pack', label: 'pack' },
  { value: 'ream', label: 'ream' },
  { value: 'roll', label: 'roll' },
  { value: 'kg',   label: 'kg' },
  { value: 'litre','label': 'litre' },
]

const ProductsPage: React.FC = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const addToast = useUIStore(s => s.addToast)
  const qc = useQueryClient()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  const canManage = user?.role === 'manager' || user?.role === 'admin'

  const productSchema = z.object({
    code: z.string()
      .min(2, t('products.validation.codeMin'))
      .max(20, t('products.validation.codeMax'))
      .regex(/^[A-Z0-9-]+$/, t('products.validation.codeFormat')),
    name: z.string()
      .min(3, t('products.validation.nameMin'))
      .max(100, t('products.validation.nameMax')),
    description: z.string().max(200, t('products.validation.descMax')).optional(),
    unit: z.string().min(1, t('products.validation.unitRequired')),
    defaultUnitPrice: z.coerce
      .number({ invalid_type_error: t('products.validation.priceNumber') })
      .min(0.01, t('products.validation.priceMin'))
      .max(999999, t('products.validation.priceMax')),
    categoryId: z.string().optional(),
  })
  type ProductForm = z.infer<typeof productSchema>

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get('/products/all')
      return data.data
    },
  })

  const { data: categories = [] } = useQuery<ItemCategory[]>({
    queryKey: ['item-categories'],
    queryFn: async () => {
      const { data } = await apiClient.get('/procurement/categories')
      return data.data ?? []
    },
    retry: false,
  })

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  })

  const openCreate = () => {
    setEditTarget(null)
    reset({ code: '', name: '', description: '', unit: 'pcs', defaultUnitPrice: undefined as any, categoryId: '' })
    setModal('create')
  }

  const openEdit = (p: Product) => {
    setEditTarget(p)
    reset({
      code: p.code,
      name: p.name,
      description: p.description ?? '',
      unit: p.unit,
      defaultUnitPrice: p.defaultUnitPrice,
      categoryId: p.category?.id ?? '',
    })
    setModal('edit')
  }

  const createMutation = useMutation({
    mutationFn: (form: ProductForm) => apiClient.post('/products', form),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message ?? t('products.createSuccess') })
      setModal(null)
      reset()
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? t('products.createFailed') })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (form: ProductForm) => apiClient.put(`/products/${editTarget!.id}`, form),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message ?? t('products.updateSuccess') })
      setModal(null)
      reset()
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? t('products.updateFailed') })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/products/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    (p.category?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // Pagination logic
  const totalItems = filtered.length
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedData = filtered.slice(startIndex, endIndex)

  const columns: ColumnDef<Product>[] = [
    { key: 'code', title: t('products.code'), render: v => <span className={styles.productCode}>{v.code}</span> },
    { key: 'name', title: t('products.name'), render: v => (
      <div>
        <div className={styles.productName}>{v.name}</div>
        {v.description && <div className={styles.productDesc}>{v.description}</div>}
      </div>
    )},
    { key: 'category', title: t('products.category'), render: v => v.category ? (
      <Badge color="blue" size="sm">{v.category.name}</Badge>
    ) : <span className={styles.noCategory}>—</span> },
    { key: 'unit', title: t('products.unit'), render: v => <span className={styles.unitBadge}>{v.unit}</span> },
    { key: 'defaultUnitPrice', title: t('products.defaultPrice'), render: v => (
      <span className={styles.priceCell}>BND {v.defaultUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    )},
    { key: 'isActive', title: t('products.status'), render: v => (
      <Badge color={v.isActive ? 'green' : 'gray'} size="sm">{v.isActive ? t('products.active') : t('products.inactive')}</Badge>
    )},
    { key: 'actions', title: '', render: v => (
      <div className={styles.actionCell}>
        {canManage && (
          <Button size="sm" variant="ghost" icon={<Edit2 size={13} />} onClick={() => openEdit(v)}>
            {t('common.edit')}
          </Button>
        )}
        {user?.role === 'admin' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleMutation.mutate(v.id)}
            loading={toggleMutation.isPending}
          >
            {v.isActive ? t('products.deactivate') : t('products.activate')}
          </Button>
        )}
      </div>
    )},
  ]

  const categoryOptions = [
    { value: '', label: t('products.noCategory') },
    ...categories.map(c => ({ value: c.id, label: c.name })),
  ]

  const isEdit = modal === 'edit'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{t('products.title')}</h1>
          <p className={styles.pageSub}>{t('products.subtitle')}</p>
        </div>
        {canManage && (
          <Button icon={<Plus size={16} />} onClick={openCreate}>
            {t('products.newProduct')}
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <Package size={20} className={styles.statIcon} />
          <div>
            <div className={styles.statNum}>{products.length}</div>
            <div className={styles.statLabel}>{t('products.totalProducts')}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statDot} style={{ background: '#00B42A' }} />
          <div>
            <div className={styles.statNum}>{products.filter(p => p.isActive).length}</div>
            <div className={styles.statLabel}>{t('products.activeProducts')}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div>
            <div className={styles.statNum}>{new Set(products.map(p => p.category?.name).filter(Boolean)).size}</div>
            <div className={styles.statLabel}>{t('products.categories')}</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder={t('products.searchPlaceholder')}
        value={search}
        onChange={e => setSearch((e.target as HTMLInputElement).value)}
        style={{ maxWidth: 360 }}
      />

      <Card noPadding>
        <Table<Product>
          columns={columns}
          dataSource={paginatedData}
          rowKey="id"
          loading={isLoading}
          size="sm"
          emptyText={t('products.noProductsFound')}
        />
        {totalItems > 0 && (
          <div className={styles.pagination}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalItems}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(total) => `${t('common.total')}: ${total}`}
            />
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modal !== null}
        title={isEdit ? t('products.editProduct') : t('products.createProduct')}
        onClose={() => { setModal(null); reset() }}
        footer={null}
        className={styles.productModal}
      >
        {/* Field rules banner */}
        <div className={styles.validationRules}>
          <div className={styles.rulesTitle}>{t('products.rulesTitle')}</div>
          <ul className={styles.rulesList}>
            <li><span className={styles.ruleField}>{t('products.code')}:</span> {t('products.rules.code')}</li>
            <li><span className={styles.ruleField}>{t('products.name')}:</span> {t('products.rules.name')}</li>
            <li><span className={styles.ruleField}>{t('products.defaultPrice')}:</span> {t('products.rules.price')}</li>
            <li><span className={styles.ruleField}>{t('products.unit')}:</span> {t('products.rules.unit')}</li>
          </ul>
        </div>

        <form
          onSubmit={handleSubmit(d => isEdit ? updateMutation.mutate(d) : createMutation.mutate(d))}
          className={styles.productForm}
        >
          <div className={styles.formRow}>
            <Input
              label={t('products.code')}
              required
              {...register('code')}
              error={errors.code?.message}
              hint={t('products.hints.code')}
              disabled={isEdit}
            />
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select
                  label={t('products.unit')}
                  required
                  value={field.value}
                  onChange={val => field.onChange(val)}
                  error={errors.unit?.message}
                  hint={t('products.hints.unit')}
                  options={UNIT_OPTIONS}
                />
              )}
            />
          </div>

          <Input
            label={t('products.name')}
            required
            {...register('name')}
            error={errors.name?.message}
            hint={t('products.hints.name')}
          />

          <Input
            label={t('products.description')}
            {...register('description')}
            error={errors.description?.message}
            hint={t('products.hints.description')}
          />

          <div className={styles.formRow}>
            <Input
              label={t('products.defaultPrice')}
              type="number"
              step="0.01"
              required
              {...register('defaultUnitPrice')}
              error={errors.defaultUnitPrice?.message}
              hint={t('products.hints.price')}
            />
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  label={t('products.category')}
                  value={field.value ?? ''}
                  onChange={val => field.onChange(val)}
                  hint={t('products.hints.category')}
                  options={categoryOptions}
                />
              )}
            />
          </div>

          <div className={styles.formActions}>
            <Button variant="secondary" type="button" onClick={() => { setModal(null); reset() }}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              icon={<Package size={14} />}
            >
              {isEdit ? t('products.saveChanges') : t('products.createProduct')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default ProductsPage
