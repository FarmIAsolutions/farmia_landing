(function () {
  'use strict'

  document.documentElement.classList.add('js-ready')

  const header = document.querySelector('.site-header')
  const navToggle = document.querySelector('.nav-toggle')
  const nav = document.querySelector('.site-nav')
  const navLinks = document.querySelectorAll('.nav-link')
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const desktopNavigation = window.matchMedia('(min-width: 961px)')

  function setMenu(open) {
    if (!navToggle || !nav) return

    navToggle.classList.toggle('is-open', open)
    nav.classList.toggle('is-open', open)
    navToggle.setAttribute('aria-expanded', String(open))
    navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú')
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
          status.textContent = 'Completá tu nombre y un email válido para continuar.'
          status.classList.remove('is-success')
          status.classList.add('is-error')
        }
        return
      }

      const originalText = submitButton ? submitButton.textContent : ''
      form.setAttribute('aria-busy', 'true')

      if (submitButton) {
        submitButton.disabled = true
        submitButton.textContent = 'Enviando solicitud…'
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
          status.textContent = 'Recibimos tu solicitud. Te vamos a contactar para coordinar la demo.'
          status.classList.add('is-success')
        }
      } catch (error) {
        if (status) {
          status.textContent = 'No pudimos enviar la solicitud. Podés intentar de nuevo o escribirnos por WhatsApp.'
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
