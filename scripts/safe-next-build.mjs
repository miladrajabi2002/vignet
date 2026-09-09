import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targetDistDir = process.env.VIGENT_NEXT_DIST_DIR || '.next'
const targetPath = path.resolve(projectRoot, targetDistDir)

function activeProductionBuild() {
	try {
		const output = execFileSync('pm2', ['jlist'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const processInfo = JSON.parse(output).find(
			(item) =>
				item.name === 'vignet-web' &&
				item.pm2_env?.status === 'online' &&
				path.resolve(item.pm2_env?.pm_cwd || '') === projectRoot,
		)
		if (!processInfo) return null

		const activeDistDir = processInfo.pm2_env?.VIGENT_NEXT_DIST_DIR || '.next'
		return {
			path: path.resolve(projectRoot, activeDistDir),
			pid: processInfo.pid,
		}
	} catch {
		// PM2 is optional in local development. A missing daemon/CLI means there
		// is no production process for this guard to protect.
		return null
	}
}

const activeBuild = activeProductionBuild()
if (
	process.env.VIGENT_ALLOW_IN_PLACE_BUILD !== '1' &&
	activeBuild?.path === targetPath
) {
	console.error(
		`ERROR: refusing to overwrite the live Next.js build (${targetDistDir}, PID ${activeBuild.pid}).\n` +
			'Use bash deploy/deploy.sh, or choose a different VIGENT_NEXT_DIST_DIR.',
	)
	process.exit(1)
}

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: projectRoot,
		env: process.env,
		stdio: 'inherit',
	})
	if (result.error) throw result.error
	if (result.status !== 0) process.exit(result.status ?? 1)
}

run(process.execPath, [path.join(projectRoot, 'scripts/minify-widget.mjs')])

// Next.js appends the exact distDir types path to tsconfig.json. Production
// distDirs are commit-specific, so allowing that rewrite would dirty the
// worktree after every deployment. The generated declarations are build-only;
// restore the user's tsconfig byte-for-byte even when compilation fails.
const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
const originalTsconfig = readFileSync(tsconfigPath)
try {
	run(process.execPath, [require.resolve('next/dist/bin/next'), 'build'])
} finally {
	writeFileSync(tsconfigPath, originalTsconfig)
}
