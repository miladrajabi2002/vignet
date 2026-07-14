import { redirect } from 'next/navigation'
import { isAdminAuthed } from '@/lib/admin/auth'
import { AdminLoginForm } from './login-form'

export const metadata = {
  title: 'ورود مالک | Vigent',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) redirect('/admin')
  return <AdminLoginForm totpEnabled={Boolean(process.env.ADMIN_TOTP_SECRET)} />
}
