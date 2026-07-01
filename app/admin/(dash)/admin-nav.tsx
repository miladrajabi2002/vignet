'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
	LayoutDashboard,
	AlertTriangle,
	MessagesSquare,
	Bot,
	Activity,
	Server,
	LogOut,
	FileText,
} from 'lucide-react'
import { adminLogout } from '../login/actions'

const LINKS = [
	{ href: '/admin', label: 'نمای کلی', icon: LayoutDashboard, exact: true },
	{ href: '/admin/system', label: 'منابع سرور', icon: Server },
	{ href: '/admin/errors', label: 'خطاها', icon: AlertTriangle },
	{ href: '/admin/conversations', label: 'مکالمات', icon: MessagesSquare },
	{ href: '/admin/agents', label: 'ایجنت‌ها و کانال‌ها', icon: Bot },
	{ href: '/admin/blog', label: 'بلاگ', icon: FileText },
	{ href: '/admin/usage', label: 'مصرف و درخواست‌ها', icon: Activity },
]

export function AdminNav() {
	const pathname = usePathname()

	return (
		<nav className="flex flex-col gap-1">
			{LINKS.map(({ href, label, icon: Icon, exact }) => {
				const active = exact ? pathname === href : pathname.startsWith(href)
				return (
					<Link
						key={href}
						href={href}
						className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
							active
								? 'bg-zinc-800 text-zinc-100'
								: 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
						}`}
					>
						<Icon className="h-4 w-4" />
						{label}
					</Link>
				)
			})}

			<form action={adminLogout} className="mt-2">
				<button
					type="submit"
					className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-red-400"
				>
					<LogOut className="h-4 w-4" />
					خروج
				</button>
			</form>
		</nav>
	)
}
