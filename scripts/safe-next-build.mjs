import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targetDistDir = process.env.VIGENT_NEXT_DIST_DIR || '.next'
const targetPath = path.resolve(projectRoot, targetDistDir)

// Never let a process-wide TLS bypass leak into build tools. Production env
// validation still rejects the setting before deploy reaches this script.
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED

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

function spawn(command, args, extraEnv = {}) {
	const result = spawnSync(command, args, {
		cwd: projectRoot,
		env: { ...process.env, ...extraEnv },
		stdio: 'inherit',
	})
	if (result.error) throw result.error
	return result.status ?? 1
}

function run(command, args) {
	const status = spawn(command, args)
	if (status !== 0) process.exit(status)
}

run(process.execPath, [path.join(projectRoot, 'scripts/minify-widget.mjs')])

// Next.js appends the exact distDir types path to tsconfig.json. Production
// distDirs are commit-specific, so allowing that rewrite would dirty the
// worktree after every deployment. The generated declarations are build-only;
// restore the user's tsconfig byte-for-byte even when compilation fails.
const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
const originalTsconfig = readFileSync(tsconfigPath)
// Type-check in its own process before `next build`. Inside the build, the
// checker ran on top of webpack's heap and was OOM-killed on the 8 GB host;
// sequentially each phase fits. Generated route types of every .next* dir are
// left out — `**/*.ts` would otherwise pull in ~220 files per retained release.
const checkConfigPath = path.join(projectRoot, '.tsconfig.build-check.json')
writeFileSync(
	checkConfigPath,
	`${JSON.stringify({
		extends: './tsconfig.json',
		compilerOptions: { incremental: false },
		exclude: ['node_modules', '.next', '.next-*'],
	}, null, 2)}\n`,
)
let typecheckStatus = 1
try {
	console.log('==> Type-checking (tsc --noEmit)')
	typecheckStatus = spawn(process.execPath, [
		require.resolve('typescript/bin/tsc'),
		'-p',
		checkConfigPath,
		'--noEmit',
	])
} finally {
	rmSync(checkConfigPath, { force: true })
}
if (typecheckStatus !== 0) process.exit(typecheckStatus)

let buildStatus = 1
try {
	buildStatus = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], {
		// next.config.mjs skips its in-build type check only with this flag.
		VIGENT_TYPES_CHECKED: '1',
	})
} finally {
	// process.exit() inside the try would skip this, so exit only afterwards.
	writeFileSync(tsconfigPath, originalTsconfig)
}
if (buildStatus !== 0) process.exit(buildStatus)
