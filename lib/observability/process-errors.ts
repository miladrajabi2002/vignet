import { captureError, captureWarning } from '@/lib/errors/capture'

const INSTALL_KEY = Symbol.for('vigent.observability.process-handlers')

/** Install once per Node process without changing Node's crash semantics. */
export function installProcessErrorObservers(processName: string): void {
  const state = globalThis as typeof globalThis & { [INSTALL_KEY]?: boolean }
  if (state[INSTALL_KEY]) return
  state[INSTALL_KEY] = true

  process.on('warning', (warning) => {
    captureWarning(`${processName}:node-warning`, warning, {
      metadata: { warningName: warning.name },
    })
  })

  // Unlike `uncaughtException`, the monitor event does not prevent Node from
  // exiting. We observe the crash without accidentally keeping a corrupt
  // process alive.
  process.on('uncaughtExceptionMonitor', (error, origin) => {
    captureError(`${processName}:uncaught-exception`, error, {
      metadata: { origin },
    })
  })
}
