import 'dotenv/config'
import { validateProductionEnv } from '../lib/config/production-env'

const report = validateProductionEnv(process.env)

for (const warning of report.warnings) console.warn(`WARNING: ${warning}`)

if (report.errors.length > 0) {
  console.error('Production environment check failed:')
  for (const error of report.errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Production environment check passed (${report.warnings.length} warning(s)).`)
