import { redirect } from 'next/navigation'
import { isAdminAuthed } from '@/lib/admin/auth'
import { AdminLoginForm } from './login-form'

export const metadata = { title: 'ورود مالک | Vigento AI — ویجنت' }

export default function AdminLoginPage() {
  if (isAdminAuthed()) redirect('/admin')
  return <AdminLoginForm />
}
