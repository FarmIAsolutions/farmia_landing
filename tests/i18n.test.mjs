import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import es from '../content/i18n/es.mjs'
import en from '../content/i18n/en.mjs'
import pt from '../content/i18n/pt.mjs'
import { moduleGroups, modules, site } from '../content/modules.mjs'
import { expectedFiles, homePage, renderTemplate } from '../scripts/generate-modules.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const generatorPath = join(root, 'scripts', 'generate-modules.mjs')
const template = readFileSync(join(root, 'templates', 'home.html'), 'utf8')
const script = readFileSync(join(root, 'script.js'), 'utf8')

function generateInto(scratch) {
  const result = spawnSync(process.execPath, [generatorPath, '--root', scratch], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function leafKeys(value, prefix) {
  if (typeof value === 'string') return [prefix]
  return Object.entries(value).flatMap(([key, child]) => leafKeys(child, `${prefix}.${key}`))
}

test('the home page is generated and matches the committed index.html byte for byte', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'farmia-home-'))
  try {
    generateInto(scratch)
    assert.equal(readFileSync(join(scratch, 'index.html'), 'utf8'), readFileSync(join(root, 'index.html'), 'utf8'))
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('check mode detects a hand-edited index.html', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'farmia-home-'))
  try {
    generateInto(scratch)
    const clean = spawnSync(process.execPath, [generatorPath, '--check', '--root', scratch], { cwd: root, encoding: 'utf8' })
    assert.equal(clean.status, 0, clean.stderr || clean.stdout)

    const homePath = join(scratch, 'index.html')
    writeFileSync(homePath, readFileSync(homePath, 'utf8').replace('Empezar es simple.', 'Empezar es muy simple.'), 'utf8')
    const edited = spawnSync(process.execPath, [generatorPath, '--check', '--root', scratch], { cwd: root, encoding: 'utf8' })
    assert.notEqual(edited.status, 0)
    assert.match(`${edited.stdout}\n${edited.stderr}`, /desactualizado index\.html/)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('every generated page resolves all its placeholders', () => {
  const files = expectedFiles()
  assert.ok(files.has('index.html'), 'the home page should be part of the generated files')
  for (const [path, content] of files) {
    assert.doesNotMatch(content, /\{\{|\}\}/, `${path} should not keep template placeholders`)
  }
})

test('every Spanish home string is used by the home template', () => {
  for (const key of leafKeys(es.home, 'home')) {
    assert.ok(template.includes(`{{${key}}}`), `${key} is defined in content/i18n/es.mjs but unused in templates/home.html`)
  }
})

test('the template renderer escapes values and fails clearly on unknown keys', () => {
  assert.equal(renderTemplate('<p title="{{a.b}}">{{a.b}}</p>{{{raw}}}', { a: { b: 'x & "y"' }, raw: '<b>' }), '<p title="x &amp; &quot;y&quot;">x &amp; &quot;y&quot;</p><b>')
  assert.throws(() => renderTemplate('<p>{{home.nope}}</p>', { home: {} }, 'templates/home.html'), /templates\/home\.html: clave desconocida \{\{home\.nope\}\}/)
  assert.throws(() => renderTemplate('<p>{{home}}</p>', { home: { title: 'x' } }), /clave desconocida \{\{home\}\}/, 'an object is not a printable value')
  assert.throws(() => renderTemplate('<p>{{ not a key }}</p>', {}), /marcador sin resolver/)
})

test('the home page fails to generate when the locale lacks a key', () => {
  const incomplete = structuredClone(es)
  delete incomplete.home.faq.items[5].answer
  assert.throws(() => homePage(incomplete), /clave desconocida \{\{home\.faq\.items\.5\.answer\}\}/)
})

// ---- Inglés y portugués ----

const translations = [en, pt]
const origin = 'https://www.farmiasolutions.com'
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function leafMap(value, prefix = '', out = new Map()) {
  if (typeof value === 'string') out.set(prefix, value)
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) leafMap(child, prefix ? `${prefix}.${key}` : key, out)
  return out
}

// El texto en español con la misma forma que una traducción: ui, home y anchors de es.mjs, y el
// catálogo de content/modules.mjs reducido a sus campos de texto.
function spanishText() {
  return {
    ui: es.ui,
    home: es.home,
    anchors: es.anchors,
    groups: Object.fromEntries(moduleGroups.map(({ id, name, description }) => [id, { name, description }])),
    modules: Object.fromEntries(modules.map((module) => [module.slug, {
      slug: module.slug,
      name: module.name,
      shortDescription: module.shortDescription,
      seoDescription: module.seoDescription,
      heroTitle: module.heroTitle,
      heroBody: module.heroBody,
      heroImage: { alt: module.heroImage.alt },
      tasks: module.tasks,
      workflow: module.workflow,
      gallery: module.gallery.map(({ alt, caption }) => ({ alt, caption })),
      roles: module.roles,
      connections: Object.fromEntries(module.connections.map(({ slug, body }) => [slug, body])),
      ...(module.internalAreas ? { internalAreas: module.internalAreas } : {}),
      whatsappMessage: module.whatsappMessage,
    }])),
  }
}

function translatedText(locale) {
  const { ui, home, anchors, groups, modules: text } = locale
  return { ui, home, anchors, groups, modules: text }
}

// Rutas de archivo (los badges de las tiendas): distintas por idioma, no son texto.
const isAssetKey = (key) => /^ui\.store\.(appStore|googlePlay)Badge$/.test(key)

// Cadenas que pueden coincidir con el español a propósito. Cada entrada dice por qué.
const sameAsSpanish = {
  en: new Set([
    'ui.breadcrumb.label', // «Breadcrumb» ya es el rótulo ARIA del sitio en español
    'home.mobile.eyebrow', // FarmIA Mobile: nombre de producto
    'home.form.email', // «Email» se escribe igual
    'home.form.privacyAfter', // solo el punto final
    'anchors.demo', // id de URL: «demo» en los tres idiomas
  ]),
  pt: new Set([
    'ui.nav.platform', // Plataforma
    'ui.nav.modules', // Módulos
    'ui.nav.clients', // Clientes
    'ui.language.label', // Idioma
    'home.hero.pillsLabel', // Módulos conectados
    'home.hero.pills.results', // Resultados
    'home.journey.observe.phase', // Observar
    'home.journey.validate.phase', // Validar
    'home.journey.learn.phase', // Aprender
    'home.modules.flow.understand', // Entender
    'home.modules.flow.learn', // Aprender
    'home.mobile.eyebrow', // FarmIA Mobile: nombre de producto
    'home.form.company', // Empresa
    'home.form.privacyAfter', // solo el punto final
    'groups.understand.name', // Entender
    'modules.agroclima.slug', // agroclima: la palabra es igual en pt-BR
    'modules.agroclima.name', // Agroclima: así lo nombra la app en pt
    'modules.gestion.internalAreas.2.title', // Documentos IA: así lo nombra la app en pt
    'modules.gestion.internalAreas.3.title', // Resultados
    // Ids de URL que en portugués son la misma palabra que en español.
    'anchors.top',
    'anchors.platform',
    'anchors.scale',
    'anchors.modules',
    'anchors.intelligence',
    'anchors.clients',
    'anchors.demo',
  ]),
}

const generated = expectedFiles()
const localeOfPath = (path) => translations.find((locale) => path.startsWith(`${locale.basePath.slice(1)}/`)) || es

function urlToFile(url) {
  const path = url.replace(origin, '').split('#')[0]
  return `${path.replace(/^\//, '')}index.html`
}

const isHub = (path) => /^(?:(?:en|pt)\/)?(?:modulos|modules)\/index\.html$/.test(path)
const contentPages = () => [...generated].filter(([path]) => path.endsWith('index.html') && !isHub(path))

function withoutSwitchersAndAlternates(html) {
  return html.replace(/<div class="language-switcher[^"]*"[^>]*>[\s\S]*?<\/div>/g, '').replace(/<link rel="alternate"[^>]*>/g, '')
}

test('English and Portuguese cover exactly the Spanish keys for ui, home, anchors, groups and modules', () => {
  const sourceKeys = [...leafMap(spanishText()).keys()].filter((key) => !isAssetKey(key)).sort()
  for (const locale of translations) {
    assert.deepEqual([...leafMap(locale.ui, 'ui').keys()], [...leafMap(es.ui, 'ui').keys()], `${locale.code}: ui keys`)
    assert.deepEqual([...leafMap(locale.home, 'home').keys()], [...leafMap(es.home, 'home').keys()], `${locale.code}: home keys`)
    assert.deepEqual(Object.keys(locale.anchors), Object.keys(es.anchors), `${locale.code}: anchor keys`)
    assert.deepEqual(Object.keys(locale.groups).sort(), moduleGroups.map(({ id }) => id).sort(), `${locale.code}: groups`)
    assert.deepEqual(Object.keys(locale.modules).sort(), modules.map(({ slug }) => slug).sort(), `${locale.code}: modules`)
    const translatedKeys = [...leafMap(translatedText(locale)).keys()].filter((key) => !isAssetKey(key)).sort()
    assert.deepEqual(translatedKeys, sourceKeys, `${locale.code}: every module text field is translated`)
    for (const [key, value] of leafMap(translatedText(locale))) assert.ok(value.trim(), `${locale.code}.${key} is empty`)
    const slugs = Object.values(locale.modules).map(({ slug }) => slug)
    assert.equal(new Set(slugs).size, slugs.length, `${locale.code}: localized slugs are unique`)
  }
})

test('no English or Portuguese string is left in Spanish, except the commented allowlist', () => {
  const source = leafMap(spanishText())
  for (const locale of translations) {
    const translated = leafMap(translatedText(locale))
    const allowed = sameAsSpanish[locale.code]
    const untranslated = [...translated].filter(([key, value]) => source.get(key) === value && !allowed.has(key)).map(([key]) => key)
    assert.deepEqual(untranslated, [], `${locale.code}: strings identical to Spanish`)
    const stale = [...allowed].filter((key) => source.get(key) !== translated.get(key))
    assert.deepEqual(stale, [], `${locale.code}: allowlist entries that are no longer identical`)
  }
})

test('the product glossary is respected in English and Portuguese copy', () => {
  const english = [...leafMap(translatedText(en)).values()].join('\n')
  for (const term of [/\blots?\b/i, /\bplots?\b/i, /\bcampaigns?\b/i, /\benvironments?\b/i, /\bestablishments?\b/i, /\bdoses?\b/i, /\bmonitoring\b/i, /\brecipes?\b/i, /\bwaypoints?\b/i, /\bplease\b/i, /tn\/ha/, /!/]) {
    assert.doesNotMatch(english, term, `en uses ${term}`)
  }
  const portuguese = [...leafMap(translatedText(pt)).values()].join('\n')
  for (const term of [/\blotes?\b/i, /\bcampanhas?\b/i, /\bestabelecimentos?\b/i, /\bambientes?\b/i, /ambientaç/i, /zonificaç/i, /fertilizaç/i, /\brendimento/i, /tn\/ha/, /\bficheiros?\b/i, /\becrã\b/i, /\butilizador/i, /\btelemóvel\b/i, /\bregistos?\b/i, /\bcontacto/i, /\bequipa\b/i, /\bplaneamento\b/i, /\baceder\b/i]) {
    assert.doesNotMatch(portuguese, term, `pt uses ${term}`)
  }
})

test('every content page carries its language, a self canonical, the four hreflang links and a switcher to existing pages', () => {
  assert.equal(contentPages().length, 27)
  for (const [path, html] of contentPages()) {
    const locale = localeOfPath(path)
    assert.match(html, new RegExp(`<html lang="${locale.lang}">`), `${path}: lang`)
    assert.doesNotMatch(html, /\{\{/, `${path}: placeholders`)
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1]
    assert.equal(canonical && urlToFile(canonical), path, `${path}: canonical should point to itself`)
    const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(([, hreflang, href]) => [hreflang, href])
    assert.deepEqual(alternates.map(([hreflang]) => hreflang), ['es', 'en', 'pt-BR', 'x-default'], `${path}: hreflang set`)
    assert.equal(alternates.find(([hreflang]) => hreflang === locale.hreflang)[1], canonical, `${path}: own hreflang is the canonical`)
    assert.equal(alternates[3][1], alternates[0][1], `${path}: x-default is the Spanish page`)
    for (const [, href] of alternates) assert.ok(generated.has(urlToFile(href)), `${path}: hreflang target ${href} should be generated`)
    assert.match(html, new RegExp(`<meta property="og:locale" content="${locale.ogLocale}">`))
    assert.equal((html.match(/og:locale:alternate/g) || []).length, 2, `${path}: og:locale:alternate`)

    const switchers = html.match(/<div class="language-switcher[^"]*" role="group" aria-label="[^"]+">[\s\S]*?<\/div>/g) || []
    assert.equal(switchers.length, 2, `${path}: switcher in header and footer`)
    for (const switcher of switchers) {
      assert.ok(switcher.includes(`aria-label="${locale.ui.language.label}"`), `${path}: localized group label`)
      const links = [...switcher.matchAll(/<a href="([^"]+)" lang="([^"]+)" hreflang="([^"]+)"( aria-current="true")?>([A-Z]{2})<\/a>/g)]
      assert.deepEqual(links.map((link) => link[5]), ['ES', 'EN', 'PT'], `${path}: switcher labels`)
      assert.deepEqual(links.filter((link) => link[4]).map((link) => link[3]), [locale.hreflang], `${path}: aria-current on the current language`)
      for (const [, href] of links) assert.ok(generated.has(urlToFile(href)), `${path}: switcher target ${href} should be generated`)
      assert.deepEqual(links.map((link) => `${origin}${link[1]}`), alternates.slice(0, 3).map(([, href]) => href), `${path}: switcher and hreflang agree`)
    }
  }
})

test('internal links stay in their language and land on existing pages and sections', () => {
  for (const [path, html] of contentPages()) {
    const locale = localeOfPath(path)
    for (const [, href] of withoutSwitchersAndAlternates(html).matchAll(/href="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:)/.test(href) || /\.[a-z0-9]+(?:\?|$)/i.test(href.split('#')[0])) continue
      const [target, fragment] = href.split('#')
      const file = target ? urlToFile(target) : path
      if (locale === es) assert.doesNotMatch(target, /^\/(?:en|pt)\//, `${path}: ${href} leaves es`)
      else assert.ok(target === '' || target.startsWith(`${locale.basePath}/`), `${path}: ${href} leaves ${locale.code}`)
      assert.ok(generated.has(file), `${path}: ${href} points to a missing page`)
      if (fragment) assert.match(generated.get(file), new RegExp(`id="${fragment}"`), `${path}: ${href} points to a missing section`)
    }
  }
})

test('legacy module hubs redirect to the module grid of their own language', () => {
  for (const locale of [es, ...translations]) {
    const hubPath = `${locale.basePath ? `${locale.basePath.slice(1)}/` : ''}${locale.modulesSegment}/index.html`
    const html = generated.get(hubPath)
    const target = `${locale.basePath}/#${locale.anchors.modules}`
    assert.ok(html, `${hubPath} should be generated`)
    assert.match(html, new RegExp(`<html lang="${locale.lang}">`))
    assert.ok(html.includes(`content="0; url=${target}"`) && html.includes(`location.replace('${target}')`), `${hubPath} redirects to ${target}`)
    assert.match(generated.get(urlToFile(`${locale.basePath}/`)), new RegExp(`id="${locale.anchors.modules}"`))
  }
})

test('English and Portuguese pages use their own store badges and the country-neutral store links', () => {
  for (const locale of translations) {
    const home = generated.get(`${locale.basePath.slice(1)}/index.html`)
    const monitoring = generated.get(urlToFile(`${locale.basePath}/${locale.modulesSegment}/${locale.modules.monitoreo.slug}/`))
    for (const html of [home, monitoring]) {
      assert.match(html, new RegExp(`src="/assets/store/app-store-badge-${locale.code}\\.svg"`))
      assert.match(html, new RegExp(`src="/assets/store/google-play-badge-${locale.code}\\.png"`))
      assert.doesNotMatch(html, /badge-es\./)
      assert.ok(html.includes('href="https://apps.apple.com/app/farmia/id6796829180"'))
      assert.ok(html.includes(`href="https://play.google.com/store/apps/details?id=com.farmia.mobile&amp;hl=${locale.hreflang}"`))
      assert.doesNotMatch(html, /apps\.apple\.com\/ar\//)
    }
    for (const file of [`app-store-badge-${locale.code}.svg`, `google-play-badge-${locale.code}.png`]) {
      assert.ok(existsSync(join(root, 'assets', 'store', file)), `${file} should exist`)
    }
  }
})

test('the demo form reports its language and keeps one Formspree endpoint', () => {
  for (const locale of [es, ...translations]) {
    const home = generated.get(urlToFile(`${locale.basePath}/`))
    assert.match(home, new RegExp(`<input type="hidden" name="language" value="${locale.code}">`))
    assert.match(home, new RegExp(`<input type="hidden" name="_subject" value="${escapeRegExp(locale.home.form.subject)}">`))
    assert.match(home, new RegExp(`action="${escapeRegExp(site.formspreeUrl)}"`))
  }
  assert.doesNotMatch(template, /formspree\.io/, 'the endpoint lives with the other shared URLs in content/modules.mjs')
})

function runScript(lang, fetchResponse) {
  class FakeClassList {
    constructor() { this.values = new Set() }
    add(...names) { names.forEach((name) => this.values.add(name)) }
    remove(...names) { names.forEach((name) => this.values.delete(name)) }
    toggle(name, force) {
      const on = force === undefined ? !this.values.has(name) : force
      if (on) this.add(name)
      else this.remove(name)
      return on
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
      this.value = ''
    }
    addEventListener(type, listener) { this.listeners.set(type, listener) }
    setAttribute(name, value) { this.attributes.set(name, value) }
    getAttribute(name) { return this.attributes.get(name) ?? null }
    removeAttribute(name) { this.attributes.delete(name) }
    contains() { return false }
    checkValidity() { return this.valid }
    reportValidity() {}
    reset() {}
    querySelector(selector) { return this.children?.[selector] ?? null }
  }
  const form = new FakeElement()
  form.valid = true
  form.action = site.formspreeUrl
  form.children = { '.form-status': new FakeElement(), 'button[type="submit"]': new FakeElement() }
  const navToggle = new FakeElement()
  const nav = new FakeElement()
  const documentElement = new FakeElement()
  if (lang) documentElement.lang = lang
  const document = {
    body: new FakeElement(),
    documentElement,
    addEventListener() {},
    querySelector(selector) { return { '.demo-form': form, '.nav-toggle': navToggle, '.site-nav': nav }[selector] ?? null },
    querySelectorAll() { return [] },
  }
  const window = {
    addEventListener() {},
    history: { pushState() {} },
    location: { hash: '', search: '' },
    matchMedia() { return { matches: false, addEventListener() {} } },
    scrollTo() {},
    scrollY: 0,
  }
  let sendingLabel = ''
  const fetch = async () => {
    sendingLabel = form.children['button[type="submit"]'].textContent
    return fetchResponse
  }
  runInNewContext(script, { document, window, URLSearchParams, FormData: class {}, fetch })
  return { form, navToggle, sendingLabel: () => sendingLabel }
}

test('script.js speaks the page language and falls back to Spanish without a lang attribute', async () => {
  const expected = [
    ['en', en, { closeMenu: 'Close menu', sending: 'Sending request…', success: 'We received your request. We’ll be in touch to schedule the demo.', failure: 'We couldn’t send your request. Try again or message us on WhatsApp.', invalid: 'Enter your name and a valid email to continue.' }],
    ['pt-BR', pt, { closeMenu: 'Fechar menu', sending: 'Enviando solicitação…', success: 'Recebemos a sua solicitação. Vamos entrar em contato para combinar a demo.', failure: 'Não foi possível enviar a solicitação. Tente novamente ou fale com a gente pelo WhatsApp.', invalid: 'Preencha seu nome e um e-mail válido para continuar.' }],
    [undefined, es, { closeMenu: 'Cerrar menú', sending: 'Enviando solicitud…', success: 'Recibimos tu solicitud. Te vamos a contactar para coordinar la demo.', failure: 'No pudimos enviar la solicitud. Podés intentar de nuevo o escribirnos por WhatsApp.', invalid: 'Completá tu nombre y un email válido para continuar.' }],
  ]
  for (const [lang, locale, messages] of expected) {
    const label = lang || 'sin lang'
    const ok = runScript(lang, { ok: true })
    ok.navToggle.listeners.get('click')()
    assert.equal(ok.navToggle.getAttribute('aria-label'), messages.closeMenu, `${label}: close menu`)
    ok.navToggle.listeners.get('click')()
    assert.equal(ok.navToggle.getAttribute('aria-label'), locale.ui.nav.openMenu, `${label}: open menu matches the catalog`)
    await ok.form.listeners.get('submit')({ preventDefault() {} })
    assert.equal(ok.sendingLabel(), messages.sending, `${label}: sending`)
    assert.equal(ok.form.children['.form-status'].textContent, messages.success, `${label}: success`)

    const failed = runScript(lang, { ok: false })
    await failed.form.listeners.get('submit')({ preventDefault() {} })
    assert.equal(failed.form.children['.form-status'].textContent, messages.failure, `${label}: failure`)

    const invalid = runScript(lang, { ok: true })
    invalid.form.valid = false
    await invalid.form.listeners.get('submit')({ preventDefault() {} })
    assert.equal(invalid.form.children['.form-status'].textContent, messages.invalid, `${label}: invalid`)
  }
})
