#!/usr/bin/env node

// Prisma accepts a handful of connection-string parameters that libpq tools
// such as pg_dump do not understand. Keep the transport/TLS parameters intact
// and remove only the Prisma-specific options before invoking pg_dump.
const PRISMA_ONLY_PARAMETERS = [
	'connection_limit',
	'pgbouncer',
	'pool_timeout',
	'schema',
	'socket_timeout',
	'statement_cache_size',
	'sslaccept',
	'sslidentity',
]

function fail(message) {
	console.error(message)
	process.exit(1)
}

const rawUrl = process.argv[2]?.trim()
if (!rawUrl) fail('Database connection URL is empty')

let url
try {
	url = new URL(rawUrl)
} catch {
	fail('Database connection URL is invalid')
}

if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
	fail('Database connection URL must use postgresql:// or postgres://')
}

for (const parameter of PRISMA_ONLY_PARAMETERS) {
	url.searchParams.delete(parameter)
}

process.stdout.write(url.toString())
