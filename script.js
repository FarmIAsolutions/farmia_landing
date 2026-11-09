(function () {
  'use strict'

  document.documentElement.classList.add('js-ready')

  // Mensajes de la interfaz por idioma (las dos primeras letras de <html lang>); español por defecto.
  // Los textos de "Abrir menú" coinciden con ui.nav.openMenu de content/i18n/<idioma>.mjs.
  const messages = {
    es: {
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      invalid: 'Completá tu nombre y un email válido para continuar.',
      sending: 'Enviando solicitud…',
      success: 'Recibimos tu solicitud. Te vamos a contactar para coordinar la demo.',
      failure: 'No pudimos enviar la solicitud. Podés intentar de nuevo o escribirnos por WhatsApp.',
    },
    en: {
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      invalid: 'Enter your name and a valid email to continue.',
      sending: 'Sending request…',
      success: 'We received your request. We’ll be in touch to schedule the demo.',
      failure: 'We couldn’t send your request. Try again or message us on WhatsApp.',
    },
    pt: {
      openMenu: 'Abrir menu',
      closeMenu: 'Fechar menu',
      invalid: 'Preencha seu nome e um e-mail válido para continuar.',
      sending: 'Enviando solicitação…',
      success: 'Recebemos a sua solicitação. Vamos entrar em contato para combinar a demo.',
      failure: 'Não foi possível enviar a solicitação. Tente novamente ou fale com a gente pelo WhatsApp.',
    },
  }
  const language = String(document.documentElement.lang || '').slice(0, 2).toLowerCase()
  const text = messages[language] || messages.es

  const header = document.querySelector('.site-header')
  const navToggle = document.querySelector('.nav-toggle')
  const nav = document.querySelector('.site-nav')
  const navLinks = document.querySelectorAll('.nav-link')
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const desktopNavigation = window.matchMedia('(min-width: 961px)')
  const languageMenu = document.querySelector('.language-menu')

  // El selector de idioma es un <details>: abre y cierra solo. Esto suma el cierre por Escape
  // (devolviendo el foco al botón), por clic o foco afuera y al abrir el menú móvil.
  function closeLanguageMenu(returnFocus) {
    if (!languageMenu || !languageMenu.open) return
    languageMenu.open = false
    if (!returnFocus) return
    const summary = languageMenu.querySelector('summary')
    if (summary) summary.focus()
  }

  if (languageMenu) {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && languageMenu.open) closeLanguageMenu(true)
    })

    document.addEventListener('click', (event) => {
      if (languageMenu.open && !languageMenu.contains(event.target)) closeLanguageMenu(false)
    })

    languageMenu.addEventListener('focusout', (event) => {
      if (event.relatedTarget && !languageMenu.contains(event.relatedTarget)) closeLanguageMenu(false)
    })
  }

  function setMenu(open) {
    if (open) closeLanguageMenu(false)
    if (!navToggle || !nav) return

    navToggle.classList.toggle('is-open', open)
    nav.classList.toggle('is-open', open)
    navToggle.setAttribute('aria-expanded', String(open))
    navToggle.setAttribute('aria-label', open ? text.closeMenu : text.openMenu)
    document.body.classList.toggle('menu-open', open)
  }

  if (navToggle && nav) {
    if (desktopNavigation.matches) setMenu(false)

    navToggle.addEventListener('click', () => {
      setMenu(!nav.classList.contains('is-open'))
    })

    desktopNavigation.addEventListener('change', (event) => {
      if (event.matches) setMenu(false)
    })

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setMenu(false)
    })

    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return
      if (nav.contains(event.target) || navToggle.contains(event.target)) return
      setMenu(false)
    })
  }

  function scrollToSection(target, behavior = prefersReducedMotion ? 'auto' : 'smooth') {
    const offset = (header ? header.offsetHeight : 0) + 10
    const top = target.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top: Math.max(top, 0), behavior })
  }

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]')
    if (!anchor) return

    const href = anchor.getAttribute('href')
    if (!href || href === '#') return

    const target = document.querySelector(href)
    if (!target) return

    event.preventDefault()
    setMenu(false)
    scrollToSection(target)
    window.history.pushState(null, '', href)
  })

  function updateHeader() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 12)
  }

  window.addEventListener('scroll', updateHeader, { passive: true })
  updateHeader()

  const sections = [...document.querySelectorAll('main section[id]')]

  function updateActiveNavigation() {
    if (!sections.length) return

    const position = window.scrollY + (header ? header.offsetHeight : 0) + 120
    let activeId = sections[0].id

    sections.forEach((section) => {
      if (position >= section.offsetTop) activeId = section.id
    })

    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${activeId}`)
    })
  }

  window.addEventListener('scroll', updateActiveNavigation, { passive: true })
  updateActiveNavigation()

  const revealElements = document.querySelectorAll('.reveal')

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('is-visible'))
  } else {
    const observer = new IntersectionObserver((entries, revealObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        revealObserver.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.08 })

    revealElements.forEach((element) => observer.observe(element))
  }

  const lightbox = document.querySelector('.image-lightbox')
  const zoomTriggers = document.querySelectorAll('[data-image-zoom]')
  let activeZoomTrigger = null

  if (lightbox && zoomTriggers.length) {
    const lightboxImage = lightbox.querySelector('.image-lightbox__image')
    const lightboxCaption = lightbox.querySelector('.image-lightbox__caption')
    const closeButton = lightbox.querySelector('.image-lightbox__close')

    function closeLightbox() {
      if (lightbox.open) lightbox.close()
    }

    zoomTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault()
        const sourceImage = trigger.querySelector('img')
        if (!sourceImage || !lightboxImage || !lightboxCaption) return

        activeZoomTrigger = trigger
        lightboxImage.src = sourceImage.currentSrc || sourceImage.src
        lightboxImage.alt = sourceImage.alt || ''
        lightboxCaption.textContent = sourceImage.alt || ''
        document.body.classList.add('lightbox-open')
        lightbox.showModal()
      })
    })

    if (closeButton) closeButton.addEventListener('click', closeLightbox)

    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox()
    })

    lightbox.addEventListener('close', () => {
      document.body.classList.remove('lightbox-open')
      if (activeZoomTrigger) activeZoomTrigger.focus()
      activeZoomTrigger = null
    })
  }

  const form = document.querySelector('.demo-form')

  if (form) {
    const moduleInterest = form.querySelector('[name="module_interest"]')
    const requestedModule = new URLSearchParams(window.location.search).get('modulo')
    if (moduleInterest && requestedModule && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedModule)) {
      moduleInterest.value = requestedModule
    }

    const status = form.querySelector('.form-status')
    const submitButton = form.querySelector('button[type="submit"]')

    form.addEventListener('submit', async (event) => {
      event.preventDefault()

      if (!form.checkValidity()) {
        form.reportValidity()
        if (status) {
          status.textContent = text.invalid
          status.classList.remove('is-success')
          status.classList.add('is-error')
        }
        return
      }

      const originalText = submitButton ? submitButton.textContent : ''
      form.setAttribute('aria-busy', 'true')

      if (submitButton) {
        submitButton.disabled = true
        submitButton.textContent = text.sending
      }

      if (status) {
        status.textContent = ''
        status.classList.remove('is-success', 'is-error')
      }

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        })

        if (!response.ok) throw new Error('Formspree rejected the request')

        form.reset()
        if (status) {
          status.textContent = text.success
          status.classList.add('is-success')
        }
      } catch (error) {
        if (status) {
          status.textContent = text.failure
          status.classList.add('is-error')
        }
      } finally {
        form.removeAttribute('aria-busy')
        if (submitButton) {
          submitButton.disabled = false
          submitButton.textContent = originalText
        }
      }
    })
  }

  const year = document.querySelector('[data-current-year]')
  if (year) year.textContent = String(new Date().getFullYear())

  if (window.location.hash) {
    window.addEventListener('load', () => {
      const target = document.querySelector(window.location.hash)
      if (target) scrollToSection(target, 'auto')
    }, { once: true })
  }
})()
