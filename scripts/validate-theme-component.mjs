// Validates one runtime theme component module: syntax, factory shape and
// that its template string compiles. Usage:
//   node scripts/validate-theme-component.mjs <file.js> [...more files]
import { pathToFileURL } from 'node:url'
import { compile } from '@vue/compiler-dom'

function makeStub() {
  const target = function () {}
  const stub = new Proxy(target, {
    get(_t, prop) {
      if (prop === Symbol.iterator) return function* () {}
      if (prop === Symbol.toPrimitive) return () => ''
      return stub
    },
    apply: () => stub,
    construct: () => ({}),
  })
  return stub
}

let failed = false
for (const file of process.argv.slice(2)) {
  try {
    const mod = await import(pathToFileURL(file))
    if (typeof mod.default !== 'function') throw new Error('default export is not a factory function')
    const stub = makeStub()
    const options = mod.default({ vue: stub, useI18n: stub, components: stub, helpers: stub })
    if (!options || typeof options !== 'object') throw new Error('factory did not return component options')
    if (typeof options.template !== 'string' || !options.template.trim()) throw new Error('missing template string')
    compile(options.template, { onError(error) { throw error } })
    console.log(`OK    ${file}`)
  } catch (error) {
    failed = true
    console.error(`FAIL  ${file}: ${error && error.message ? error.message : error}`)
  }
}
process.exit(failed ? 1 : 0)
