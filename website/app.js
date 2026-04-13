// RoyalRent — app.js (simplificado)

document.addEventListener('DOMContentLoaded', () => {

  // Navbar scroll
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('solid', window.scrollY > 50);
  });

  // Burger menu
  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    burger.classList.remove('open');
    navLinks.classList.remove('open');
  }));

  // Scroll reveal
  const revealEls = document.querySelectorAll('.service-card, .app-feat, .team-card, .tech');
  revealEls.forEach(el => el.classList.add('reveal'));
  const obs = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('in'), i * 60);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  revealEls.forEach(el => obs.observe(el));

  // Contact form
  document.getElementById('contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar';
      btn.disabled = false;
      e.target.reset();
      const s = document.getElementById('success');
      s.classList.add('show');
      setTimeout(() => s.classList.remove('show'), 4000);
    }, 1500);
  });

});
