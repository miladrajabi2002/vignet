import { redirect } from 'next/navigation'
import { isAdminAuthed } from '@/lib/admin/auth'
import { AdminLoginForm } from './login-form'

export const metadata = { title: 'ورود مالک | Vigento AI — ویجنت' }

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) redirect('/admin')
  return <AdminLoginForm />
}
