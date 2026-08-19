import { rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const frontendRoot = resolve(projectRoot, 'custom_components', 'vue_panel', 'frontend')
const engineRoot = resolve(frontendRoot, 'engine')

if (dirname(engineRoot) !== frontendRoot || basename(engineRoot) !== 'engine') {
  throw new Error(`Refusing to clean unexpected engine directory: ${engineRoot}`)
}

await rm(engineRoot, { recursive: true, force: true })
console.log(`Cleaned ${engineRoot}`)
