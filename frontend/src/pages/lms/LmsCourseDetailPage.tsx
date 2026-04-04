import React from 'react'
import { useAuthStore } from '@/stores/authStore'
import LmsCourseDetailLecturer from './LmsCourseDetailLecturer'
import LmsCourseDetailStudent from './LmsCourseDetailStudent'

const LmsCourseDetailPage: React.FC = () => {
  const user = useAuthStore(s => s.user)
  if (!user) return null
  return (user.role === 'lecturer' || user.role === 'admin')
    ? <LmsCourseDetailLecturer />
    : <LmsCourseDetailStudent />
}

export default LmsCourseDetailPage
