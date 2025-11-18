const { execSync } = require('node:child_process')

const MAX_ATTEMPTS = 6
const mirrors = [process.env.PRISMA_ENGINES_MIRROR].filter(Boolean)
const baseEnv = {
  ...process.env,
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const mirror = attempt <= mirrors.length ? mirrors[attempt - 1] : null
  const env = mirror ? { ...baseEnv, PRISMA_ENGINES_MIRROR: mirror } : { ...baseEnv }
  try {
    execSync('prisma generate', { stdio: 'inherit', env })
    process.exit(0)
  } catch (error) {
    if (attempt === MAX_ATTEMPTS) {
      console.error(`Prisma generate failed after ${MAX_ATTEMPTS} attempts`)
      process.exit(1)
    }
    const delayMs = 500 * attempt
    const mirrorInfo = mirror ? ` using mirror ${mirror}` : ' using default upstream'
    console.warn(`Prisma generate failed (attempt ${attempt}${mirrorInfo}). Retrying in ${delayMs}ms...`)
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
  }
}
