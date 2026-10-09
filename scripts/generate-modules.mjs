import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { moduleGroups, modules, site } from '../content/modules.mjs'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const rootIndex = args.indexOf('--root')
const outputRoot = rootIndex >= 0 ? resolve(args[rootIndex + 1] || '') : sourceRoot

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
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

function imageMarkup(image, { eager = false, className = '' } = {}) {
  return `<button class="image-zoom-trigger" type="button" data-image-zoom aria-label="Ampliar imagen: ${escapeHtml(image.alt)}"><img${className ? ` class="${className}"` : ''} src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></button>`
}

function imageLightbox() {
  return `<dialog class="image-lightbox" aria-label="Vista ampliada de producto">
    <button class="image-lightbox__close" type="button" aria-label="Cerrar imagen ampliada">×</button>
    <figure><img class="image-lightbox__image" src="" alt=""><figcaption class="image-lightbox__caption"></figcaption></figure>
  </dialog>`
}

function header() {
  return `<header class="site-header" id="inicio">
    <div class="container site-header__inner">
      <a class="brand" href="/" aria-label="FarmIA, ir al inicio">
        <img class="brand__icon" src="/assets/Logo_farmIA__icono___1___4_-removebg-preview.png" alt="" width="40" height="40">
        <img class="brand__wordmark" src="/assets/logo-farmia-wordmark-official.png" alt="FarmIA" width="218" height="52">
      </a>
      <button class="nav-toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span></button>
      <nav class="site-nav" id="site-nav" aria-label="Navegación principal">
        <ul class="site-nav__list">
          <li><a class="nav-link" href="/#plataforma">Plataforma</a></li>
          <li><a class="nav-link" href="/#como-ayuda">Cómo ayuda</a></li>
          <li><a class="nav-link is-active" href="/#modulos">Módulos</a></li>
          <li><a class="nav-link" href="/#clientes">Clientes</a></li>
        </ul>
        <div class="site-nav__actions">
          <a class="button button--app button--small" href="${site.loginUrl}" target="_blank" rel="noopener noreferrer">Ir a la app</a>
          <a class="button button--primary button--small" href="${site.bookingUrl}" target="_blank" rel="noopener noreferrer">Agendar una demo</a>
        </div>
      </nav>
    </div>
  </header>`
}

function footer() {
  const whatsapp = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent('Hola, quiero conocer FarmIA y agendar una demo.')}`
  return `<footer class="site-footer">
    <div class="container site-footer__grid">
      <div class="site-footer__brand">
        <a class="brand brand--footer" href="/" aria-label="FarmIA, ir al inicio"><img class="brand__icon" src="/assets/Logo_farmIA__icono___1___4_-removebg-preview.png" alt="" width="40" height="40"><img class="brand__wordmark" src="/assets/logo-farmia-wordmark-official.png" alt="FarmIA" width="218" height="52" loading="lazy" decoding="async"></a>
        <p>Toda la información de tu empresa agropecuaria en un solo lugar.</p>
      </div>
      <nav class="site-footer__links" aria-label="Producto"><strong>Producto</strong><a href="/#como-ayuda">Cómo ayuda</a><a href="/#modulos">Módulos</a><a href="/#preguntas-frecuentes">Preguntas frecuentes</a><a href="${site.loginUrl}" target="_blank" rel="noopener noreferrer">Ir a la app</a></nav>
      <nav class="site-footer__links" aria-label="Contacto"><strong>Contacto</strong><a href="mailto:${site.email}">${site.email}</a><a href="${whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="${site.instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a><a href="${site.linkedinUrl}" target="_blank" rel="noopener noreferrer">LinkedIn</a></nav>
    </div>
    <div class="container site-footer__bottom"><span>© <span data-current-year>2026</span> FarmIA Solutions. Nombre comercial de CACICU 26 S.A.</span><div><span>D‑U‑N‑S: ${site.duns}</span><a href="${site.privacyUrl}" target="_blank" rel="noopener noreferrer">Privacidad</a></div></div>
  </footer>`
}

function documentShell({ title, description, canonicalPath, image, jsonLd, body, bodyClass = '' }) {
  const canonical = `${site.origin}${canonicalPath}`
  const ogImage = `${site.origin}${image}`
  return `<!DOCTYPE html>
<html lang="es-AR">
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
  <meta property="og:locale" content="es_AR">
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
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  ${header()}
  ${body}
  ${imageLightbox()}
  ${footer()}
  <script src="/script.js?v=20260901-1"></script>
</body>
</html>
`
}

function hubPage() {
  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=/#modulos">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${site.origin}/">
  <title>Módulos de FarmIA</title>
  <script>location.replace('/#modulos')</script>
</head>
<body><p>Los módulos de FarmIA ahora están en la página principal. <a href="/#modulos">Ver módulos</a>.</p></body>
</html>
`
}

function mobileStoreDownload() {
  return `<aside class="module-store-download" aria-label="Descargar FarmIA Mobile">
    <strong>FarmIA Mobile en tu teléfono</strong>
    <div class="store-badges">
      <a class="store-badge store-badge--app-store" href="${site.appStoreUrl}" target="_blank" rel="noopener noreferrer"><img src="/assets/store/app-store-badge-es.svg" alt="Descargar FarmIA en App Store" width="120" height="40" decoding="async"></a>
      <a class="store-badge store-badge--google-play" href="${site.googlePlayUrl}" target="_blank" rel="noopener noreferrer"><img src="/assets/store/google-play-badge-es.png" alt="Descargar FarmIA en Google Play" width="135" height="52" decoding="async"></a>
    </div>
    <p class="store-download__note">App complementaria para clientes de FarmIA.</p>
  </aside>`
}

function detailPage(module) {
  const tasks = module.tasks.map((task, index) => `<article class="module-task reveal"><span>0${index + 1}</span><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.body)}</p></article>`).join('\n')
  const gallery = module.gallery.map((image) => {
    const presentation = image.presentation || (image.height > image.width ? 'portrait' : '')
    const media = presentation === 'phone' ? `<div class="module-phone-frame">${imageMarkup(image)}</div>` : imageMarkup(image)
    return `<figure class="module-gallery__item reveal${presentation ? ` module-gallery__item--${presentation}` : ''}">${media}<figcaption>${escapeHtml(image.caption)}</figcaption></figure>`
  }).join('\n')
  const demoHref = site.bookingUrl
  const whatsappHref = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(module.whatsappMessage)}`
  const storeDownload = module.slug === 'monitoreo' ? mobileStoreDownload() : ''
  const connectionSection = module.slug === 'gestion'
    ? `<section class="section module-areas"><div class="container"><div class="module-section-heading reveal"><span class="eyebrow">Áreas de Gestión</span><h2>Una visión amplia de la operación.</h2><p>Gestión reúne áreas que hoy ya ayudan a ordenar el trabajo productivo, administrativo y económico.</p></div><div class="module-areas__grid">${module.internalAreas.map((area) => `<article class="reveal"><h3>${escapeHtml(area.title)}</h3><p>${escapeHtml(area.body)}</p></article>`).join('')}</div></div></section>`
    : `<section class="section module-connections"><div class="container"><div class="module-connections__heading reveal"><span class="eyebrow">También se conecta con</span><p>El contexto del lote continúa en otros módulos técnicos.</p></div><div class="module-connections__grid">${module.connections.map((connection) => { const related = modules.find(({ slug }) => slug === connection.slug); return `<a class="module-connection reveal" href="/modulos/${related.slug}/"><span>${escapeHtml(related.group)}</span><h3>${escapeHtml(related.name)} <i aria-hidden="true">→</i></h3></a>` }).join('')}</div></div></section>`

  const body = `<main id="contenido">
    <section class="module-hero">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Inicio</a><span aria-hidden="true">/</span><a href="/#modulos">Módulos</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(module.name)}</span></nav>
        <div class="module-hero__grid">
          <div class="module-hero__copy"><span class="eyebrow">${escapeHtml(module.name)}</span><h1>${escapeHtml(module.heroTitle)}</h1><p>${escapeHtml(module.heroBody)}</p><div class="module-hero__actions"><a class="button button--primary" href="${demoHref}" target="_blank" rel="noopener noreferrer">Agendar una demo</a><a class="button button--whatsapp" href="${whatsappHref}" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a></div>${storeDownload}</div>
          <figure class="module-hero__media${module.heroImage.presentation ? ` module-hero__media--${module.heroImage.presentation}` : module.heroImage.height > module.heroImage.width ? ' module-hero__media--portrait' : ''}"><div class="product-window__bar" aria-hidden="true"><span></span><span></span><span></span><small>Vista real de FarmIA</small></div>${imageMarkup(module.heroImage, { eager: true })}</figure>
        </div>
      </div>
    </section>
    <section class="section module-tasks"><div class="container"><div class="module-section-heading reveal"><span class="eyebrow">Qué te ayuda a resolver</span><h2>Menos pasos manuales. Más contexto para decidir.</h2></div><div class="module-tasks__grid">${tasks}</div></div></section>
    <section class="section module-gallery"><div class="container"><div class="module-section-heading reveal"><span class="eyebrow">Producto real</span><h2>Dos vistas que completan el recorrido.</h2></div><div class="module-gallery__grid">${gallery}</div></div></section>
    ${connectionSection}
    <section class="module-cta"><div class="container module-cta__inner"><div><span class="eyebrow eyebrow--light">Conocé ${escapeHtml(module.name)}</span><h2>Veamos cómo encaja en tu operación.</h2><p>Agendá una demostración de 30 minutos enfocada en este módulo y en las decisiones que hoy le consumen tiempo a tu equipo.</p></div><div class="module-cta__actions"><a class="button button--primary" href="${demoHref}" target="_blank" rel="noopener noreferrer">Agendar una demo</a><a class="button button--ghost-light" href="${whatsappHref}" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a></div></div></section>
  </main>`

  return documentShell({
    title: `${module.name} | FarmIA`,
    description: module.seoDescription,
    canonicalPath: `/modulos/${module.slug}/`,
    image: module.heroImage.src,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'SoftwareApplication', name: `FarmIA · ${module.name}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android, iOS', description: module.seoDescription, url: `${site.origin}/modulos/${module.slug}/` },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${site.origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Módulos', item: `${site.origin}/#modulos` },
          { '@type': 'ListItem', position: 3, name: module.name, item: `${site.origin}/modulos/${module.slug}/` },
        ] },
      ],
    },
    body,
    bodyClass: 'modules-page module-detail-page',
  })
}

function sitemap() {
  const urls = [
    `${site.origin}/`,
    ...modules.map(({ slug }) => `${site.origin}/modulos/${slug}/`),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`
}

function expectedFiles() {
  return new Map([
    ['modulos/index.html', hubPage()],
    ...modules.map((module) => [`modulos/${module.slug}/index.html`, detailPage(module)]),
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
    console.log('El catálogo generado está actualizado.')
  } else {
    console.log(`Catálogo generado: ${files.size - 1} páginas y sitemap.xml.`)
  }
}

try {
  validateCatalog()
  writeOrCheck(expectedFiles())
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
