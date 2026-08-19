/**
 * Minimal Home Assistant stand-in for local engine verification.
 *
 * Serves the built integration frontend, a loader harness that supplies the
 * `vue-panel:auth` context, and a WebSocket endpoint that answers the Vue
 * Panel commands from the real card and dashboard files on disk. It exists so
 * the engine can be rendered end to end without touching a live instance.
 *
 * Usage: node scripts/dev-mock-ha.mjs [port]
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.argv[2] || 5202)
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FRONTEND = path.join(ROOT, 'custom_components', 'vue_panel', 'frontend')
const CARDS = path.join(ROOT, 'custom_components', 'vue_panel', 'bundled_cards')
const DASHBOARD_FILE = process.env.VUE_PANEL_MOCK_DASHBOARD || ''

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml', '.png': 'image/png',
}
const CARD_PATTERN = /^\s*<script\s+data-vue-panel-config>\s*([\s\S]*?)\s*<\/script>\s*<template\s+data-vue-panel-html>([\s\S]*?)<\/template>\s*<style\s+data-vue-panel-css>([\s\S]*?)<\/style>\s*<script\s+data-vue-panel-javascript>([\s\S]*?)<\/script>\s*$/
const CONFIG_PATTERN = /^\s*const\s+vuePanelCard\s*=\s*(\{[\s\S]*\})\s*;\s*$/

function readCards() {
  const catalog = []
  for (const manufacturer of fs.readdirSync(CARDS)) {
    for (const file of fs.readdirSync(path.join(CARDS, manufacturer))) {
      const document = fs.readFileSync(path.join(CARDS, manufacturer, file), 'utf8')
      const parts = CARD_PATTERN.exec(document)
      if (!parts) throw new Error(`Card ${manufacturer}/${file} has an invalid structure`)
      const metadata = JSON.parse(CONFIG_PATTERN.exec(parts[1])[1])
      catalog.push({
        ...metadata,
        type: `${metadata.manufacturer}/${metadata.cardName}`,
        source: 'bundled',
        writable: false,
        contentHash: createHash('sha256').update(document).digest('hex'),
        resourceUrl: `vue-panel-card://${metadata.manufacturer}/${metadata.cardName}`,
        sizeBytes: Buffer.byteLength(document),
        document,
        html: parts[2].replace(/^\n/, '').replace(/\n$/, ''),
        css: parts[3].replace(/^\n/, '').replace(/\n$/, ''),
        javascript: parts[4].replace(/^\n/, '').replace(/\n$/, ''),
      })
    }
  }
  return catalog
}

function defaultDashboard() {
  if (DASHBOARD_FILE) return JSON.parse(fs.readFileSync(DASHBOARD_FILE, 'utf8'))
  return {
    format: 'vue-panel-dashboard',
    formatVersion: 1,
    revision: 1,
    settings: { theme: 'dark', uiTheme: 'default', screensaverMinutes: 0, autoReturnSeconds: 0 },
    bars: {
      sidebar: {
        id: 'bar-sidebar',
        size: 280,
        centerAlign: { vertical: 'start', horizontal: 'stretch' },
        slots: {
          start: [],
          center: [{ id: 'bar-sidebar-nav', type: 'vue-panel/sidebar-bar', config: {} }],
          end: [],
        },
      },
      header: {
        id: 'bar-header',
        size: 64,
        placement: 'view',
        centerAlign: { vertical: 'center', horizontal: 'center' },
        slots: {
          start: [{ id: 'bar-header-clock', type: 'vue-panel/clock', config: {} }],
          center: [{ id: 'bar-header-nav', type: 'vue-panel/header-bar', config: {} }],
          end: [],
        },
      },
      bottom: {
        id: 'bar-bottom',
        size: 64,
        placement: 'view',
        centerAlign: { vertical: 'center', horizontal: 'center' },
        slots: {
          start: [],
          center: [{ id: 'bar-bottom-nav', type: 'vue-panel/bottom-bar', config: {} }],
          end: [],
        },
      },
    },
    views: [
      {
        id: 'overview', title: 'Übersicht', icon: 'mdi:home', path: 'overview',
        layout: 'sections', showSidebar: true, showHeader: true, showBottom: true,
        sections: [{
          id: 'sec-main',
          cards: [{
            id: 'card-title',
            type: 'vue-panel/section-title',
            config: { title: 'Wohnzimmer', icon: 'mdi:sofa', align: 'left', rule: true },
            size: { cols: 1, rows: 1, width: 280, height: 40 },
          }],
        }],
      },
      {
        id: 'garden', title: 'Garten', icon: 'mdi:flower', path: 'garten',
        layout: 'sections', showSidebar: true, showHeader: true, showBottom: true,
        sections: [],
      },
    ],
  }
}

let dashboard = defaultDashboard()
const cards = readCards()

// ── WebSocket framing (server side only, no extensions) ──────
function accept(key) {
  return createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64')
}

function encode(text) {
  const payload = Buffer.from(text, 'utf8')
  const header = payload.length < 126
    ? Buffer.from([0x81, payload.length])
    : payload.length < 65536
      ? Buffer.concat([Buffer.from([0x81, 126]), (() => {
        const size = Buffer.alloc(2); size.writeUInt16BE(payload.length); return size
      })()])
      : Buffer.concat([Buffer.from([0x81, 127]), (() => {
        const size = Buffer.alloc(8); size.writeBigUInt64BE(BigInt(payload.length)); return size
      })()])
  return Buffer.concat([header, payload])
}

function* decode(buffer) {
  let offset = 0
  while (offset + 2 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f
    const masked = (buffer[offset + 1] & 0x80) !== 0
    let length = buffer[offset + 1] & 0x7f
    let cursor = offset + 2
    if (length === 126) { length = buffer.readUInt16BE(cursor); cursor += 2 }
    else if (length === 127) { length = Number(buffer.readBigUInt64BE(cursor)); cursor += 8 }
    const mask = masked ? buffer.subarray(cursor, cursor + 4) : null
    if (masked) cursor += 4
    if (cursor + length > buffer.length) return offset
    const payload = Buffer.from(buffer.subarray(cursor, cursor + length))
    if (mask) for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]
    offset = cursor + length
    if (opcode === 0x8) return -1
    if (opcode === 0x1) yield payload.toString('utf8')
  }
  return offset
}

function handleCommand(message) {
  const { id, type } = message
  const ok = (result) => ({ id, type: 'result', success: true, result })
  const fail = (code, text) => ({ id, type: 'result', success: false, error: { code, message: text } })

  if (type === 'subscribe_entities' || type === 'subscribe_events') return ok(null)
  if (type === 'get_states') return ok([])
  if (type === 'get_config') return ok({ location_name: 'Mock', version: '2026.8.0' })
  if (type === 'vue_panel/dashboard/get') return ok(dashboard)
  if (type === 'vue_panel/dashboard/save') {
    if (message.dashboard.revision !== dashboard.revision) {
      return fail('revision_conflict', 'Dashboard revision conflict')
    }
    dashboard = { ...message.dashboard, revision: dashboard.revision + 1 }
    console.log('[mock-ha] dashboard saved, revision', dashboard.revision)
    return ok({ revision: dashboard.revision })
  }
  if (type === 'vue_panel/cards/list') {
    return ok(cards.map(({ document, html, css, javascript, ...entry }) => entry))
  }
  if (type === 'vue_panel/cards/get') {
    const card = cards.find(
      (entry) => entry.manufacturer === message.manufacturer && entry.cardName === message.card_name,
    )
    return card ? ok(card) : fail('not_found', 'Card not found')
  }
  if (type === 'call_service') return ok({ context: { id: 'mock' } })
  return fail('unknown_command', `Unsupported command ${type}`)
}

const harness = (port) => `<!doctype html><html><head><meta charset="utf-8"><title>Vue Panel mock</title>
<style>html,body{margin:0;height:100%;background:#0c0e11}iframe{width:100%;height:100%;border:0;display:block}</style>
</head><body><iframe id="engine" src="/vue-panel-static/engine/index.html?ver=mock"></iframe>
<script>
const auth = {
  type: 'vue-panel:auth', hassUrl: 'http://127.0.0.1:${port}', access_token: 'mock-token',
  expires: Date.now() + 3600000, language: 'de', isAdmin: true,
  dashboardName: 'mock', engineVersion: 'mock', apiVersion: 1, narrow: false,
};
const frame = document.getElementById('engine');
const send = () => frame.contentWindow.postMessage(auth, location.origin);
frame.addEventListener('load', send);
addEventListener('message', (event) => {
  if (event.data?.type === 'vue-panel:request-context') send();
  if (event.data?.type === 'vue-panel:ready') console.log('[mock-ha] engine ready');
});
<\/script></body></html>`

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://mock')
  if (url.pathname === '/' || url.pathname === '/harness.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(harness(PORT))
    return
  }
  const file = path.join(FRONTEND, url.pathname.replace(/^\/vue-panel-static/, ''))
  if (!file.startsWith(FRONTEND) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  })
  response.end(fs.readFileSync(file))
})

server.on('upgrade', (request, socket) => {
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
    + `Sec-WebSocket-Accept: ${accept(request.headers['sec-websocket-key'])}\r\n\r\n`,
  )
  const send = (message) => socket.write(encode(JSON.stringify(message)))
  send({ type: 'auth_required', ha_version: '2026.8.0' })

  let buffered = Buffer.alloc(0)
  socket.on('data', (chunk) => {
    buffered = Buffer.concat([buffered, chunk])
    const frames = []
    const iterator = decode(buffered)
    let step = iterator.next()
    while (!step.done) { frames.push(step.value); step = iterator.next() }
    if (step.value === -1) { socket.end(); return }
    buffered = buffered.subarray(step.value)

    for (const frame of frames) {
      const message = JSON.parse(frame)
      if (message.type === 'auth') {
        send({ type: 'auth_ok', ha_version: '2026.8.0' })
        continue
      }
      send(handleCommand(message))
      if (message.type === 'subscribe_entities') {
        send({ id: message.id, type: 'event', event: { a: {} } })
      }
    }
  })
  socket.on('error', () => socket.destroy())
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-ha] ${cards.length} cards — http://127.0.0.1:${PORT}/`)
})
