import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Modal, Input as AntInput, InputNumber, Select as AntSelect, Switch, Popconfirm, Tabs, App,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BookOpen, Plus, Pencil, Trash2, Users } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import styles from './CourseManagementPage.module.scss'

interface Department {
  id: string
  name: string
  code: string
}

interface Course {
  id: string
  code: string
  name: string
  departmentId: string
  creditHours: number
  level: number
  isOpenToInternational: boolean
  maxSeats: number
  createdAt: string
  totalEnrolled: number
  _count: { offerings: number }
}

interface CourseForm {
  code: string
  name: string
  departmentId: string
  creditHours: number
  level: number
  isOpenToInternational: boolean
  maxSeats: number
}

interface Enrolment {
  id: string
  registeredAt: string
  student: {
    studentId: string
    user: { displayName: string }
  }
}

interface Offering {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  room: string
  seatsTaken: number
  semester: { name: string }
  lecturer: { user: { displayName: string } }
  enrolments: Enrolment[]
}

const EMPTY_FORM: CourseForm = {
  code: '', name: '', departmentId: '',
  creditHours: 3, level: 1, isOpenToInternational: true, maxSeats: 40,
}

const LEVEL_OPTIONS = [1, 2, 3, 4].map(n => ({ value: n, label: `Level ${n}` }))

const CourseManagementPage: React.FC = () => {
  const { t } = useTranslation()
  const { modal, message } = App.useApp()
  const qc = useQueryClient()

  const [search, setSearch]               = useState('')
  const [modalOpen, setModalOpen]         = useState(false)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [form, setForm]                   = useState<CourseForm>(EMPTY_FORM)
  const [formError, setFormError]         = useState('')
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null)

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['admin', 'courses'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/courses')
      return data.data
    },
  })

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['admin', 'departments'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/departments')
      return data.data
    },
  })

  const { data: offerings = [], isLoading: enrolmentsLoading } = useQuery<Offering[]>({
    queryKey: ['admin', 'course-enrolments', viewingCourse?.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/admin/courses/${viewingCourse!.id}/enrolments`)
      return data.data
    },
    enabled: !!viewingCourse,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CourseForm) => apiClient.post('/admin/courses', payload),
    onSuccess: () => {
      message.success(t('courseManagement.createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] })
      closeModal()
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? t('courseManagement.saveFailed')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CourseForm> }) =>
      apiClient.put(`/admin/courses/${id}`, payload),
    onSuccess: () => {
      message.success(t('courseManagement.updateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] })
      closeModal()
    },
    onError: (e: any) => setFormError(e.response?.data?.message ?? t('courseManagement.saveFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/courses/${id}`),
    onSuccess: () => {
      message.success(t('courseManagement.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] })
    },
    onError: (e: any) => message.error(e.response?.data?.message ?? t('courseManagement.deleteFailed')),
  })

  const removeEnrolmentMutation = useMutation({
    mutationFn: (enrolmentId: string) => apiClient.delete(`/admin/enrolments/${enrolmentId}`),
  })

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (course: Course) => {
    setEditingId(course.id)
    setForm({
      code: course.code,
      name: course.name,
      departmentId: course.departmentId,
      creditHours: course.creditHours,
      level: course.level,
      isOpenToInternational: course.isOpenToInternational,
      maxSeats: course.maxSeats,
    })
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const handleSubmit = () => {
    if (!form.code || !form.name || !form.departmentId) {
      setFormError(t('courseManagement.requiredFields'))
      return
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const filtered = courses.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))

  const confirmRemoveStudent = (record: Enrolment) => {
    const courseId = viewingCourse?.id   // capture now, before any async gap
    modal.confirm({
      title: t('courseManagement.removeStudentTitle'),
      content: t('courseManagement.removeStudentDesc', { name: record.student.user.displayName }),
      okText: t('courseManagement.removeConfirm'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await removeEnrolmentMutation.mutateAsync(record.id)
          message.success(t('courseManagement.removeStudentSuccess'))
          await qc.refetchQueries({ queryKey: ['admin', 'course-enrolments', courseId] })
          qc.invalidateQueries({ queryKey: ['admin', 'courses'] })
        } catch (e: any) {
          message.error(e.response?.data?.message ?? t('courseManagement.removeStudentFailed'))
        }
      },
    })
  }

  // Per-offering student columns
  const enrolmentColumns = (): ColumnsType<Enrolment> => [
    {
      title: t('courseManagement.colStudentName'),
      key: 'name',
      render: (_: unknown, r: Enrolment) => r.student.user.displayName,
    },
    {
      title: t('courseManagement.colStudentId'),
      key: 'studentId',
      width: 120,
      render: (_: unknown, r: Enrolment) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.student.studentId}</span>
      ),
    },
    {
      title: t('courseManagement.colRegisteredAt'),
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_: unknown, record: Enrolment) => (
        <Button
          variant="ghost" size="sm"
          icon={<Trash2 size={13} />}
          onClick={() => confirmRemoveStudent(record)}
        />
      ),
    },
  ]

  const enrolmentTabs = offerings.map(o => ({
    key: o.id,
    label: (
      <span>
        {o.semester.name} · {o.dayOfWeek} {o.startTime}–{o.endTime}
        <Badge color={o.enrolments.length >= (viewingCourse?.maxSeats ?? 0) ? 'orange' : 'blue'} style={{ marginLeft: 6 }}>
          {o.enrolments.length}/{viewingCourse?.maxSeats ?? '?'}
        </Badge>
      </span>
    ),
    children: (
      <div>
        <div className={styles.offeringMeta}>
          <span>{t('courseManagement.room')}: <strong>{o.room}</strong></span>
          <span>{t('courseManagement.lecturer')}: <strong>{o.lecturer.user.displayName}</strong></span>
          <span>{t('courseManagement.seatsTaken')}: <strong>{o.seatsTaken}</strong></span>
        </div>
        <Table<Enrolment>
          dataSource={o.enrolments}
          columns={enrolmentColumns()}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: t('courseManagement.noStudents') }}
        />
      </div>
    ),
  }))

  const columns: ColumnsType<Course> = [
    {
      title: t('courseManagement.colCode'),
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: code => <strong>{code}</strong>,
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      title: t('courseManagement.colName'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('courseManagement.colDepartment'),
      dataIndex: 'departmentId',
      key: 'department',
      render: id => deptMap[id] ?? id,
    },
    {
      title: t('courseManagement.colCredits'),
      dataIndex: 'creditHours',
      key: 'creditHours',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.creditHours - b.creditHours,
    },
    {
      title: t('courseManagement.colLevel'),
      dataIndex: 'level',
      key: 'level',
      width: 80,
      align: 'center',
    },
    {
      title: t('courseManagement.colSeats'),
      dataIndex: 'maxSeats',
      key: 'maxSeats',
      width: 80,
      align: 'center',
    },
    {
      title: t('courseManagement.colEnrolled'),
      key: 'enrolled',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.totalEnrolled - b.totalEnrolled,
      render: (_: unknown, r: Course) => (
        <Badge color={r.totalEnrolled > 0 ? 'green' : 'gray'}>
          {r.totalEnrolled}
        </Badge>
      ),
    },
    {
      title: t('courseManagement.colOfferings'),
      key: 'offerings',
      width: 90,
      align: 'center',
      render: (_: unknown, r: Course) => (
        <Badge color={r._count.offerings > 0 ? 'blue' : 'gray'}>
          {r._count.offerings}
        </Badge>
      ),
    },
    {
      title: t('courseManagement.colIntl'),
      dataIndex: 'isOpenToInternational',
      key: 'intl',
      width: 90,
      align: 'center',
      render: (v: boolean) => (
        <Badge color={v ? 'green' : 'gray'}>{v ? t('common.yes') : t('common.no')}</Badge>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_: unknown, record: Course) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <Button
            variant="ghost" size="sm"
            icon={<Users size={13} />}
            onClick={() => setViewingCourse(record)}
            title={t('courseManagement.viewStudents')}
          />
          <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(record)} />
          <Popconfirm
            title={t('courseManagement.deleteConfirmTitle')}
            description={
              <p className={styles.deleteWarning}>
                {t('courseManagement.deleteConfirmDesc', { code: record.code })}
                {record._count.offerings > 0 && (
                  <><br /><strong>{t('courseManagement.deleteHasOfferings', { count: record._count.offerings })}</strong></>
                )}
              </p>
            }
            okText={t('common.delete')}
            okButtonProps={{ danger: true }}
            cancelText={t('common.cancel')}
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} />
          </Popconfirm>
        </div>
      ),
    },
  ]

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <BookOpen size={20} />
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t('courseManagement.title')}</h1>
          <p className={styles.sub}>{t('courseManagement.subtitle')}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <AntInput.Search
          className={styles.searchInput}
          placeholder={t('courseManagement.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
        <Button icon={<Plus size={14} />} onClick={openCreate}>
          {t('courseManagement.addCourse')}
        </Button>
      </div>

      <Table<Course>
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        title={editingId ? t('courseManagement.editTitle') : t('courseManagement.createTitle')}
        onCancel={closeModal}
        onOk={handleSubmit}
        okText={editingId ? t('common.save') : t('courseManagement.addCourse')}
        confirmLoading={isSaving}
        destroyOnClose
        width={600}
      >
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>{t('courseManagement.fieldCode')} *</label>
            <AntInput
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="e.g. IFN301"
              disabled={!!editingId}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('courseManagement.fieldDepartment')} *</label>
            <AntSelect
              style={{ width: '100%' }}
              value={form.departmentId || undefined}
              onChange={val => setForm(f => ({ ...f, departmentId: val }))}
              placeholder={t('courseManagement.selectDepartment')}
              options={departments.map(d => ({ value: d.id, label: d.name }))}
            />
          </div>

          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label>{t('courseManagement.fieldName')} *</label>
            <AntInput
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={t('courseManagement.fieldNamePlaceholder')}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('courseManagement.fieldCredits')}</label>
            <InputNumber
              min={1} max={6} style={{ width: '100%' }}
              value={form.creditHours}
              onChange={val => setForm(f => ({ ...f, creditHours: val ?? 3 }))}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('courseManagement.fieldLevel')}</label>
            <AntSelect
              style={{ width: '100%' }}
              value={form.level}
              onChange={val => setForm(f => ({ ...f, level: val }))}
              options={LEVEL_OPTIONS}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('courseManagement.fieldSeats')}</label>
            <InputNumber
              min={1} max={500} style={{ width: '100%' }}
              value={form.maxSeats}
              onChange={val => setForm(f => ({ ...f, maxSeats: val ?? 40 }))}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('courseManagement.fieldOpenIntl')}</label>
            <Switch
              checked={form.isOpenToInternational}
              onChange={checked => setForm(f => ({ ...f, isOpenToInternational: checked }))}
              checkedChildren={t('common.yes')}
              unCheckedChildren={t('common.no')}
            />
          </div>
        </div>

        {formError && <p className={styles.errorMsg}>{formError}</p>}
      </Modal>

      {/* View enrolled students modal */}
      <Modal
        open={!!viewingCourse}
        title={
          viewingCourse
            ? `${viewingCourse.code} — ${t('courseManagement.studentsModalTitle')}`
            : ''
        }
        onCancel={() => setViewingCourse(null)}
        footer={null}
        destroyOnClose
        width={780}
      >
        {enrolmentsLoading ? (
          <p style={{ textAlign: 'center', padding: '24px 0', color: '#888' }}>{t('common.loading')}</p>
        ) : offerings.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '24px 0', color: '#888' }}>{t('courseManagement.noOfferings')}</p>
        ) : (
          <Tabs items={enrolmentTabs} size="small" />
        )}
      </Modal>
    </div>
  )
}

export default CourseManagementPage
