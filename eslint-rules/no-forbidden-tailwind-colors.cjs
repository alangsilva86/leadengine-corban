const fs = require('node:fs')
const path = require('node:path')
const { minimatch } = require('minimatch')

const DEFAULT_PATTERNS = [
  {
    id: 'text-slate',
    test: (className) => /^text-slate-\d+$/.test(className),
    message:
      'Classes `text-slate-*` são proibidas. Utilize utilitários semânticos como `textForeground`, `textMutedForeground` ou tokens equivalentes.',
  },
  {
    id: 'bg-white',
    test: (className) => className.startsWith('bg-white/'),
    message:
      'Classes `bg-white/...` são proibidas. Utilize superfícies semânticas como `bgSurface`, `bgSurfaceOverlayQuiet` ou variáveis CSS do design system.',
  },
  {
    id: 'border-white',
    test: (className) => className === 'border-white' || className.startsWith('border-white/'),
    message:
      'Classes `border-white` e `border-white/...` são proibidas. Utilize utilitários como `borderSurfaceGlassBorder`, `borderBorder` ou tokens equivalentes.',
  },
]

const loadAllowlist = (options, context) => {
  const { allowlist = [], allowlistPath } = options || {}

  if (!allowlistPath) {
    return allowlist.map((pattern) => ({
      pattern,
      matcher: (filePath) => minimatch(filePath, pattern, { dot: true }),
    }))
  }

  const cwd = typeof context.getCwd === 'function' ? context.getCwd() : process.cwd()
  const resolved = path.resolve(cwd, allowlistPath)

  try {
    const raw = fs.readFileSync(resolved, 'utf8')
    const entries = JSON.parse(raw)

    return entries.map((entry) => ({
      pattern: entry.pattern,
      reason: entry.reason,
      matcher: (filePath) => minimatch(filePath, entry.pattern, { dot: true }),
    }))
  } catch (error) {
    throw new Error(`Não foi possível carregar o arquivo de exceções '${allowlistPath}': ${error.message}`)
  }
}

const isAllowlisted = (filePath, allowlist) =>
  allowlist.some((entry) => entry.matcher(filePath))

const extractCandidateClasses = (value) =>
  value
    .split(/\s+/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)

const normalizeClassForMatch = (className) => {
  let normalized = className

  if (normalized.startsWith('!')) {
    normalized = normalized.slice(1)
  }

  const lastSegment = normalized.split(':').pop()

  return lastSegment ?? normalized
}

const toPosix = (value) => value.split(path.sep).join('/')

const resolveBaseDir = (options, context) => {
  const cwd = typeof context.getCwd === 'function' ? context.getCwd() : process.cwd()
  const baseDirOption = options.baseDir ?? '.'

  return path.resolve(cwd, baseDirOption)
}

const checkValue = (context, node, rawValue, allowlistMatchers, baseDir) => {
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return
  }

  const cwd = typeof context.getCwd === 'function' ? context.getCwd() : process.cwd()
  const filenameAbsolute = context.getFilename()

  if (!filenameAbsolute || filenameAbsolute === '<input>') {
    return
  }

  const relativeToCwd = toPosix(path.relative(cwd, filenameAbsolute))
  const relativeToBase = toPosix(path.relative(baseDir, filenameAbsolute))
  const absolutePosix = toPosix(filenameAbsolute)

  const candidatePaths = [relativeToCwd, relativeToBase, absolutePosix].filter(Boolean)

  if (candidatePaths.some((pathCandidate) => isAllowlisted(pathCandidate, allowlistMatchers))) {
    return
  }

  for (const candidate of extractCandidateClasses(rawValue)) {
    const normalized = normalizeClassForMatch(candidate)

    const match = DEFAULT_PATTERNS.find((pattern) => pattern.test(normalized))

    if (match) {
      context.report({
        node,
        message: `${match.message} Consulte os guias em docs/design-system/tokens.md para escolher o token correto.`,
      })
    }
  }
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Impede o uso de classes Tailwind com cores hardcoded (`text-slate-*`, `bg-white/...`, `border-white/...`).',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowlist: {
            type: 'array',
            items: { type: 'string' },
          },
          allowlistPath: {
            type: 'string',
          },
          baseDir: {
            type: 'string',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {}
    const allowlistMatchers = loadAllowlist(options, context)
    const baseDir = resolveBaseDir(options, context)

    return {
      Literal(node) {
        if (typeof node.value !== 'string') {
          return
        }

        checkValue(context, node, node.value, allowlistMatchers, baseDir)
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (typeof quasi.value.cooked === 'string') {
            checkValue(context, node, quasi.value.cooked, allowlistMatchers, baseDir)
          }
        }
      },
    }
  },
}
