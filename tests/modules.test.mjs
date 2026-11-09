import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import en from '../content/i18n/en.mjs'
import pt from '../content/i18n/pt.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const catalogPath = join(root, 'content', 'modules.mjs')
const generatorPath = join(root, 'scripts', 'generate-modules.mjs')
const bookingUrl = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2EZbkSfAAHaHis-QxOTnS3ca11N6290qr_glH9MJ1WR8RJ7M6kccGXflEpKw9u18SgO9oLuZKJ'
const googlePlayUrl = 'https://play.google.com/store/apps/details?id=com.farmia.mobile'
const appStoreUrl = 'https://apps.apple.com/ar/app/farmia/id6796829180'

const expectedModules = [
  ['analisis-gis', 'Análisis GIS y resultados'],
  ['imagenes-satelitales', 'Imágenes satelitales y altimetría'],
  ['agroclima', 'Agroclima'],
  ['prescripciones', 'Prescripciones y ambientación'],
  ['monitoreo', 'Monitoreo y app móvil'],
  ['balance-suelo', 'Balance de suelo'],
  ['muestreo-suelo', 'Muestreo de suelo'],
  ['gestion', 'Gestión'],
]

async function loadCatalog() {
  assert.equal(existsSync(catalogPath), true, 'content/modules.mjs should define the public catalog')
  return import(`${pathToFileURL(catalogPath).href}?test=${Date.now()}`)
}

function readOutput(...parts) {
  const path = join(root, ...parts)
  assert.equal(existsSync(path), true, `${parts.join('/')} should be generated`)
  return readFileSync(path, 'utf8')
}

function meta(html, pattern, label) {
  const match = html.match(pattern)
  assert.ok(match, `${label} should exist`)
  return match[1]
}

test('catalog defines the eight approved modules with complete publishable content', async () => {
  const { modules, moduleGroups } = await loadCatalog()

  assert.deepEqual(modules.map(({ slug, name }) => [slug, name]), expectedModules)
  assert.deepEqual(moduleGroups.map(({ name }) => name), ['Entender', 'Planificar y actuar', 'Suelo', 'Gestionar'])
  assert.equal(new Set(modules.map(({ slug }) => slug)).size, 8)
  assert.equal(new Set(modules.map(({ heroImage }) => heroImage.src)).size, 8, 'every module needs its own hero view')

  const validSlugs = new Set(expectedModules.map(([slug]) => slug))
  for (const module of modules) {
    assert.ok(module.shortDescription)
    assert.ok(module.seoDescription)
    assert.ok(module.heroTitle)
    assert.ok(module.heroBody)
    assert.equal(module.tasks.length, 3, `${module.slug} should explain three tasks`)
    assert.equal(module.workflow.length, 3, `${module.slug} should explain a three-step workflow`)
    assert.equal(module.gallery.length, 2, `${module.slug} should show two complementary views`)
    assert.ok(module.roles.length >= 2, `${module.slug} should name its beneficiaries`)
    assert.ok(module.whatsappMessage.includes(module.name))

    for (const image of [module.heroImage, ...module.gallery]) {
      assert.ok(image.alt, `${module.slug} images need useful alternative text`)
      assert.equal(existsSync(join(root, image.src.replace(/^\//, ''))), true, `${image.src} should exist`)
    }

    for (const connection of module.connections) {
      assert.equal(validSlugs.has(connection.slug), true, `${module.slug} has an invalid connection`)
      assert.notEqual(connection.slug, module.slug, `${module.slug} should not link to itself`)
      assert.ok(connection.body)
    }
  }

  assert.deepEqual(modules.find(({ slug }) => slug === 'gestion').connections, [])
  assert.ok(modules.filter(({ slug }) => slug !== 'gestion').every(({ connections }) => connections.length > 0))
})

test('requested module stories are represented by specific copy and three distinct product views', async () => {
  const { modules } = await loadCatalog()
  const bySlug = Object.fromEntries(modules.map((module) => [module.slug, module]))

  for (const slug of [
    'analisis-gis',
    'imagenes-satelitales',
    'agroclima',
    'prescripciones',
    'monitoreo',
    'balance-suelo',
    'muestreo-suelo',
  ]) {
    const module = bySlug[slug]
    const sources = [module.heroImage, ...module.gallery].map(({ src }) => src)
    assert.equal(new Set(sources).size, 3, `${slug} should use three distinct product views`)
  }

  const searchableText = (module) => JSON.stringify(module).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

  assert.match(searchableText(bySlug['analisis-gis']), /margen por ambiente/)
  assert.match(searchableText(bySlug['analisis-gis']), /compar(ar|acion|ativa).*campan/)
  assert.match(bySlug['analisis-gis'].heroImage.src, /margenes-rinde-esperado/)
  assert.match(bySlug['analisis-gis'].heroImage.alt, /rinde esperado visible/i)
  assert.match(bySlug['analisis-gis'].gallery[0].src, /comparar-campanas.*rinde-normalizado/)
  assert.match(bySlug['analisis-gis'].gallery[0].alt, /comparar campa.+mapa.*normalizado/i)

  assert.match(searchableText(bySlug['imagenes-satelitales']), /altimetr/)
  assert.match(searchableText(bySlug['imagenes-satelitales']), /(cuatro|4).*vista/)
  assert.doesNotMatch(bySlug['imagenes-satelitales'].heroImage.src, /mobile/)

  assert.match(searchableText(bySlug.agroclima), /lluvia.*acumul/)
  assert.match(searchableText(bySlug.agroclima), /pronostico/)
  assert.match(searchableText(bySlug.agroclima), /dia.*critic/)
  assert.match(bySlug.agroclima.heroImage.src, /pronostico-completo/)
  assert.match(bySlug.agroclima.heroImage.alt, /vista completa/i)

  assert.match(searchableText(bySlug.prescripciones), /ensayo/)
  assert.match(searchableText(bySlug.prescripciones), /(recorte|suaviz)/)

  assert.match(searchableText(bySlug.monitoreo), /centro de monitoreo/)
  assert.match(searchableText(bySlug.monitoreo), /export/)
  assert.equal(bySlug.monitoreo.heroImage.presentation, 'wide')
  assert.match(bySlug.monitoreo.heroImage.src, /centro-integral/)
  assert.match(bySlug.monitoreo.heroImage.alt, /notas variadas/i)
  assert.ok(bySlug.monitoreo.gallery.every(({ presentation }) => presentation === 'phone'))

  assert.match(searchableText(bySlug['balance-suelo']), /reposicion.*fosforo/)
  assert.ok(bySlug['balance-suelo'].connections.some(({ slug }) => slug === 'prescripciones'))
  assert.ok(bySlug['balance-suelo'].gallery.some(({ src }) => /reposicion-fosforo/.test(src)))

  assert.match(searchableText(bySlug['muestreo-suelo']), /(penetrometr|prescripcion)/)
  assert.ok(bySlug['muestreo-suelo'].gallery.some(({ src, alt }) => /penetrometria-colores/.test(src) && /escala de colores/i.test(alt)))
})

test('prescriptions closes its gallery with an active grid and fixed-strip trial', async () => {
  const { modules } = await loadCatalog()
  const prescription = modules.find(({ slug }) => slug === 'prescripciones')
  const trialView = prescription.gallery.at(-1)

  assert.equal(trialView.src, '/assets/product/modules/prescripcion-ensayo-grilla-franja.webp')
  assert.match(trialView.alt, /grilla.*franja fija|franja fija.*grilla/i)
  assert.match(trialView.caption, /Creá ensayos en minutos/i)
  assert.equal(existsSync(join(root, trialView.src.replace(/^\//, ''))), true)
})

test('generator creates one legacy redirect and eight deterministic detail pages', () => {
  assert.equal(existsSync(generatorPath), true, 'scripts/generate-modules.mjs should exist')
  const generated = spawnSync(process.execPath, [generatorPath], { cwd: root, encoding: 'utf8' })
  assert.equal(generated.status, 0, generated.stderr || generated.stdout)

  const generatedPages = [join(root, 'modulos', 'index.html')]
  for (const [slug] of expectedModules) generatedPages.push(join(root, 'modulos', slug, 'index.html'))
  assert.equal(generatedPages.filter(existsSync).length, 9)

  const generatedDirectories = readdirSync(join(root, 'modulos'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  assert.deepEqual(generatedDirectories, expectedModules.map(([slug]) => slug).sort())

  const checked = spawnSync(process.execPath, [generatorPath, '--check'], { cwd: root, encoding: 'utf8' })
  assert.equal(checked.status, 0, checked.stderr || checked.stdout)
})

test('generated module pages expose unique SEO metadata and complete commercial journeys', async () => {
  const { modules } = await loadCatalog()
  const titles = new Set()
  const descriptions = new Set()

  for (const module of modules) {
    const html = readOutput('modulos', module.slug, 'index.html')
    const title = meta(html, /<title>([^<]+)<\/title>/, `${module.slug} title`)
    const description = meta(html, /<meta name="description" content="([^"]+)"/, `${module.slug} description`)
    titles.add(title)
    descriptions.add(description)

    assert.match(html, new RegExp(`<link rel="canonical" href="https://www\\.farmiasolutions\\.com/modulos/${module.slug}/">`))
    assert.match(html, new RegExp(`<meta property="og:url" content="https://www\\.farmiasolutions\\.com/modulos/${module.slug}/">`))
    assert.match(html, /<script type="application\/ld\+json">/)
    assert.match(html, /<main id="contenido">/)
    assert.match(html, /aria-label="Breadcrumb"/)
    assert.match(html, /href="\/#modulos">Módulos</)
    const bookingLinks = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>Agendar una demo<\/a>/g)]
    assert.equal(bookingLinks.length, 3, `${module.slug} should expose scheduling in header, hero, and final CTA`)
    assert.ok(bookingLinks.every(([, href]) => href === bookingUrl))
    assert.ok(bookingLinks.every(([link]) => /target="_blank"/.test(link) && /rel="noopener noreferrer"/.test(link)))
    assert.match(html, /https:\/\/wa\.me\/5491156592528\?text=/)
    assert.match(html, /https:\/\/app\.farmiasolutions\.com/)
    assert.match(html, />Ir a la app</)
    assert.doesNotMatch(html, />Iniciar sesión</)
    assert.match(html, /D[‑-]U[‑-]N[‑-]S[^0-9]*352223533/)
    assert.match(html, /FarmIA Solutions\. Nombre comercial de CACICU 26 S\.A\./)
    assert.match(html, /class="module-hero__media/)
    assert.equal((html.match(/class="module-gallery__item/g) || []).length, 2)
    assert.equal((html.match(/data-image-zoom/g) || []).length, 3, `${module.slug} should make all product captures zoomable`)
    assert.equal((html.match(/class="image-lightbox"/g) || []).length, 1, `${module.slug} should provide one shared image viewer`)
    assert.doesNotMatch(html, /class="[^"\n]*module-workflow/)
    assert.doesNotMatch(html, /class="[^"\n]*module-roles/)
  }

  assert.equal(titles.size, 8)
  assert.equal(descriptions.size, 8)
})

test('generated monitoring page presents the web center wide and mobile captures in phone frames', () => {
  const html = readOutput('modulos', 'monitoreo', 'index.html')

  assert.match(html, /module-hero__media--wide/)
  assert.equal((html.match(/module-gallery__item--phone/g) || []).length, 2)
  assert.equal((html.match(/class="module-phone-frame"/g) || []).length, 2)
})

test('only the monitoring module offers direct downloads from both mobile stores', () => {
  const monitoringHtml = readOutput('modulos', 'monitoreo', 'index.html')

  assert.ok(monitoringHtml.includes(`href="${appStoreUrl}"`))
  assert.ok(monitoringHtml.includes(`href="${googlePlayUrl}"`))
  assert.match(monitoringHtml, /App complementaria para clientes de FarmIA/)
  assert.match(monitoringHtml, /src="\/assets\/store\/app-store-badge-es\.svg"[^>]*alt="Descargar FarmIA en App Store"/)
  assert.match(monitoringHtml, /src="\/assets\/store\/google-play-badge-es\.png"[^>]*alt="Descargar FarmIA en Google Play"/)

  for (const [slug] of expectedModules.filter(([slug]) => slug !== 'monitoreo')) {
    const html = readOutput('modulos', slug, 'index.html')
    assert.doesNotMatch(html, /play\.google\.com\/store\/apps\/details\?id=com\.farmia\.mobile/, `${slug} should not promote the mobile stores`)
    assert.doesNotMatch(html, /apps\.apple\.com\/ar\/app\/farmia\/id6796829180/, `${slug} should not promote the mobile stores`)
  }
})

test('technical pages show real module continuity while Gestion presents only its own areas', () => {
  for (const [slug] of expectedModules) {
    const html = readOutput('modulos', slug, 'index.html')
    if (slug === 'gestion') {
      assert.doesNotMatch(html, /También se conecta con/)
      assert.match(html, /Áreas de Gestión/)
    } else {
      assert.match(html, /También se conecta con/)
      assert.match(html, /class="[^"]*module-connections[^"]*"/)
    }
  }
})

test('legacy module hub redirects visitors to the home module grid', () => {
  const html = readOutput('modulos', 'index.html')
  assert.match(html, /http-equiv="refresh" content="0; url=\/#modulos"/)
  assert.match(html, /location\.replace\('\/#modulos'\)/)
  assert.match(html, /href="\/#modulos"/)
  assert.doesNotMatch(html, /modules-hub-content/)
  assert.doesNotMatch(html, /module-card-grid/)
})

test('sitemap publishes each language home and its eight detail URLs without the legacy hubs', () => {
  const xml = readOutput('sitemap.xml')
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  assert.deepEqual(urls, [
    'https://www.farmiasolutions.com/',
    ...expectedModules.map(([slug]) => `https://www.farmiasolutions.com/modulos/${slug}/`),
    'https://www.farmiasolutions.com/en/',
    ...expectedModules.map(([slug]) => `https://www.farmiasolutions.com/en/modules/${en.modules[slug].slug}/`),
    'https://www.farmiasolutions.com/pt/',
    ...expectedModules.map(([slug]) => `https://www.farmiasolutions.com/pt/modulos/${pt.modules[slug].slug}/`),
  ])
})

test('check mode detects a versioned page that is out of sync without rewriting it', () => {
  assert.equal(existsSync(generatorPath), true, 'scripts/generate-modules.mjs should exist')
  const scratch = mkdtempSync(join(tmpdir(), 'farmia-modules-'))
  try {
    const result = spawnSync(process.execPath, [generatorPath, '--check', '--root', scratch], { cwd: root, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /desactualiz|faltan|missing|out of date/i)
    assert.equal(existsSync(join(scratch, 'modulos')), false, '--check must not write generated files')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})
