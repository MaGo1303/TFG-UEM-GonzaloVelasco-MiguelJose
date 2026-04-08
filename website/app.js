// ===========================
// ROYALRENT — APP JS
// ===========================

document.addEventListener('DOMContentLoaded', () => {

  // ---------- NAVBAR SCROLL ----------
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });

  // ---------- HAMBURGER MENU ----------
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });
  // Close menu on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });

  // ---------- HERO PARTICLES ----------
  const particleContainer = document.getElementById('particles');
  const PARTICLE_COUNT = 55;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('div');
    const size = Math.random() * 2 + 1;
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const delay = Math.random() * 8;
    const duration = Math.random() * 10 + 8;
    p.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}%;
      top: ${y}%;
      background: radial-gradient(circle, rgba(201,168,76,${Math.random() * 0.5 + 0.1}), transparent);
      border-radius: 50%;
      animation: float ${duration}s ${delay}s ease-in-out infinite alternate;
    `;
    particleContainer.appendChild(p);
  }

  // Add float keyframe dynamically
  const style = document.createElement('style');
  style.textContent = `
    @keyframes float {
      0% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
      50% { opacity: 0.8; }
      100% { transform: translateY(-40px) translateX(${Math.random() > 0.5 ? '' : '-'}${Math.random() * 30}px); opacity: 0.2; }
    }
  `;
  document.head.appendChild(style);

  // ---------- COUNTER ANIMATION ----------
  const counters = document.querySelectorAll('.stat-num[data-target]');
  let countersStarted = false;

  function animateCounters() {
    if (countersStarted) return;
    const heroSection = document.querySelector('.hero');
    const rect = heroSection.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      countersStarted = true;
      counters.forEach(counter => {
        const target = parseInt(counter.dataset.target);
        const duration = 2000;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out expo
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          counter.textContent = Math.floor(eased * target);
          if (progress < 1) requestAnimationFrame(tick);
          else counter.textContent = target;
        };
        requestAnimationFrame(tick);
      });
    }
  }
  window.addEventListener('scroll', animateCounters);
  animateCounters();

  // ---------- SCROLL REVEAL ----------
  const reveals = document.querySelectorAll(
    '.feature-card, .cat-card, .step, .team-card, .faq-item, .pi-card, .trust-item'
  );
  reveals.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, 80 * (Array.from(reveals).indexOf(entry.target) % 6));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  reveals.forEach(el => observer.observe(el));

  // ---------- FAQ ACCORDION ----------
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      faqItems.forEach(fi => {
        fi.classList.remove('open');
        fi.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ---------- CONTACT FORM ----------
  const form = document.getElementById('contact-form');
  const successMsg = document.getElementById('form-success');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('#submit-contact');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Mensaje';
      btn.disabled = false;
      form.reset();
      successMsg.classList.add('show');
      setTimeout(() => successMsg.classList.remove('show'), 4000);
    }, 1800);
  });

  // ---------- SMOOTH ACTIVE NAV ----------
  const sections = document.querySelectorAll('section[id]');
  const navLinksAll = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const top = section.offsetTop - 100;
      if (window.scrollY >= top) current = section.getAttribute('id');
    });
    navLinksAll.forEach(link => {
      link.style.color = '';
      if (link.getAttribute('href') === `#${current}`) {
        link.style.color = 'var(--gold)';
      }
    });
  });

  // ---------- PHONE MOCKUP ANIMATION ----------
  const phoneCats = document.querySelectorAll('.phone-cat');
  let currentCat = 0;
  const catData = [
    { icon: 'fa-solid fa-car-side', bg: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
    { icon: 'fa-solid fa-plane-departure', bg: 'linear-gradient(135deg, #0f3460, #533483)' },
    { icon: 'fa-solid fa-sailboat', bg: 'linear-gradient(135deg, #004e92, #000428)' },
    { icon: 'fa-solid fa-helicopter', bg: 'linear-gradient(135deg, #1d1d1d, #3d3d3d)' },
  ];

  setInterval(() => {
    phoneCats.forEach(c => c.classList.remove('active'));
    currentCat = (currentCat + 1) % phoneCats.length;
    phoneCats[currentCat].classList.add('active');

    const cardImgs = document.querySelectorAll('.phone-card-img');
    const data = catData[currentCat];
    if (cardImgs[0]) {
      cardImgs[0].style.background = data.bg;
      cardImgs[0].innerHTML = `<i class="${data.icon}"></i>`;
    }
  }, 2500);

});
