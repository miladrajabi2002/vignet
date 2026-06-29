import os from 'os'
import { statfs } from 'fs/promises'

export interface ServerMetrics {
  /** Unix epoch ms when sampled. */
  t: number
  cpuCount: number
  /** 1-minute load average as a percentage of cores (0..100+, can exceed 100). */
  loadPct: number
  load1: number
  memTotal: number
  memUsed: number
  memPct: number
  /** Process uptime is misleading under PM2; report OS uptime in seconds. */
  uptime: number
  disk: { total: number; used: number; pct: number } | null
}

/**
 * Sample current server resource usage. Pure Node `os` plus `fs.statfs` for
 * disk — no external dependency. Disk returns null on platforms where statfs
 * isn't available (e.g. some Windows dev setups).
 */
export async function getServerMetrics(): Promise<ServerMetrics> {
  const cpus = os.cpus()
  const cpuCount = cpus.length || 1
  const load1 = os.loadavg()[0] ?? 0
  const memTotal = os.totalmem()
  const memFree = os.freemem()
  const memUsed = memTotal - memFree

  let disk: ServerMetrics['disk'] = null
  try {
    const path = process.platform === 'win32' ? process.cwd() : '/'
    const fsStat = await statfs(path)
    const total = fsStat.blocks * fsStat.bsize
    const avail = fsStat.bavail * fsStat.bsize
    const used = total - avail
    disk = { total, used, pct: total > 0 ? (used / total) * 100 : 0 }
  } catch {
    disk = null
  }

  return {
    t: Date.now(),
    cpuCount,
    load1,
    loadPct: (load1 / cpuCount) * 100,
    memTotal,
    memUsed,
    memPct: memTotal > 0 ? (memUsed / memTotal) * 100 : 0,
    uptime: os.uptime(),
    disk,
  }
}
