import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_PORTS = [3000, 3001]

function killPort(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (!out) return
    for (const pid of out.split('\n').filter(Boolean)) {
      try {
        process.kill(Number(pid), 'SIGKILL')
      } catch {
        // process may already be gone
      }
    }
  } catch {
    // no listener on port
  }
}

for (const port of DEV_PORTS) {
  killPort(port)
}

rmSync(join(root, '.next'), { recursive: true, force: true })
console.log('Stopped dev servers on :3000/:3001 and removed .next')
