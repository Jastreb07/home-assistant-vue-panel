import fs from 'node:fs'
const doc = fs.readFileSync('custom_components/vue_panel/bundled_cards/vue-panel/light-detail.html','utf8')
const html = doc.match(/<template data-vue-panel-html>([\s\S]*?)<\/template>/)[1]
const script = doc.match(/<script data-vue-panel-javascript>([\s\S]*?)<\/script>/)[1]
const translations = new Function(`${doc.match(/<script data-vue-panel-translation>([\s\S]*?)<\/script>/)[1]}; return vuePanelTranslations`)()
const cardScript = new Function('vuePanel','document','window',`return (async () => {${script}})()`)
let now = 0; const timers = new Map(); let next = 1
const realSetTimeout = globalThis.setTimeout
globalThis.setTimeout = (h, d) => { const id = next++; timers.set(id, {h, at: now + (d||0)}); return id }
globalThis.clearTimeout = id => timers.delete(id)
const advance = ms => { now += ms; for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.h() } }
function element(tag, attrs = {}) {
  const node = {tagName: tag, children: [], attrs: {...attrs}, dataset: {}, hidden: false, disabled: false,
    parentElement: null, classes: new Set((attrs.class||'').split(/\s+/).filter(Boolean)), handlers: new Map(),
    scrollWidth: 40, clientWidth: 80,
    style: new Proxy({}, {get:(t,k)=> k==='setProperty'?(n,v)=>t[n]=v: k==='removeProperty'?n=>delete t[n]:t[k], set:(t,k,v)=>((t[k]=v),true)}),
    get textContent(){return node.children.map(c=>c.textContent??'').join('')},
    set textContent(v){node.children=[]; if(v) node.children.push({textContent:String(v)})},
    setAttribute(n,v){node.attrs[n]=String(v); if(n==='class') node.classes=new Set(String(v).split(/\s+/).filter(Boolean))},
    getAttribute:n=>node.attrs[n]??null,
    appendChild(c){c.parentElement=node; node.children.push(c); return c},
    append(...i){for(const x of i) node.appendChild(x)},
    addEventListener(t,h){node.handlers.set(t,[...(node.handlers.get(t)||[]),h])},
    removeEventListener(){}, setPointerCapture(){}, focus(){},
    querySelector:()=>null, querySelectorAll:()=>[], closest:()=>node.closestStub??null,
    getBoundingClientRect:()=>({top:100,left:50,width:360,height:300}), getTotalLength:()=>600,
    classList:{add:(...n)=>n.forEach(x=>node.classes.add(x)), remove:(...n)=>n.forEach(x=>node.classes.delete(x)),
      contains:n=>node.classes.has(n), toggle:(n,f)=>{const on=f===undefined?!node.classes.has(n):Boolean(f); on?node.classes.add(n):node.classes.delete(n); return on}}}
  return node
}
const nodes = new Map()
for (const [tag, id] of html.matchAll(/<[a-z]+[^>]*\sid="([^"]+)"[^>]*>/g)) {
  const n = element('div'); n.hidden = /\shidden(\s|>|\/)/.test(tag); nodes.set(id, n)
}
const modeButtons = ['brightness','colorTemp','color'].map(mode => {
  const b = element('button', {class:'control'}); b.dataset.mode = mode
  const l = element('span', {class:'label'}); l.dataset.label = mode
  b.querySelector = s => s === '[data-label]' ? l : null; b.closestStub = b; return b
})
const modeIcons = ['mdi:brightness-6','mdi:thermometer','mdi:palette'].map(i => { const im = element('img'); im.dataset.icon = i; return im })
nodes.get('controls').querySelectorAll = s => s === '[data-mode]' ? modeButtons : s === '[data-icon]' ? modeIcons : []
nodes.get('brightness-trigger').closestStub = modeButtons[0]
nodes.get('kelvin-trigger').closestStub = modeButtons[1]
const documentHandlers = new Map()
const documentStub = {getElementById: id => nodes.get(id) ?? null, createElement: element,
  createElementNS: (_n, tag) => element(tag),
  addEventListener: (t, h) => documentHandlers.set(t, [...(documentHandlers.get(t)||[]), h]),
  removeEventListener: () => {}}
const entity = {state:'on', attributes:{supported_color_modes:['color_temp','hs'], brightness:191,
  color_temp_kelvin:3000, min_color_temp_kelvin:2000, max_color_temp_kelvin:6500, hs_color:[30,80],
  effect_list:['A','B','C'], effect:'A'}}
await cardScript({config:{entity:'light.x'}, context:{}, language:'de', area:'dialog',
  t:k=>translations.languages.de[k]??k, getIcon:async()=> 'icon', getEntity:async()=>entity,
  subscribeEntity:()=>{}, callService:async()=>{}}, documentStub, {addEventListener:()=>{}, removeEventListener:()=>{}})
const fire = (node, type, ev = {}) => {
  let stopped = false
  const event = {stopPropagation(){stopped = true}, preventDefault(){}, button:0, target: node, ...ev}
  for (const h of node.handlers.get(type)||[]) h(event)
  return stopped
}
fire(nodes.get('brightness-trigger'), 'pointerdown')
advance(600)
console.log('nach hold  :', nodes.get('brightness-menu').hidden ? 'zu' : 'offen')
fire(nodes.get('brightness-trigger'), 'pointerup')
console.log('nach up    :', nodes.get('brightness-menu').hidden ? 'zu' : 'offen')
const stopped = fire(modeButtons[0], 'click', {target: modeButtons[0]})
console.log('nach click :', nodes.get('brightness-menu').hidden ? 'zu' : 'offen', '| propagation gestoppt:', stopped)
if (!stopped) {
  for (const h of documentHandlers.get('click')||[]) h({target: {closest: sel => sel.includes('.control') ? modeButtons[0] : null}})
  console.log('nach doc   :', nodes.get('brightness-menu').hidden ? 'zu' : 'offen')
}
globalThis.setTimeout = realSetTimeout
