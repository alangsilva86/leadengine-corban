const { execSync } = require('node:child_process')

const MAX_ATTEMPTS = 5
const env = {
  ...process.env,
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  // Use the public S3 mirror to avoid intermittent 500s on binaries.prisma.sh
  PRISMA_ENGINES_MIRROR: process.env.PRISMA_ENGINES_MIRROR || 'https://prisma-builds.s3-eu-west-1.amazonaws.com',
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  try {
    execSync('prisma generate', { stdio: 'inherit', env })
    process.exit(0)
  } catch (error) {
    if (attempt === MAX_ATTEMPTS) {
      console.error(`Prisma generate failed after ${MAX_ATTEMPTS} attempts`)
      process.exit(1)
    }
    const delayMs = 500 * attempt
    console.warn(`Prisma generate failed (attempt ${attempt}). Retrying in ${delayMs}ms...`)
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
  }
}
