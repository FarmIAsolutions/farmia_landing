import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { moduleGroups, modules, site } from '../content/modules.mjs'
import es from '../content/i18n/es.mjs'
import en from '../content/i18n/en.mjs'
import pt from '../content/i18n/pt.mjs'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const rootIndex = args.indexOf('--root')
const outputRoot = rootIndex >= 0 ? resolve(args[rootIndex + 1] || '') : sourceRoot
const homeTemplatePath = join(sourceRoot, 'templates', 'home.html')

// Un objeto por idioma (content/i18n/<código>.mjs). El español es la fuente y se publica en la raíz;
// el resto vive bajo su basePath (/en/, /pt/).
export const locales = [es, en, pt]
const sourceLocale = es
const assetVersions = { styles: '20261109-1', script: '20261109-1' }

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function format(text, values) {
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Falta el valor {${name}} en «${text}»`)
    return values[name]
  })
}

function homeUrl(locale) {
  return `${locale.basePath}/`
}

function modulesUrl(locale) {
  return `${locale.basePath}/${locale.modulesSegment}/`
}

function moduleUrl(locale, module) {
  return `${modulesUrl(locale)}${module.slug}/`
}

// El slug en español es el id interno de cada módulo (catálogo, conexiones, module_interest del formulario).
function moduleId(module) {
  return module.id ?? module.slug
}

const catalogCache = new WeakMap()

// Une el catálogo estructural (imágenes, conexiones, grupos) con el texto de un idioma.
// Para español devuelve el catálogo de content/modules.mjs tal cual.
export function localizedCatalog(locale) {
  if (locale.code === sourceLocale.code) return { modules, moduleGroups }
  if (catalogCache.has(locale)) return catalogCache.get(locale)
  const groupOf = (slug) => moduleGroups.find((group) => group.slugs.includes(slug))
  const catalog = {
    moduleGroups: moduleGroups.map((group) => ({ ...group, ...locale.groups[group.id] })),
    modules: modules.map((module) => {
      const text = locale.modules[module.slug]
      return {
        ...module,
        ...text,
        id: module.slug,
        group: locale.groups[groupOf(module.slug).id].name,
        heroImage: { ...module.heroImage, ...text.heroImage },
        gallery: module.gallery.map((image, index) => ({ ...image, ...text.gallery[index] })),
        connections: module.connections.map((connection) => ({ slug: connection.slug, body: text.connections[connection.slug] })),
      }
    }),
  }
  catalogCache.set(locale, catalog)
  return catalog
}

function findModule(locale, id) {
  return localizedCatalog(locale).modules.find((module) => moduleId(module) === id)
}

// Una página se describe por su tipo y, si es de módulo, por el id del módulo; así cada idioma
// resuelve la URL equivalente (selector de idioma y hreflang).
function pageUrl(locale, page) {
  return page.kind === 'module' ? moduleUrl(locale, findModule(locale, page.id)) : homeUrl(locale)
}

function storeUrls(locale) {
  if (locale.code === sourceLocale.code) return { appStore: site.appStoreUrl, googlePlay: site.googlePlayUrl }
  return { appStore: site.appStoreGlobalUrl, googlePlay: `${site.googlePlayUrl}&hl=${locale.hreflang}` }
}

function alternateLinks(page) {
  const links = locales.map((target) => `<link rel="alternate" hreflang="${target.hreflang}" href="${site.origin}${pageUrl(target, page)}">`)
  links.push(`<link rel="alternate" hreflang="x-default" href="${site.origin}${pageUrl(sourceLocale, page)}">`)
  return links
}

function ogLocaleAlternates(locale) {
  return locales.filter((target) => target.code !== locale.code).map((target) => `<meta property="og:locale:alternate" content="${target.ogLocale}">`)
}

function languageSwitcher(locale, page, variant) {
  const links = locales.map((target) => {
    const current = target.code === locale.code ? ' aria-current="true"' : ''
    return `<a href="${pageUrl(target, page)}" lang="${target.lang}" hreflang="${target.hreflang}"${current}>${target.code.toUpperCase()}</a>`
  }).join('<span aria-hidden="true">·</span>')
  return `<div class="language-switcher language-switcher--${variant}" role="group" aria-label="${escapeHtml(locale.ui.language.label)}">${links}</div>`
}

function outputPath(url) {
  return `${url.replace(/^\//, '')}index.html`
}

function whatsappUrl(message) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`
}

function lookup(context, key) {
  let value = context
  for (const part of key.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined
    value = value[part]
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

// {{clave}} inserta el valor escapado como HTML; {{{clave}}} lo inserta tal cual (solo el JSON-LD ya serializado).
export function renderTemplate(template, context, name = 'plantilla') {
  const html = template.replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}|\{\{\s*([\w.-]+)\s*\}\}/g, (match, rawKey, key) => {
    const value = lookup(context, rawKey || key)
    if (value === undefined) throw new Error(`${name}: clave desconocida ${match}`)
    return rawKey ? value : escapeHtml(value)
  })
  const leftover = html.indexOf('{{')
  if (leftover >= 0) throw new Error(`${name}: quedó un marcador sin resolver: ${html.slice(leftover, leftover + 60)}`)
  return html
}

function validateCatalog() {
  const errors = []
  const requiredFields = ['slug', 'name', 'group', 'shortDescription', 'seoDescription', 'heroTitle', 'heroBody', 'heroImage', 'tasks', 'workflow', 'gallery', 'roles', 'connections', 'whatsappMessage']
  const slugs = new Set()
  const groupNames = new Set(moduleGroups.map(({ name }) => name))

  for (const module of modules) {
    for (const field of requiredFields) {
      if (module[field] === undefined || module[field] === null || module[field] === '') errors.push(`${module.slug || 'módulo sin slug'}: falta ${field}`)
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(module.slug)) errors.push(`${module.slug}: slug inválido`)
    if (slugs.has(module.slug)) errors.push(`${module.slug}: slug duplicado`)
    slugs.add(module.slug)
    if (!groupNames.has(module.group)) errors.push(`${module.slug}: grupo inexistente`)
    if (module.tasks.length !== 3) errors.push(`${module.slug}: deben existir tres tareas`)
    if (module.workflow.length !== 3) errors.push(`${module.slug}: el flujo debe tener tres pasos`)
    if (module.gallery.length !== 2) errors.push(`${module.slug}: deben existir dos vistas de galería`)

    for (const image of [module.heroImage, ...module.gallery]) {
      if (!image?.src || !image?.alt || !image?.width || !image?.height) errors.push(`${module.slug}: imagen incompleta`)
      else if (!existsSync(join(sourceRoot, image.src.replace(/^\//, '')))) errors.push(`${module.slug}: no existe ${image.src}`)
    }
  }

  for (const group of moduleGroups) {
    for (const slug of group.slugs) {
      if (!slugs.has(slug)) errors.push(`${group.name}: conexión a módulo inexistente ${slug}`)
    }
  }

  for (const module of modules) {
    for (const connection of module.connections) {
      if (!slugs.has(connection.slug)) errors.push(`${module.slug}: conexión inválida ${connection.slug}`)
      if (connection.slug === module.slug) errors.push(`${module.slug}: no puede conectarse consigo mismo`)
    }
  }

  const groupedSlugs = moduleGroups.flatMap(({ slugs: values }) => values)
  if (groupedSlugs.length !== modules.length || new Set(groupedSlugs).size !== modules.length) errors.push('Cada módulo debe aparecer una sola vez en el hub')
  if (new Set(modules.map(({ heroImage }) => heroImage.src)).size !== modules.length) errors.push('Cada módulo debe tener un hero visual propio')
  if (modules.find(({ slug }) => slug === 'gestion')?.connections.length !== 0) errors.push('Gestión no debe declarar conexiones transversales')

  validateLocales(errors)

  if (errors.length) throw new Error(`Catálogo inválido:\n- ${errors.join('\n- ')}`)
}

function emptyStrings(value, path) {
  if (typeof value === 'string') return value.trim() ? [] : [path]
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => emptyStrings(child, `${path}.${key}`))
  return []
}

function sameLength(errors, label, actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) errors.push(`${label}: debe tener ${expected.length} elementos`)
}

// Cada idioma traduce todo el catálogo con la misma forma que el español.
function validateLocales(errors) {
  const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  const anchorKeys = Object.keys(sourceLocale.anchors).sort().join()
  const codes = new Set()
  for (const locale of locales) {
    const label = locale.code
    if (codes.has(locale.code)) errors.push(`${label}: código de idioma duplicado`)
    codes.add(locale.code)
    // basePath y homeAssetBase quedan vacíos en español a propósito: se publica en la raíz.
    for (const key of ['ui', 'home', 'anchors', 'groups', 'modules']) for (const path of emptyStrings(locale[key], `${label}.${key}`)) errors.push(`${path}: texto vacío`)
    if (Object.keys(locale.anchors || {}).sort().join() !== anchorKeys) errors.push(`${label}: anchors debe tener las mismas claves que es`)
    const anchors = Object.values(locale.anchors || {})
    if (new Set(anchors).size !== anchors.length || anchors.some((anchor) => !idPattern.test(anchor))) errors.push(`${label}: anchors inválidos o repetidos`)
    if (locale === sourceLocale) continue

    for (const group of moduleGroups) {
      if (!locale.groups?.[group.id]?.name || !locale.groups[group.id].description) errors.push(`${label}: falta el grupo ${group.id}`)
    }
    const extra = Object.keys(locale.modules || {}).filter((id) => !modules.some(({ slug }) => slug === id))
    if (extra.length) errors.push(`${label}: módulos inexistentes ${extra.join(', ')}`)

    const slugs = new Set()
    for (const base of modules) {
      const text = locale.modules?.[base.slug]
      const where = `${label}.modules.${base.slug}`
      if (!text) { errors.push(`${where}: falta la traducción`); continue }
      for (const field of ['slug', 'name', 'shortDescription', 'seoDescription', 'heroTitle', 'heroBody', 'whatsappMessage']) {
        if (typeof text[field] !== 'string') errors.push(`${where}: falta ${field}`)
      }
      if (!idPattern.test(text.slug || '')) errors.push(`${where}: slug inválido`)
      if (slugs.has(text.slug)) errors.push(`${where}: slug duplicado ${text.slug}`)
      slugs.add(text.slug)
      if (typeof text.heroImage?.alt !== 'string') errors.push(`${where}: falta heroImage.alt`)
      sameLength(errors, `${where}.tasks`, text.tasks, base.tasks)
      sameLength(errors, `${where}.workflow`, text.workflow, base.workflow)
      sameLength(errors, `${where}.gallery`, text.gallery, base.gallery)
      sameLength(errors, `${where}.roles`, text.roles, base.roles)
      for (const item of [...(text.tasks || []), ...(text.workflow || [])]) if (typeof item?.title !== 'string' || typeof item?.body !== 'string') errors.push(`${where}: tarea o paso incompleto`)
      for (const item of text.gallery || []) if (typeof item?.alt !== 'string' || typeof item?.caption !== 'string') errors.push(`${where}: vista de galería incompleta`)
      for (const item of text.roles || []) if (typeof item?.name !== 'string' || typeof item?.body !== 'string') errors.push(`${where}: rol incompleto`)
      const expectedConnections = base.connections.map(({ slug }) => slug).sort().join()
      if (Object.keys(text.connections || {}).sort().join() !== expectedConnections) errors.push(`${where}: las conexiones deben ser las mismas que en es`)
      if (base.internalAreas) {
        sameLength(errors, `${where}.internalAreas`, text.internalAreas, base.internalAreas)
        for (const item of text.internalAreas || []) if (typeof item?.title !== 'string' || typeof item?.body !== 'string') errors.push(`${where}: área incompleta`)
      } else if (text.internalAreas) errors.push(`${where}: internalAreas solo existe en gestion`)
    }
  }
}

function imageMarkup(locale, image, { eager = false, className = '' } = {}) {
  return `<button class="image-zoom-trigger" type="button" data-image-zoom aria-label="${escapeHtml(locale.ui.imageZoom.label)} ${escapeHtml(image.alt)}"><img${className ? ` class="${className}"` : ''} src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></button>`
}

function imageLightbox(locale) {
  const { lightbox } = locale.ui
  return `<dialog class="image-lightbox" aria-label="${escapeHtml(lightbox.label)}">
    <button class="image-lightbox__close" type="button" aria-label="${escapeHtml(lightbox.close)}">×</button>
    <figure><img class="image-lightbox__image" src="" alt=""><figcaption class="image-lightbox__caption"></figcaption></figure>
  </dialog>`
}

function header(locale, page) {
  const { ui, anchors } = locale
  const home = homeUrl(locale)
  return `<header class="site-header" id="${anchors.top}">
    <div class="container site-header__inner">
      <a class="brand" href="${home}" aria-label="${escapeHtml(ui.brand.homeLabel)}">
        <img class="brand__icon" src="/assets/Logo_farmIA__icono___1___4_-removebg-preview.png" alt="" width="40" height="40">
        <img class="brand__wordmark" src="/assets/logo-farmia-wordmark-official.png" alt="${escapeHtml(site.name)}" width="218" height="52">
      </a>
      <button class="nav-toggle" type="button" aria-label="${escapeHtml(ui.nav.openMenu)}" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span></button>
      <nav class="site-nav" id="site-nav" aria-label="${escapeHtml(ui.nav.label)}">
        <ul class="site-nav__list">
          <li><a class="nav-link" href="${home}#${anchors.platform}">${escapeHtml(ui.nav.platform)}</a></li>
          <li><a class="nav-link" href="${home}#${anchors.howItHelps}">${escapeHtml(ui.nav.howItHelps)}</a></li>
          <li><a class="nav-link is-active" href="${home}#${anchors.modules}">${escapeHtml(ui.nav.modules)}</a></li>
          <li><a class="nav-link" href="${home}#${anchors.clients}">${escapeHtml(ui.nav.clients)}</a></li>
        </ul>
        <div class="site-nav__actions">
          ${languageSwitcher(locale, page, 'header')}
          <a class="button button--app button--small" href="${site.loginUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.nav.app)}</a>
          <a class="button button--primary button--small" href="${site.bookingUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.cta.bookDemo)}</a>
        </div>
      </nav>
    </div>
  </header>`
}

function footer(locale, page) {
  const { ui, anchors } = locale
  const home = homeUrl(locale)
  const whatsapp = whatsappUrl(ui.whatsappMessage)
  return `<footer class="site-footer">
    <div class="container site-footer__grid">
      <div class="site-footer__brand">
        <a class="brand brand--footer" href="${home}" aria-label="${escapeHtml(ui.brand.homeLabel)}"><img class="brand__icon" src="/assets/Logo_farmIA__icono___1___4_-removebg-preview.png" alt="" width="40" height="40"><img class="brand__wordmark" src="/assets/logo-farmia-wordmark-official.png" alt="${escapeHtml(site.name)}" width="218" height="52" loading="lazy" decoding="async"></a>
        <p>${escapeHtml(ui.footer.tagline)}</p>
      </div>
      <nav class="site-footer__links" aria-label="${escapeHtml(ui.footer.product)}"><strong>${escapeHtml(ui.footer.product)}</strong><a href="${home}#${anchors.howItHelps}">${escapeHtml(ui.nav.howItHelps)}</a><a href="${home}#${anchors.modules}">${escapeHtml(ui.nav.modules)}</a><a href="${home}#${anchors.faq}">${escapeHtml(ui.footer.faq)}</a><a href="${site.loginUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.nav.app)}</a></nav>
      <nav class="site-footer__links" aria-label="${escapeHtml(ui.footer.contact)}"><strong>${escapeHtml(ui.footer.contact)}</strong><a href="mailto:${site.email}">${site.email}</a><a href="${whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a><a href="${site.linkedinUrl}" target="_blank" rel="noopener noreferrer">LinkedIn</a></nav>
    </div>
    <div class="container site-footer__bottom"><span>© <span data-current-year>2026</span> FarmIA Solutions.</span><div>${languageSwitcher(locale, page, 'footer')}<span>D‑U‑N‑S: ${site.duns}</span><a href="${site.privacyUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.footer.privacy)}</a></div></div>
  </footer>`
}

function documentShell(locale, { page, title, description, image, jsonLd, body, bodyClass = '' }) {
  const canonical = `${site.origin}${pageUrl(locale, page)}`
  const ogImage = `${site.origin}${image}`
  return `<!DOCTYPE html>
<html lang="${locale.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#1a9850">
  <link rel="canonical" href="${canonical}">
  ${alternateLinks(page).join('\n  ')}
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:locale" content="${locale.ogLocale}">
  ${ogLocaleAlternates(locale).join('\n  ')}
  <link rel="icon" type="image/png" href="/assets/favicon.png?v=20260901-1">
  <link rel="preload" href="/assets/fonts/roboto-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/logo-farmia-wordmark-official.png" as="image" type="image/png">
  <link rel="preload" href="${image}" as="image" type="image/webp">
  <link rel="stylesheet" href="/styles.css?v=${assetVersions.styles}">
  <link rel="stylesheet" href="/module-pages.css?v=20260831-4">
  <title>${escapeHtml(title)}</title>
  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2).replaceAll('<', '\\u003c')}</script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  <a class="skip-link" href="#${locale.anchors.content}">${escapeHtml(locale.ui.skipLink)}</a>
  ${header(locale, page)}
  ${body}
  ${imageLightbox(locale)}
  ${footer(locale, page)}
  <script src="/script.js?v=${assetVersions.script}"></script>
</body>
</html>
`
}

function hubPage(locale) {
  const { hub } = locale.ui
  const home = homeUrl(locale)
  const target = `${home}#${locale.anchors.modules}`
  return `<!DOCTYPE html>
<html lang="${locale.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${target}">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${site.origin}${home}">
  <title>${escapeHtml(hub.title)}</title>
  <script>location.replace('${target}')</script>
</head>
<body><p>${escapeHtml(hub.body)} <a href="${target}">${escapeHtml(hub.link)}</a>.</p></body>
</html>
`
}

function mobileStoreDownload(locale) {
  const { store } = locale.ui
  const urls = storeUrls(locale)
  return `<aside class="module-store-download" aria-label="${escapeHtml(store.label)}">
    <strong>${escapeHtml(store.title)}</strong>
    <div class="store-badges">
      <a class="store-badge store-badge--app-store" href="${escapeHtml(urls.appStore)}" target="_blank" rel="noopener noreferrer"><img src="/${store.appStoreBadge}" alt="${escapeHtml(store.appStoreAlt)}" width="120" height="40" decoding="async"></a>
      <a class="store-badge store-badge--google-play" href="${escapeHtml(urls.googlePlay)}" target="_blank" rel="noopener noreferrer"><img src="/${store.googlePlayBadge}" alt="${escapeHtml(store.googlePlayAlt)}" width="135" height="52" decoding="async"></a>
    </div>
    <p class="store-download__note">${escapeHtml(store.note)}</p>
  </aside>`
}

function detailPage(locale, module) {
  const { ui, anchors } = locale
  const id = moduleId(module)
  const currentPage = { kind: 'module', id }
  const catalog = localizedCatalog(locale)
  const page = ui.modulePage
  const home = homeUrl(locale)
  const url = moduleUrl(locale, module)
  const tasks = module.tasks.map((task, index) => `<article class="module-task reveal"><span>0${index + 1}</span><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.body)}</p></article>`).join('\n')
  const gallery = module.gallery.map((image) => {
    const presentation = image.presentation || (image.height > image.width ? 'portrait' : '')
    const media = presentation === 'phone' ? `<div class="module-phone-frame">${imageMarkup(locale, image)}</div>` : imageMarkup(locale, image)
    return `<figure class="module-gallery__item reveal${presentation ? ` module-gallery__item--${presentation}` : ''}">${media}<figcaption>${escapeHtml(image.caption)}</figcaption></figure>`
  }).join('\n')
  const demoHref = site.bookingUrl
  const whatsappHref = whatsappUrl(module.whatsappMessage)
  const bookDemo = escapeHtml(ui.cta.bookDemo)
  const talkWhatsapp = escapeHtml(ui.cta.whatsapp)
  const storeDownload = id === 'monitoreo' ? mobileStoreDownload(locale) : ''
  const connectionSection = id === 'gestion'
    ? `<section class="section module-areas"><div class="container"><div class="module-section-heading reveal"><span class="eyebrow">${escapeHtml(page.areasEyebrow)}</span><h2>${escapeHtml(page.areasTitle)}</h2><p>${escapeHtml(page.areasBody)}</p></div><div class="module-areas__grid">${module.internalAreas.map((area) => `<article class="reveal"><h3>${escapeHtml(area.title)}</h3><p>${escapeHtml(area.body)}</p></article>`).join('')}</div></div></section>`
    : `<section class="section module-connections"><div class="container"><div class="module-connections__heading reveal"><span class="eyebrow">${escapeHtml(page.connectionsEyebrow)}</span><p>${escapeHtml(page.connectionsBody)}</p></div><div class="module-connections__grid">${module.connections.map((connection) => { const related = catalog.modules.find((candidate) => moduleId(candidate) === connection.slug); return `<a class="module-connection reveal" href="${moduleUrl(locale, related)}"><span>${escapeHtml(related.group)}</span><h3>${escapeHtml(related.name)} <i aria-hidden="true">→</i></h3></a>` }).join('')}</div></div></section>`

  const body = `<main id="${anchors.content}">
    <section class="module-hero">
      <div class="container">
        <nav class="breadcrumb" aria-label="${escapeHtml(ui.breadcrumb.label)}"><a href="${home}">${escapeHtml(ui.breadcrumb.home)}</a><span aria-hidden="true">/</span><a href="${home}#${anchors.modules}">${escapeHtml(ui.nav.modules)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(module.name)}</span></nav>
        <div class="module-hero__grid">
          <div class="module-hero__copy"><span class="eyebrow">${escapeHtml(module.name)}</span><h1>${escapeHtml(module.heroTitle)}</h1><p>${escapeHtml(module.heroBody)}</p><div class="module-hero__actions"><a class="button button--primary" href="${demoHref}" target="_blank" rel="noopener noreferrer">${bookDemo}</a><a class="button button--whatsapp" href="${whatsappHref}" target="_blank" rel="noopener noreferrer">${talkWhatsapp}</a></div>${storeDownload}</div>
          <figure class="module-hero__media${module.heroImage.presentation ? ` module-hero__media--${module.heroImage.presentation}` : module.heroImage.height > module.heroImage.width ? ' module-hero__media--portrait' : ''}"><div class="product-window__bar" aria-hidden="true"><span></span><span></span><span></span><small>${escapeHtml(page.productWindow)}</small></div>${imageMarkup(locale, module.heroImage, { eager: true })}</figure>
        </div>
      </div>
    </section>
    <section class="section module-tasks"><div class="container"><div class="module-section-heading reveal"><span class="eyebrow">${escapeHtml(page.tasksEyebrow)}</span><h2>${escapeHtml(page.tasksTitle)}</h2></div><div class="module-tasks__grid">${tasks}</div></div></section>
    <section class="section module-gallery"><div class="container"><div class="module-section-heading reveal"><span class="eyebrow">${escapeHtml(page.galleryEyebrow)}</span><h2>${escapeHtml(page.galleryTitle)}</h2></div><div class="module-gallery__grid">${gallery}</div></div></section>
    ${connectionSection}
    <section class="module-cta"><div class="container module-cta__inner"><div><span class="eyebrow eyebrow--light">${escapeHtml(format(page.ctaEyebrow, { module: module.name }))}</span><h2>${escapeHtml(page.ctaTitle)}</h2><p>${escapeHtml(page.ctaBody)}</p></div><div class="module-cta__actions"><a class="button button--primary" href="${demoHref}" target="_blank" rel="noopener noreferrer">${bookDemo}</a><a class="button button--ghost-light" href="${whatsappHref}" target="_blank" rel="noopener noreferrer">${talkWhatsapp}</a></div></div></section>
  </main>`

  return documentShell(locale, {
    page: currentPage,
    title: `${module.name} | FarmIA`,
    description: module.seoDescription,
    image: module.heroImage.src,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'SoftwareApplication', name: `FarmIA · ${module.name}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android, iOS', description: module.seoDescription, url: `${site.origin}${url}` },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: ui.breadcrumb.home, item: `${site.origin}${home}` },
          { '@type': 'ListItem', position: 2, name: ui.nav.modules, item: `${site.origin}${home}#${anchors.modules}` },
          { '@type': 'ListItem', position: 3, name: module.name, item: `${site.origin}${url}` },
        ] },
      ],
    },
    body,
    bodyClass: 'modules-page module-detail-page',
  })
}

function homeContext(locale) {
  const home = homeUrl(locale)
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: `${site.origin}${home}`,
    logo: `${site.origin}/assets/logo-icon.png`,
    email: site.email,
    duns: site.duns,
    sameAs: [site.instagramUrl, site.linkedinUrl],
  }
  // Mismo sangrado que el bloque <script> de la plantilla.
  const jsonLd = JSON.stringify(organization, null, 2).replaceAll('<', '\\u003c').split('\n').map((line) => `    ${line}`).join('\n')

  const page = { kind: 'home' }
  return {
    ...locale,
    site,
    storeUrls: storeUrls(locale),
    assetVersions,
    // Mismo sangrado que las líneas del <head> en la plantilla.
    headLinks: [`<link rel="canonical" href="${site.origin}${home}">`, ...alternateLinks(page)].join('\n  '),
    ogLocaleAlternates: ogLocaleAlternates(locale).join('\n  '),
    languageSwitcherHeader: languageSwitcher(locale, page, 'header'),
    languageSwitcherFooter: languageSwitcher(locale, page, 'footer'),
    assetBase: locale.homeAssetBase,
    homeUrl: home,
    homeAbsoluteUrl: `${site.origin}${home}`,
    whatsappUrl: whatsappUrl(locale.ui.whatsappMessage),
    jsonLd,
    modules: Object.fromEntries(localizedCatalog(locale).modules.map((module) => [moduleId(module), { name: module.name, url: moduleUrl(locale, module) }])),
  }
}

export function homePage(locale) {
  return renderTemplate(readFileSync(homeTemplatePath, 'utf8'), homeContext(locale), 'templates/home.html')
}

function sitemap() {
  const urls = locales.flatMap((locale) => [
    `${site.origin}${homeUrl(locale)}`,
    ...localizedCatalog(locale).modules.map((module) => `${site.origin}${moduleUrl(locale, module)}`),
  ])
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`
}

export function expectedFiles() {
  return new Map([
    ...locales.flatMap((locale) => [
      [outputPath(homeUrl(locale)), homePage(locale)],
      [outputPath(modulesUrl(locale)), hubPage(locale)],
      ...localizedCatalog(locale).modules.map((module) => [outputPath(moduleUrl(locale, module)), detailPage(locale, module)]),
    ]),
    ['sitemap.xml', sitemap()],
  ])
}

function writeOrCheck(files) {
  const differences = []
  for (const [relativePath, content] of files) {
    const target = join(outputRoot, relativePath)
    if (checkOnly) {
      if (!existsSync(target)) differences.push(`Faltan ${relativePath}`)
      else if (readFileSync(target, 'utf8') !== content) differences.push(`Está desactualizado ${relativePath}`)
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf8')
  }

  if (differences.length) {
    console.error(differences.join('\n'))
    process.exitCode = 1
  } else if (checkOnly) {
    console.log('El sitio generado está actualizado.')
  } else {
    console.log(`Sitio generado: ${files.size - 1} páginas y sitemap.xml.`)
  }
}

// Solo corre al ejecutarse como script; los tests importan renderTemplate y expectedFiles.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    validateCatalog()
    writeOrCheck(expectedFiles())
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
