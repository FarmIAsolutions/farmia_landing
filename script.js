/**
 * FarmIA Landing Page - JavaScript
 * Mobile menu, smooth scroll, reveal animations
 */

(function() {
  'use strict';

  // ========================================
  // Mobile Navigation
  // ========================================
  const navToggle = document.querySelector('.navbar__toggle');
  const navMenu = document.querySelector('.navbar__menu');
  const navLinks = document.querySelectorAll('.navbar__link');

  function toggleMenu() {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', !isOpen);
    navMenu.classList.toggle('is-open');
    document.body.style.overflow = !isOpen ? 'hidden' : '';
  }

  function closeMenu() {
    navToggle.setAttribute('aria-expanded', 'false');
    navMenu.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', toggleMenu);

    navLinks.forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
        closeMenu();
        navToggle.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('is-open') && 
          !navMenu.contains(e.target) && 
          !navToggle.contains(e.target)) {
        closeMenu();
      }
    });
  }

  // ========================================
  // Smooth Scroll for anchor links
  // ========================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        history.pushState(null, null, href);
      }
    });
  });

  // ========================================
  // Scroll Reveal Animation
  // ========================================
  const revealElements = document.querySelectorAll('.reveal');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (!prefersReducedMotion && revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => {
      revealObserver.observe(el);
    });
  } else {
    revealElements.forEach(el => {
      el.classList.add('is-visible');
    });
  }

  // ========================================
  // Navbar scroll effect
  // ========================================
  const navbar = document.querySelector('.navbar');

  function handleNavbarScroll() {
    if (window.pageYOffset > 50) {
      navbar.classList.add('navbar--scrolled');
    } else {
      navbar.classList.remove('navbar--scrolled');
    }
  }

  window.addEventListener('scroll', handleNavbarScroll, { passive: true });

  // ========================================
  // Active navigation link based on scroll
  // ========================================
  const sections = document.querySelectorAll('section[id]');
  const navLinksWithHash = document.querySelectorAll('.navbar__link[href^="#"]');

  function updateActiveLink() {
    const scrollPosition = window.scrollY + 150;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        navLinksWithHash.forEach(link => {
          link.classList.remove('navbar__link--active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('navbar__link--active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });

  // ========================================
  // Form submission handler - Formspree
  // ========================================
  const demoForm = document.querySelector('.demo-form');
  
  if (demoForm) {
    demoForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const button = this.querySelector('button[type="submit"]');
      const originalText = button.textContent;
      
      button.textContent = 'Enviando...';
      button.disabled = true;
      button.style.opacity = '0.7';
      
      try {
        const response = await fetch(this.action, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          button.textContent = '¡Solicitud enviada!';
          button.style.background = '#10B981';
          this.reset();
          
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
            button.style.opacity = '';
            button.style.background = '';
          }, 4000);
        } else {
          throw new Error('Error en el envío');
        }
      } catch (error) {
        button.textContent = 'Error - Intentá de nuevo';
        button.style.background = '#DC3545';
        
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
          button.style.opacity = '';
          button.style.background = '';
        }, 3000);
      }
    });
  }

  // ========================================
  // Hero stats animation
  // ========================================
  const heroVisual = document.querySelector('.hero__visual');
  if (heroVisual) {
    const statCards = heroVisual.querySelectorAll('.hero__stat-card');
    statCards.forEach((card, index) => {
      card.style.animationDelay = `${index * 0.15}s`;
      card.classList.add('fade-in-up');
    });
  }

  // Add CSS for hero animation
  const style = document.createElement('style');
  style.textContent = `
    .fade-in-up {
      animation: fadeInUp 0.5s ease forwards;
      opacity: 0;
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

})();
