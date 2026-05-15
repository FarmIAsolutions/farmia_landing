/**
 * FarmIA landing interactions.
 */

(function() {
  'use strict';

  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.site-nav');
  const navLinks = document.querySelectorAll('.nav-link');

  function closeMenu() {
    if (!navToggle || !navMenu) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navMenu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const shouldOpen = navToggle.getAttribute('aria-expanded') !== 'true';
      navToggle.setAttribute('aria-expanded', String(shouldOpen));
      navMenu.classList.toggle('is-open', shouldOpen);
      document.body.classList.toggle('menu-open', shouldOpen);
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navMenu.classList.contains('is-open')) {
        closeMenu();
        navToggle.focus();
      }
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function(event) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', href);
    });
  });

  const sections = document.querySelectorAll('section[id]');
  const hashNavLinks = document.querySelectorAll('.nav-link[href^="#"]');
  const siteHeader = document.querySelector('.site-header');

  function updateActiveNavLink() {
    const offset = (siteHeader ? siteHeader.offsetHeight : 0) + 96;
    const scrollPosition = window.scrollY + offset;
    let activeId = '';

    sections.forEach((section) => {
      const top = section.offsetTop;
      const bottom = top + section.offsetHeight;
      if (scrollPosition >= top && scrollPosition < bottom) {
        activeId = section.id;
      }
    });

    hashNavLinks.forEach((link) => {
      link.classList.toggle('nav-link--active', link.getAttribute('href') === `#${activeId}`);
    });
  }

  window.addEventListener('scroll', updateActiveNavLink, { passive: true });
  updateActiveNavLink();

  document.querySelectorAll('.reveal').forEach((element) => {
    element.classList.add('is-visible');
  });

  const demoForm = document.querySelector('.demo-form');

  if (demoForm) {
    demoForm.addEventListener('submit', async function(event) {
      event.preventDefault();

      const button = this.querySelector('button[type="submit"]');
      const originalText = button ? button.textContent : '';
      const formData = new FormData(this);

      if (button) {
        button.textContent = 'Enviando...';
        button.disabled = true;
        button.style.opacity = '0.72';
      }

      try {
        const response = await fetch(this.action, {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Formspree request failed');
        }

        this.reset();
        if (button) {
          button.textContent = 'Solicitud enviada';
          button.style.background = '#10b981';
        }
      } catch (error) {
        if (button) {
          button.textContent = 'Error - intentá de nuevo';
          button.style.background = '#dc3545';
        }
      } finally {
        if (button) {
          window.setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
            button.style.opacity = '';
            button.style.background = '';
          }, 3500);
        }
      }
    });
  }
})();
