const { execSync } = require('node:child_process')

const MAX_ATTEMPTS = 3
const command = 'PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 prisma generate'

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  try {
    execSync(command, { stdio: 'inherit', env: { ...process.env } })
    process.exit(0)
  } catch (error) {
    if (attempt === MAX_ATTEMPTS) {
      console.error(`Prisma generate failed after ${MAX_ATTEMPTS} attempts`)
      process.exit(1)
    }
    console.warn(`Prisma generate failed (attempt ${attempt}). Retrying...`)
  }
}
