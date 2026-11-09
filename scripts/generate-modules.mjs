import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { moduleGroups, modules, site } from '../content/modules.mjs'
import es from '../content/i18n/es.mjs'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const rootIndex = args.indexOf('--root')
const outputRoot = rootIndex >= 0 ? resolve(args[rootIndex + 1] || '') : sourceRoot
const homeTemplatePath = join(sourceRoot, 'templates', 'home.html')

// Un objeto por idioma (content/i18n/<código>.mjs); hoy solo español, publicado en la raíz.
export const locales = [es]

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

  if (errors.length) throw new Error(`Catálogo inválido:\n- ${errors.join('\n- ')}`)
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

function header(locale) {
  const { ui } = locale
  const home = homeUrl(locale)
  return `<header class="site-header" id="inicio">
    <div class="container site-header__inner">
      <a class="brand" href="${home}" aria-label="${escapeHtml(ui.brand.homeLabel)}">
        <img class="brand__icon" src="/assets/Logo_farmIA__icono___1___4_-removebg-preview.png" alt="" width="40" height="40">
        <img class="brand__wordmark" src="/assets/logo-farmia-wordmark-official.png" alt="${escapeHtml(site.name)}" width="218" height="52">
      </a>
      <button class="nav-toggle" type="button" aria-label="${escapeHtml(ui.nav.openMenu)}" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span></button>
      <nav class="site-nav" id="site-nav" aria-label="${escapeHtml(ui.nav.label)}">
        <ul class="site-nav__list">
          <li><a class="nav-link" href="${home}#plataforma">${escapeHtml(ui.nav.platform)}</a></li>
          <li><a class="nav-link" href="${home}#como-ayuda">${escapeHtml(ui.nav.howItHelps)}</a></li>
          <li><a class="nav-link is-active" href="${home}#modulos">${escapeHtml(ui.nav.modules)}</a></li>
          <li><a class="nav-link" href="${home}#clientes">${escapeHtml(ui.nav.clients)}</a></li>
        </ul>
        <div class="site-nav__actions">
          <a class="button button--app button--small" href="${site.loginUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.nav.app)}</a>
          <a class="button button--primary button--small" href="${site.bookingUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.cta.bookDemo)}</a>
        </div>
      </nav>
    </div>
  </header>`
}

function footer(locale) {
  const { ui } = locale
  const home = homeUrl(locale)
  const whatsapp = whatsappUrl(ui.whatsappMessage)
  return `<footer class="site-footer">
    <div class="container site-footer__grid">
      <div class="site-footer__brand">
        <a class="brand brand--footer" href="${home}" aria-label="${escapeHtml(ui.brand.homeLabel)}"><img class="brand__icon" src="/assets/Logo_farmIA__icono___1___4_-removebg-preview.png" alt="" width="40" height="40"><img class="brand__wordmark" src="/assets/logo-farmia-wordmark-official.png" alt="${escapeHtml(site.name)}" width="218" height="52" loading="lazy" decoding="async"></a>
        <p>${escapeHtml(ui.footer.tagline)}</p>
      </div>
      <nav class="site-footer__links" aria-label="${escapeHtml(ui.footer.product)}"><strong>${escapeHtml(ui.footer.product)}</strong><a href="${home}#como-ayuda">${escapeHtml(ui.nav.howItHelps)}</a><a href="${home}#modulos">${escapeHtml(ui.nav.modules)}</a><a href="${home}#preguntas-frecuentes">${escapeHtml(ui.footer.faq)}</a><a href="${site.loginUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.nav.app)}</a></nav>
      <nav class="site-footer__links" aria-label="${escapeHtml(ui.footer.contact)}"><strong>${escapeHtml(ui.footer.contact)}</strong><a href="mailto:${site.email}">${site.email}</a><a href="${whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a><a href="${site.linkedinUrl}" target="_blank" rel="noopener noreferrer">LinkedIn</a></nav>
    </div>
    <div class="container site-footer__bottom"><span>© <span data-current-year>2026</span> FarmIA Solutions.</span><div><span>D‑U‑N‑S: ${site.duns}</span><a href="${site.privacyUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.footer.privacy)}</a></div></div>
  </footer>`
}

function documentShell(locale, { title, description, canonicalPath, image, jsonLd, body, bodyClass = '' }) {
  const canonical = `${site.origin}${canonicalPath}`
  const ogImage = `${site.origin}${image}`
  return `<!DOCTYPE html>
<html lang="${locale.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#1a9850">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:locale" content="${locale.ogLocale}">
  <link rel="icon" type="image/png" href="/assets/favicon.png?v=20260901-1">
  <link rel="preload" href="/assets/fonts/roboto-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/logo-farmia-wordmark-official.png" as="image" type="image/png">
  <link rel="preload" href="${image}" as="image" type="image/webp">
  <link rel="stylesheet" href="/styles.css?v=20260901-2">
  <link rel="stylesheet" href="/module-pages.css?v=20260831-4">
  <title>${escapeHtml(title)}</title>
  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2).replaceAll('<', '\\u003c')}</script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  <a class="skip-link" href="#contenido">${escapeHtml(locale.ui.skipLink)}</a>
  ${header(locale)}
  ${body}
  ${imageLightbox(locale)}
  ${footer(locale)}
  <script src="/script.js?v=20260901-1"></script>
</body>
</html>
`
}

function hubPage(locale) {
  const { hub } = locale.ui
  const home = homeUrl(locale)
  return `<!DOCTYPE html>
<html lang="${locale.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${home}#modulos">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${site.origin}${home}">
  <title>${escapeHtml(hub.title)}</title>
  <script>location.replace('${home}#modulos')</script>
</head>
<body><p>${escapeHtml(hub.body)} <a href="${home}#modulos">${escapeHtml(hub.link)}</a>.</p></body>
</html>
`
}

function mobileStoreDownload(locale) {
  const { store } = locale.ui
  return `<aside class="module-store-download" aria-label="${escapeHtml(store.label)}">
    <strong>${escapeHtml(store.title)}</strong>
    <div class="store-badges">
      <a class="store-badge store-badge--app-store" href="${site.appStoreUrl}" target="_blank" rel="noopener noreferrer"><img src="/${store.appStoreBadge}" alt="${escapeHtml(store.appStoreAlt)}" width="120" height="40" decoding="async"></a>
      <a class="store-badge store-badge--google-play" href="${site.googlePlayUrl}" target="_blank" rel="noopener noreferrer"><img src="/${store.googlePlayBadge}" alt="${escapeHtml(store.googlePlayAlt)}" width="135" height="52" decoding="async"></a>
    </div>
    <p class="store-download__note">${escapeHtml(store.note)}</p>
  </aside>`
}

function detailPage(locale, module) {
  const { ui } = locale
  const page = ui.modulePage
  const home = homeUrl(locale)
  const pageUrl = moduleUrl(locale, module)
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
  const storeDownload = module.slug === 'monitoreo' ? mobileStoreDownload(locale) : ''
  const connectionSection = module.slug === 'gestion'
    ? `<section class="section module-areas"><div class="container"><div class="module-section-heading reveal"><span class="eyebrow">${escapeHtml(page.areasEyebrow)}</span><h2>${escapeHtml(page.areasTitle)}</h2><p>${escapeHtml(page.areasBody)}</p></div><div class="module-areas__grid">${module.internalAreas.map((area) => `<article class="reveal"><h3>${escapeHtml(area.title)}</h3><p>${escapeHtml(area.body)}</p></article>`).join('')}</div></div></section>`
    : `<section class="section module-connections"><div class="container"><div class="module-connections__heading reveal"><span class="eyebrow">${escapeHtml(page.connectionsEyebrow)}</span><p>${escapeHtml(page.connectionsBody)}</p></div><div class="module-connections__grid">${module.connections.map((connection) => { const related = modules.find(({ slug }) => slug === connection.slug); return `<a class="module-connection reveal" href="${moduleUrl(locale, related)}"><span>${escapeHtml(related.group)}</span><h3>${escapeHtml(related.name)} <i aria-hidden="true">→</i></h3></a>` }).join('')}</div></div></section>`

  const body = `<main id="contenido">
    <section class="module-hero">
      <div class="container">
        <nav class="breadcrumb" aria-label="${escapeHtml(ui.breadcrumb.label)}"><a href="${home}">${escapeHtml(ui.breadcrumb.home)}</a><span aria-hidden="true">/</span><a href="${home}#modulos">${escapeHtml(ui.nav.modules)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(module.name)}</span></nav>
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
    title: `${module.name} | FarmIA`,
    description: module.seoDescription,
    canonicalPath: pageUrl,
    image: module.heroImage.src,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'SoftwareApplication', name: `FarmIA · ${module.name}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android, iOS', description: module.seoDescription, url: `${site.origin}${pageUrl}` },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: ui.breadcrumb.home, item: `${site.origin}${home}` },
          { '@type': 'ListItem', position: 2, name: ui.nav.modules, item: `${site.origin}${home}#modulos` },
          { '@type': 'ListItem', position: 3, name: module.name, item: `${site.origin}${pageUrl}` },
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

  return {
    ...locale,
    site,
    assetBase: locale.homeAssetBase,
    homeUrl: home,
    homeAbsoluteUrl: `${site.origin}${home}`,
    whatsappUrl: whatsappUrl(locale.ui.whatsappMessage),
    jsonLd,
    modules: Object.fromEntries(modules.map((module) => [module.slug, { name: module.name, url: moduleUrl(locale, module) }])),
  }
}

export function homePage(locale) {
  return renderTemplate(readFileSync(homeTemplatePath, 'utf8'), homeContext(locale), 'templates/home.html')
}

function sitemap() {
  const urls = locales.flatMap((locale) => [
    `${site.origin}${homeUrl(locale)}`,
    ...modules.map((module) => `${site.origin}${moduleUrl(locale, module)}`),
  ])
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`
}

export function expectedFiles() {
  return new Map([
    ...locales.flatMap((locale) => [
      [outputPath(homeUrl(locale)), homePage(locale)],
      [outputPath(modulesUrl(locale)), hubPage(locale)],
      ...modules.map((module) => [outputPath(moduleUrl(locale, module)), detailPage(locale, module)]),
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
