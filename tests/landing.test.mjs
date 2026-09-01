import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8')
const favicon = readFileSync(new URL('../assets/favicon.png', import.meta.url))
const bookingUrl = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2EZbkSfAAHaHis-QxOTnS3ca11N6290qr_glH9MJ1WR8RJ7M6kccGXflEpKw9u18SgO9oLuZKJ'
const googlePlayUrl = 'https://play.google.com/store/apps/details?id=com.farmia.mobile'
const appStoreUrl = 'https://apps.apple.com/ar/app/farmia/id6796829180'

test('presents the approved time-first positioning in the hero', () => {
  assert.match(html, /La plataforma integral para el agro/)
  assert.match(html, /Menos tiempo buscando datos\. Más tiempo tomando decisiones\./)
  assert.match(html, /información técnica, productiva, operativa y económica en un solo lugar/)
  assert.match(html, /usa IA para escalar el análisis de toda tu empresa agropecuaria/)
})

test('keeps commercial actions separate from the app utility', () => {
  const bookingLinks = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>\s*(?:Agendar una demo|Elegir día y horario)\s*<\/a>/g)]
  assert.equal(bookingLinks.length, 4)
  assert.ok(bookingLinks.every(([, href]) => href === bookingUrl))
  assert.ok(bookingLinks.every(([link]) => /target="_blank"/.test(link) && /rel="noopener noreferrer"/.test(link)))
  assert.match(html, /https:\/\/wa\.me\/5491156592528\?text=/)
  assert.match(html, /class="[^"]*button--app[^"]*"[^>]*href="https:\/\/app\.farmiasolutions\.com"[^>]*>\s*Ir a la app\s*</)
  assert.doesNotMatch(html, />\s*Iniciar sesión\s*</)
})

test('offers direct scheduling first and keeps Formspree as a contact fallback', () => {
  const demoSection = html.match(/<section[^>]*id="demo"[\s\S]*?<\/section>/)?.[0] ?? ''

  assert.match(demoSection, /Elegí un día y horario/)
  assert.match(demoSection, /Lunes a viernes, de 8 a 17 h/)
  assert.match(demoSection, /Reuniones de 30 minutos/)
  assert.match(demoSection, new RegExp(`href="${bookingUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.match(demoSection, /¿Preferís que te contactemos\?/)
  assert.match(demoSection, /type="submit">Solicitar contacto<\/button>/)
  assert.doesNotMatch(demoSection, /type="submit">Agendar una demo<\/button>/)
})

test('contains the approved navigation and strategic sections', () => {
  for (const href of ['#plataforma', '#como-ayuda', '#modulos', '#clientes']) {
    assert.match(html, new RegExp(`href="${href}"`))
  }

  for (const id of ['plataforma', 'como-ayuda', 'modulos', 'inteligencia', 'equipo', 'clientes', 'demo', 'preguntas-frecuentes']) {
    assert.match(html, new RegExp(`id="${id}"`))
  }

  assert.match(html, /Todo en un solo lugar/)
  assert.match(html, /Asistencia con IA, decisión agronómica/)
  assert.match(html, /Productor, asesor y dirección/)
  assert.match(html, /href="#modulos"[^>]*>Módulos</)
  assert.doesNotMatch(html, />Ver todos los módulos</)
})

test('turns the value story into one concrete end-to-end agronomic journey', () => {
  const journeySection = html.match(/<section[^>]*id="como-ayuda"[\s\S]*?<\/section>/)?.[0] ?? ''
  const orderedModuleLinks = [
    '/modulos/imagenes-satelitales/',
    '/modulos/monitoreo/',
    '/modulos/prescripciones/',
    '/modulos/analisis-gis/',
  ]

  assert.match(journeySection, /De una señal en el lote a una decisión con contexto\./)
  assert.equal((journeySection.match(/class="journey-step reveal"/g) || []).length, 4)
  assert.equal((journeySection.match(/data-image-zoom/g) || []).length, 4)
  assert.match(journeySection, /Imágenes satelitales/)
  assert.match(journeySection, /nota georreferenciada/)
  assert.match(journeySection, /prescripción/)
  assert.match(journeySection, /esperado con el resultado real/)

  let previousPosition = -1
  for (const href of orderedModuleLinks) {
    const position = journeySection.indexOf(`href="${href}"`)
    assert.ok(position > previousPosition, `${href} should continue the journey in order`)
    previousPosition = position
  }
})

test('explains a three-step onboarding path immediately before the demo', () => {
  const startSection = html.match(/<section[^>]*id="como-empezamos"[\s\S]*?<\/section>/)?.[0] ?? ''
  const clientsPosition = html.indexOf('id="clientes"')
  const startPosition = html.indexOf('id="como-empezamos"')
  const demoPosition = html.indexOf('id="demo"')

  assert.match(startSection, /Empezar es simple\./)
  assert.equal((startSection.match(/class="start-step"/g) || []).length, 3)
  assert.match(startSection, /reunión de 30 minutos/)
  assert.match(startSection, /Priorizamos módulos e información/)
  assert.match(startSection, /Acompañamos la puesta en marcha/)
  assert.match(startSection, new RegExp(`href="${bookingUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.ok(clientsPosition < startPosition && startPosition < demoPosition)
})

test('uses the official FarmIA identity and avoids presenting Farmi', () => {
  assert.match(html, /assets\/logo-farmia-wordmark-official\.png/)
  assert.doesNotMatch(html, /class="brand__word"/)
  assert.doesNotMatch(html, /\bFarmi\b/i)
})

test('frames artificial intelligence as assistance under agronomic judgment', () => {
  assert.match(html, /FarmIA te ayuda a encontrar qué revisar/)
  assert.match(html, /El criterio sigue siendo humano\./)
  assert.match(html, /Datos y capas/)
  assert.match(html, /Hallazgos sugeridos/)
  assert.match(html, /Revisión y decisión del equipo/)
  assert.match(html, /El agrónomo decide/)
  assert.doesNotMatch(html, /La IA analiza/)
  assert.doesNotMatch(html, /procesa un volumen de información que sería costoso revisar manualmente/)
})

test('offers eight direct module journeys without adding a catalog detour', () => {
  const modulesSection = html.match(/<section[^>]*id="modulos"[\s\S]*?<\/section>/)?.[0] ?? ''
  const moduleLinks = [
    'analisis-gis',
    'imagenes-satelitales',
    'agroclima',
    'prescripciones',
    'monitoreo',
    'balance-suelo',
    'muestreo-suelo',
    'gestion',
  ]

  assert.match(modulesSection, /Ocho módulos/)
  assert.match(modulesSection, /mismo contexto del lote/)
  for (const slug of moduleLinks) {
    assert.equal((modulesSection.match(new RegExp(`href="/modulos/${slug}/"`, 'g')) || []).length, 1)
  }
  assert.equal((modulesSection.match(/class="home-module-card reveal"/g) || []).length, 8)
  assert.doesNotMatch(modulesSection, /href="\/modulos\/"/)

  assert.doesNotMatch(html, /id="precios"/)
  assert.doesNotMatch(html, /id="roadmap"/)
  assert.doesNotMatch(html, /Análisis financiero por ambiente/)
})

test('publishes only approved trust signals and omits the legal entity name', () => {
  assert.match(html, /\+400\.000 ha centralizadas en FarmIA/)
  assert.doesNotMatch(html, /\+120\.000 ha/)
  assert.match(html, /D[‑-]U[‑-]N[‑-]S[^0-9]*352223533/)
  assert.doesNotMatch(html, /CACICU 26/i)
})

test('shows the approved clients once to assistive technology inside a seamless visual marquee', () => {
  const clientsSection = html.match(/<section[^>]*id="clientes"[\s\S]*?<\/section>/)?.[0] ?? ''
  const clients = [
    ['Bayer', 'bayer'],
    ['Sound Agriculture', 'sound-agriculture'],
    ['El Criterio', 'el-criterio'],
    ['FarmiOS', 'farmios'],
    ['MC Agroservicios', 'mc-agroservicios'],
    ['Agronasaja', 'agronasaja'],
    ['Surgenza', 'surgenza'],
  ]

  assert.match(clientsSection, /Empresas que ya trabajan con FarmIA/)
  assert.match(clientsSection, /class="clients-marquee"/)
  assert.equal((clientsSection.match(/class="clients-marquee__list"/g) || []).length, 2)
  assert.equal((clientsSection.match(/class="clients-marquee__list" aria-hidden="true"/g) || []).length, 1)
  assert.equal((clientsSection.match(/class="client-logo"/g) || []).length, clients.length * 2)
  assert.doesNotMatch(clientsSection, /loading="lazy"/)
  for (const [name, asset] of clients) {
    assert.equal((clientsSection.match(new RegExp(`alt="${name}"`, 'g')) || []).length, 1)
    assert.equal((clientsSection.match(new RegExp(`assets/clients/mono/${asset}\\.webp`, 'g')) || []).length, 2)
    assert.equal(existsSync(new URL(`../assets/clients/mono/${asset}.webp`, import.meta.url)), true, `${name} monochrome logo should exist`)
  }
})

test('keeps the client marquee calm, pausable, and static when reduced motion is requested', () => {
  assert.match(css, /@keyframes\s+clients-marquee-scroll/)
  assert.match(css, /\.clients-marquee:hover\s+\.clients-marquee__track[\s\S]*?animation-play-state:\s*paused/)
  assert.match(css, /\.clients-marquee:focus-within\s+\.clients-marquee__track[\s\S]*?animation-play-state:\s*paused/)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.clients-marquee__track\s*\{[\s\S]*?animation:\s*none/)
})

test('finishes the commercial journey with accessible frequently asked questions', () => {
  const faqSection = html.match(/<section[^>]*id="preguntas-frecuentes"[\s\S]*?<\/section>/)?.[0] ?? ''
  assert.match(faqSection, /Preguntas frecuentes/)
  assert.equal((faqSection.match(/<details/g) || []).length, 6)
  assert.equal((faqSection.match(/<summary/g) || []).length, 6)
  assert.match(faqSection, /¿FarmIA reemplaza el criterio del agrónomo\?/)
  assert.match(faqSection, /¿FarmIA funciona desde el celular y en el campo\?/)
})

test('uses the official FarmIA icon as the browser favicon', () => {
  assert.match(html, /<link rel="icon" type="image\/png" href="assets\/favicon\.png\?v=20260901-1">/)
  assert.equal(existsSync(new URL('../assets/favicon.png', import.meta.url)), true)
  assert.equal(favicon.readUInt32BE(16), 500)
  assert.equal(favicon.readUInt32BE(20), 500)
})

test('offers both mobile stores in a clear customer-only download block', () => {
  const downloadBlock = html.match(/<aside[^>]*class="[^"]*mobile-download[^"]*"[\s\S]*?<\/aside>/)?.[0] ?? ''

  assert.match(downloadBlock, /Llevá FarmIA al campo/)
  assert.match(downloadBlock, /App complementaria para clientes de FarmIA/)
  assert.ok(downloadBlock.indexOf(appStoreUrl) < downloadBlock.indexOf(googlePlayUrl), 'App Store should appear first in the badge lineup')
  assert.ok(downloadBlock.includes(`href="${appStoreUrl}" target="_blank" rel="noopener noreferrer"`))
  assert.ok(downloadBlock.includes(`href="${googlePlayUrl}" target="_blank" rel="noopener noreferrer"`))
  assert.match(downloadBlock, /src="assets\/store\/app-store-badge-es\.svg"[^>]*alt="Descargar FarmIA en App Store"/)
  assert.match(downloadBlock, /src="assets\/store\/google-play-badge-es\.png"[^>]*alt="Descargar FarmIA en Google Play"/)
  assert.equal(existsSync(new URL('../assets/store/app-store-badge-es.svg', import.meta.url)), true)
  assert.equal(existsSync(new URL('../assets/store/google-play-badge-es.png', import.meta.url)), true)
})

test('keeps the existing Formspree integration with accessible feedback', () => {
  assert.match(html, /<form[^>]*class="[^"]*demo-form[^"]*"[^>]*action="https:\/\/formspree\.io\/f\/maqbggyl"/)
  assert.match(html, /name="name"[^>]*required/)
  assert.match(html, /name="company"/)
  assert.match(html, /name="email"[^>]*required/)
  assert.match(html, /name="phone"/)
  assert.match(html, /name="message"/)
  assert.match(html, /name="module_interest"/)
  assert.match(html, /class="form-status"[^>]*role="status"[^>]*aria-live="polite"/)
})

test('carries the requested module into the demo form', () => {
  assert.match(script, /moduleInterest\.value\s*=\s*requestedModule/)

  class FakeClassList {
    add() {}
    remove() {}
    toggle() {}
    contains() { return false }
  }

  class FakeElement {
    constructor() {
      this.classList = new FakeClassList()
      this.listeners = new Map()
      this.offsetHeight = 76
      this.value = ''
    }

    addEventListener(type, listener) { this.listeners.set(type, listener) }
    setAttribute(name, value) {
      if (name === 'value') this.value = value
    }
    getAttribute() { return null }
    contains() { return false }
    querySelector(selector) {
      if (selector === '[name="module_interest"]') return this.moduleInterest
      return null
    }
  }

  const form = new FakeElement()
  form.moduleInterest = new FakeElement()
  const document = {
    body: new FakeElement(),
    documentElement: new FakeElement(),
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.demo-form') return form
      return null
    },
    querySelectorAll() { return [] },
  }
  const window = {
    addEventListener() {},
    history: { pushState() {} },
    location: { hash: '', search: '?modulo=imagenes-satelitales' },
    matchMedia() { return { matches: true, addEventListener() {} } },
    scrollTo() {},
    scrollY: 0,
  }

  runInNewContext(script, { document, window, URLSearchParams })

  assert.equal(form.moduleInterest.value, 'imagenes-satelitales')
})

test('submits the module interest and exposes intercepted success and error states', async () => {
  class FakeClassList {
    add() {}
    remove() {}
    toggle() {}
    contains() { return false }
  }

  class FakeElement {
    constructor() {
      this.classList = new FakeClassList()
      this.listeners = new Map()
      this.offsetHeight = 76
      this.value = ''
      this.textContent = ''
      this.disabled = false
    }

    addEventListener(type, listener) { this.listeners.set(type, listener) }
    setAttribute(name, value) {
      if (name === 'value') this.value = value
    }
    removeAttribute() {}
    getAttribute() { return null }
    contains() { return false }
    checkValidity() { return true }
    reportValidity() {}
    reset() { this.wasReset = true }
    querySelector(selector) {
      if (selector === '[name="module_interest"]') return this.moduleInterest
      if (selector === '.form-status') return this.status
      if (selector === 'button[type="submit"]') return this.submitButton
      return null
    }
  }

  const makeHarness = (fetchResponse) => {
    const form = new FakeElement()
    form.action = 'https://formspree.io/f/maqbggyl'
    form.moduleInterest = new FakeElement()
    form.status = new FakeElement()
    form.submitButton = new FakeElement()
    form.submitButton.textContent = 'Agendar una demo'

    const document = {
      body: new FakeElement(),
      documentElement: new FakeElement(),
      addEventListener() {},
      querySelector(selector) {
        if (selector === '.demo-form') return form
        return null
      },
      querySelectorAll() { return [] },
    }
    const window = {
      addEventListener() {},
      history: { pushState() {} },
      location: { hash: '', search: '?modulo=gestion' },
      matchMedia() { return { matches: true, addEventListener() {} } },
      scrollTo() {},
      scrollY: 0,
    }
    const calls = []
    class FakeFormData {
      constructor(sourceForm) {
        this.moduleInterest = sourceForm.moduleInterest.value
      }
    }
    const fetch = async (...args) => {
      calls.push(args)
      return fetchResponse
    }

    runInNewContext(script, { document, window, URLSearchParams, FormData: FakeFormData, fetch })
    return { form, calls }
  }

  const success = makeHarness({ ok: true })
  await success.form.listeners.get('submit')({ preventDefault() {} })
  assert.equal(success.calls.length, 1)
  assert.equal(success.calls[0][0], 'https://formspree.io/f/maqbggyl')
  assert.equal(success.calls[0][1].body.moduleInterest, 'gestion')
  assert.equal(success.form.status.textContent, 'Recibimos tu solicitud. Te vamos a contactar para coordinar la demo.')
  assert.equal(success.form.wasReset, true)

  const failure = makeHarness({ ok: false })
  await failure.form.listeners.get('submit')({ preventDefault() {} })
  assert.equal(failure.calls.length, 1)
  assert.equal(failure.form.status.textContent, 'No pudimos enviar la solicitud. Podés intentar de nuevo o escribirnos por WhatsApp.')
  assert.equal(failure.form.submitButton.disabled, false)
})

test('uses approved real product views for every product story and removes obsolete captures', () => {
  const productImages = [
    'assets/product/home-campo-ndvi-focus.webp',
    'assets/product/comparativa-4-mapas-cargados.webp',
    'assets/product/mobile-3b-ndvi-real.webp',
  ]

  for (const image of productImages) {
    assert.match(html, new RegExp(image.replaceAll('/', '\\/')))
    assert.equal(existsSync(new URL(`../${image}`, import.meta.url)), true, `${image} should exist`)
  }

  assert.doesNotMatch(html, /pato[- ]7[- ]8/i)
  assert.match(html, /Vista de campo real en FarmIA con NDVI cargado en sus lotes/)
  assert.match(html, /cuatro mapas completamente cargados/)
  assert.doesNotMatch(html, /class="product-map-grid"/)
  assert.match(html, /Un lote · Toda la información y las herramientas/)
  assert.match(html, /Comparativa real A · B · C · D con lectura asistida/)
  assert.match(html, /product-phone product-phone--readable/)
  assert.match(html, /Vista real de FarmIA Mobile mostrando el NDVI del lote 3B/)
  assert.doesNotMatch(html, /assets\/product\/mobile-don-julio-ndvi-real\.webp/)
  assert.doesNotMatch(html, /assets\/product\/mobile-nota-georreferenciada-real\.webp/)
  assert.doesNotMatch(html, /assets\/product\/mobile-lote-ndvi-real\.webp/)
  assert.doesNotMatch(html, /assets\/product\/mobile-ndvi\.webp/)
  assert.doesNotMatch(html, /assets\/product\/hero-farmi\.webp/)
  assert.doesNotMatch(html, /assets\/product\/ai-insights\.webp/)

  for (const obsoleteImage of [
    'pato-7-8-cosecha-rangos.webp',
    'pato-7-8-fosforo-prescripcion.webp',
    'pato-7-8-fosforo-trabajo.webp',
    'pato-7-8-rendimiento-ambiente.webp',
    'mobile-ndvi.webp',
    'mobile-lote-ndvi-real.webp',
  ]) {
    assert.equal(
      existsSync(new URL(`../assets/product/${obsoleteImage}`, import.meta.url)),
      false,
      `${obsoleteImage} should not remain in the landing assets`,
    )
  }
})

test('makes every product capture on the landing openable in the shared image viewer', () => {
  assert.equal((html.match(/data-image-zoom/g) || []).length, 7)
  assert.equal((html.match(/class="image-lightbox"/g) || []).length, 1)
})

test('opens a product capture at full size and returns focus when the viewer closes', () => {
  class FakeClassList {
    constructor() { this.values = new Set() }
    add(...names) { names.forEach((name) => this.values.add(name)) }
    remove(...names) { names.forEach((name) => this.values.delete(name)) }
    toggle(name, force) {
      const shouldAdd = force === undefined ? !this.values.has(name) : force
      if (shouldAdd) this.add(name)
      else this.remove(name)
      return shouldAdd
    }
    contains(name) { return this.values.has(name) }
  }

  class FakeElement {
    constructor() {
      this.classList = new FakeClassList()
      this.attributes = new Map()
      this.listeners = new Map()
      this.offsetHeight = 76
      this.textContent = ''
    }
    addEventListener(type, listener) { this.listeners.set(type, listener) }
    setAttribute(name, value) { this.attributes.set(name, value) }
    getAttribute(name) { return this.attributes.get(name) ?? null }
    contains() { return false }
    focus() { this.wasFocused = true }
  }

  const sourceImage = new FakeElement()
  sourceImage.src = 'http://localhost:4173/assets/product/modules/test.webp'
  sourceImage.currentSrc = sourceImage.src
  sourceImage.alt = 'Mapa agronómico ampliado'

  const zoomTrigger = new FakeElement()
  zoomTrigger.querySelector = (selector) => selector === 'img' ? sourceImage : null

  const lightboxImage = new FakeElement()
  const lightboxCaption = new FakeElement()
  const closeButton = new FakeElement()
  const lightbox = new FakeElement()
  lightbox.open = false
  lightbox.querySelector = (selector) => ({
    '.image-lightbox__image': lightboxImage,
    '.image-lightbox__caption': lightboxCaption,
    '.image-lightbox__close': closeButton,
  })[selector] ?? null
  lightbox.showModal = () => { lightbox.open = true }
  lightbox.close = () => {
    lightbox.open = false
    lightbox.listeners.get('close')?.()
  }

  const body = new FakeElement()
  const document = {
    body,
    documentElement: new FakeElement(),
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.image-lightbox') return lightbox
      return null
    },
    querySelectorAll(selector) {
      if (selector === '[data-image-zoom]') return [zoomTrigger]
      return []
    },
  }
  const window = {
    addEventListener() {},
    history: { pushState() {} },
    location: { hash: '', search: '' },
    matchMedia() { return { matches: true, addEventListener() {} } },
    scrollTo() {},
    scrollY: 0,
  }

  runInNewContext(script, { document, window, URLSearchParams })
  zoomTrigger.listeners.get('click')({ preventDefault() {} })

  assert.equal(lightbox.open, true)
  assert.equal(lightboxImage.src, sourceImage.src)
  assert.equal(lightboxImage.alt, sourceImage.alt)
  assert.equal(lightboxCaption.textContent, sourceImage.alt)
  assert.equal(body.classList.contains('lightbox-open'), true)

  closeButton.listeners.get('click')()

  assert.equal(lightbox.open, false)
  assert.equal(body.classList.contains('lightbox-open'), false)
  assert.equal(zoomTrigger.wasFocused, true)
})

test('keeps prescriptions and monitoring discoverable as distinct connected modules', () => {
  assert.match(html, /Prescripciones y ambientación/)
  assert.match(html, /Monitoreo y app móvil/)
  assert.match(html, /Del diagnóstico a una receta variable/)
  assert.match(html, /Observaciones georreferenciadas/)
})

test('uses FarmIA design tokens and responsive accessibility safeguards', () => {
  assert.match(css, /--farmia-primary:\s*#1a9850/i)
  assert.match(css, /font-family:\s*['"]?Roboto/i)
  assert.match(css, /@media\s*\(max-width:\s*768px\)/)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  assert.match(css, /:focus-visible/)
})

test('implements menu, smooth anchors, and resilient async form states', () => {
  assert.match(script, /aria-expanded/)
  assert.match(script, /scrollTo/)
  assert.match(script, /new FormData/)
  assert.match(script, /fetch\(/)
  assert.match(script, /aria-busy/)
  assert.match(script, /is-success/)
  assert.match(script, /is-error/)
})

test('links to the existing public privacy policy', () => {
  assert.match(html, /https:\/\/app\.farmiasolutions\.com\/privacidad/)
})

test('releases the mobile scroll lock when navigation returns to desktop', () => {
  class FakeClassList {
    constructor() {
      this.values = new Set()
    }

    add(...names) {
      names.forEach((name) => this.values.add(name))
    }

    remove(...names) {
      names.forEach((name) => this.values.delete(name))
    }

    contains(name) {
      return this.values.has(name)
    }

    toggle(name, force) {
      const shouldAdd = force === undefined ? !this.contains(name) : force
      if (shouldAdd) this.add(name)
      else this.remove(name)
      return shouldAdd
    }
  }

  class FakeElement {
    constructor() {
      this.classList = new FakeClassList()
      this.attributes = new Map()
      this.listeners = new Map()
      this.offsetHeight = 76
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener)
    }

    setAttribute(name, value) {
      this.attributes.set(name, value)
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null
    }

    contains() {
      return false
    }
  }

  const navToggle = new FakeElement()
  const nav = new FakeElement()
  const body = new FakeElement()
  const mediaQueries = new Map()

  function getMediaQuery(query) {
    if (!mediaQueries.has(query)) {
      const listeners = []
      mediaQueries.set(query, {
        matches: false,
        addEventListener(type, listener) {
          if (type === 'change') listeners.push(listener)
        },
        dispatch(matches) {
          this.matches = matches
          listeners.forEach((listener) => listener({ matches }))
        },
      })
    }
    return mediaQueries.get(query)
  }

  const document = {
    body,
    documentElement: new FakeElement(),
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.site-header') return new FakeElement()
      if (selector === '.nav-toggle') return navToggle
      if (selector === '.site-nav') return nav
      return null
    },
    querySelectorAll() {
      return []
    },
  }

  const window = {
    addEventListener() {},
    history: { pushState() {} },
    location: { hash: '' },
    matchMedia: getMediaQuery,
    scrollTo() {},
    scrollY: 0,
  }

  runInNewContext(script, { document, window })
  navToggle.listeners.get('click')()

  assert.equal(body.classList.contains('menu-open'), true)

  getMediaQuery('(min-width: 961px)').dispatch(true)

  assert.equal(body.classList.contains('menu-open'), false)
  assert.equal(nav.classList.contains('is-open'), false)
  assert.equal(navToggle.getAttribute('aria-expanded'), 'false')
})
