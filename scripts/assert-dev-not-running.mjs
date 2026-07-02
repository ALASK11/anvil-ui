import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const DEV_PORTS = [3000, 3001]

// Local-dev guard only — skip in CI and Docker builds (Cloud Build false-positives on lsof).
const ci = process.env.CI
if (ci === 'true' || ci === '1' || existsSync('/.dockerenv')) {
  process.exit(0)
}

function pidsOnPort(port) {
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (!out) return []
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

const busy = DEV_PORTS.flatMap((port) =>
  pidsOnPort(port).map((pid) => ({ port, pid })),
)

if (busy.length > 0) {
  const lines = busy.map(({ port, pid }) => `  port ${port} (pid ${pid})`).join('\n')
  console.error(
    'next dev is still running:\n' +
      lines +
      '\n\nStop it before npm run build (use npm run dev:clean to restart cleanly).',
  )
  process.exit(1)
}
