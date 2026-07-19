import type { ReactNode } from 'react'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { pickClientMessages } from '@/lib/i18n/client-messages'

export async function ScopedIntlProvider({
	children,
	messagePaths,
}: {
	children: ReactNode
	messagePaths: readonly string[]
}) {
	const [locale, allMessages] = await Promise.all([getLocale(), getMessages()])
	const messages = pickClientMessages(allMessages, messagePaths) as AbstractIntlMessages

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			{children}
		</NextIntlClientProvider>
	)
}
