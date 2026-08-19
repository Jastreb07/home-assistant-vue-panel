import { access, readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const engineDirectory = fileURLToPath(
  new URL('../custom_components/vue_panel/frontend/engine/', import.meta.url),
)
const assetsDirectory = fileURLToPath(
  new URL('../custom_components/vue_panel/frontend/engine/assets/', import.meta.url),
)
const indexPath = fileURLToPath(
  new URL('../custom_components/vue_panel/frontend/engine/index.html', import.meta.url),
)
await access(indexPath)

const engineFiles = await readdir(engineDirectory)
if (engineFiles.includes('panel.js')) {
  throw new Error('The iframe engine must not expose the former custom-element panel.js entry.')
}

const indexSource = await readFile(indexPath, 'utf8')
if (!indexSource.includes('/vue-panel-static/engine/assets/index-')) {
  throw new Error('The iframe engine HTML does not reference its hashed application entry.')
}
if (!/href="\/vue-panel-static\/engine\/assets\/[^"?]+-[^"?]+\.css"/.test(indexSource)) {
  throw new Error('The iframe engine HTML does not reference a hashed stylesheet.')
}

const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith('.js'))
const removedCoreChunks = [
  'ClockCard', 'CoverCard', 'LightCard', 'MediaCard', 'MenuCard', 'RoomTileCard',
  'SectionTitleCard', 'SensorCard', 'ThermostatCard', 'WeatherCard', 'BarCards',
]
if (files.some((file) => removedCoreChunks.some((name) => file.startsWith(name)))) {
  throw new Error('The engine build still contains legacy Vue core-card chunks.')
}
console.log(`Verified iframe engine HTML and ${files.length} hashed JavaScript chunks`)
