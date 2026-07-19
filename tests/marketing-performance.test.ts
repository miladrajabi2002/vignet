import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import enMessages from '@/messages/en.json'
import faMessages from '@/messages/fa.json'
import { PROTECTED_PREFIXES } from '@/auth.config'
import {
	ADMIN_CLIENT_MESSAGE_PATHS,
	AUTH_CLIENT_MESSAGE_PATHS,
	DASHBOARD_CLIENT_MESSAGE_PATHS,
	MARKETING_CLIENT_MESSAGE_PATHS,
	pickClientMessages,
} from '@/lib/i18n/client-messages'

const DASHBOARD_COMPONENT_PREFIXES = [
	'agent-builder',
	'agents',
	'channels',
	'crm',
	'dashboard',
	'instagram',
	'knowledge',
	'products',
	'settings',
] as const

function coversNamespace(paths: readonly string[], namespace: string) {
	return paths.some((path) => path === namespace || namespace.startsWith(`${path}.`))
}

describe('marketing launch performance boundaries', () => {
	it.each([
		['fa', faMessages],
		['en', enMessages],
	] as const)('serializes only the %s client message subset', (_locale, messages) => {
		const scoped = pickClientMessages(messages, MARKETING_CLIENT_MESSAGE_PATHS)
		const fullBytes = Buffer.byteLength(JSON.stringify(messages))
		const scopedBytes = Buffer.byteLength(JSON.stringify(scoped))

		expect(scoped).toHaveProperty('nav')
		expect(scoped).toHaveProperty('marketing.hero')
		expect(scoped).not.toHaveProperty('agents')
		expect(scoped).not.toHaveProperty('marketing.demo')
		expect(scopedBytes).toBeLessThan(fullBytes * 0.15)
	})

	it('covers every translation hook in marketing Client Components', () => {
		const directory = join(process.cwd(), 'components', 'marketing')
		const namespaces = readdirSync(directory)
			.filter((file) => file.endsWith('.tsx'))
			.flatMap((file) => {
				const source = readFileSync(join(directory, file), 'utf8')
				return [...source.matchAll(/useTranslations\(['"]([^'"]+)['"]\)/g)]
					.map((match) => match[1])
			})

		for (const namespace of namespaces) {
			expect(
				coversNamespace(MARKETING_CLIENT_MESSAGE_PATHS, namespace),
				`Missing scoped messages for ${namespace}`,
			).toBe(true)
		}
	})

	it('maps every translated Client Component to its route provider', () => {
		const componentsRoot = join(process.cwd(), 'components')
		const files = readdirSync(componentsRoot, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
			.map((entry) => join(entry.parentPath, entry.name))

		for (const file of files) {
			const source = readFileSync(file, 'utf8')
			const namespaces = [...source.matchAll(/useTranslations\(['"]([^'"]+)['"]\)/g)]
				.map((match) => match[1])
			if (!namespaces.length) continue

			const relative = file.slice(componentsRoot.length + 1).replaceAll('\\', '/')
			const messagePaths = relative.startsWith('marketing/')
				? MARKETING_CLIENT_MESSAGE_PATHS
				: relative.startsWith('auth/')
					? AUTH_CLIENT_MESSAGE_PATHS
					: relative.startsWith('blog/')
						? ADMIN_CLIENT_MESSAGE_PATHS
						: DASHBOARD_COMPONENT_PREFIXES.some((prefix) => relative.startsWith(`${prefix}/`))
							? DASHBOARD_CLIENT_MESSAGE_PATHS
							: null

			expect(messagePaths, `No route provider mapped for ${relative}`).not.toBeNull()
			for (const namespace of namespaces) {
				expect(
					coversNamespace(messagePaths ?? [], namespace),
					`Missing ${namespace} messages for ${relative}`,
				).toBe(true)
			}
		}
	})

	it('keeps root-only public and error surfaces translation-hook free', () => {
		const rootOnlyFiles = [
			'app/global-error.tsx',
			'app/admin/login/login-form.tsx',
			'app/c/[slug]/chat-client.tsx',
			'app/menu/[slug]/page.tsx',
		]

		for (const file of rootOnlyFiles) {
			const source = readFileSync(join(process.cwd(), file), 'utf8')
			expect(source, `${file} needs a scoped intl provider`).not.toMatch(/useTranslations\(/)
		}
	})

	it('keeps public pages outside authenticated route prefixes', () => {
		const isProtected = (pathname: string) => PROTECTED_PREFIXES.some(
			(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
		)

		expect(isProtected('/')).toBe(false)
		expect(isProtected('/blog')).toBe(false)
		expect(isProtected('/docs/getting-started')).toBe(false)
		expect(isProtected('/menu/public-shop')).toBe(false)
		expect(isProtected('/overview')).toBe(true)
		expect(isProtected('/appointments')).toBe(true)
		expect(isProtected('/instagram/new')).toBe(true)
		expect(isProtected('/vigento')).toBe(true)
	})
})
