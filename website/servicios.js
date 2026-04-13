// servicios.js — Lógica de filtros y reveal del catálogo

document.addEventListener('DOMContentLoaded', () => {

  // ---- FILTER TABS ----
  const tabs = document.querySelectorAll('.tab');
  const sections = document.querySelectorAll('.cat-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const cat = tab.dataset.cat;

      // Actualizar tabs activos
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Mostrar/ocultar secciones con animación
      sections.forEach(section => {
        if (cat === 'all' || section.dataset.cat === cat) {
          section.classList.remove('hidden');
          section.style.opacity = '0';
          section.style.transform = 'translateY(16px)';
          requestAnimationFrame(() => {
            setTimeout(() => {
              section.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
              section.style.opacity = '1';
              section.style.transform = 'translateY(0)';
            }, 20);
          });
        } else {
          section.classList.add('hidden');
        }
      });

      // Scroll al primer resultado visible
      const firstVisible = document.querySelector('.cat-section:not(.hidden)');
      if (firstVisible && cat !== 'all') {
        setTimeout(() => {
          firstVisible.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    });
  });

  // ---- SCROLL REVEAL para las cards ----
  const cards = document.querySelectorAll('.listing-card');
  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
  });

  const cardObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const idx = Array.from(cards).indexOf(entry.target) % 4;
        setTimeout(() => {
          entry.target.style.transition = 'opacity 0.45s ease, transform 0.45s ease, border-color 0.25s ease, box-shadow 0.25s ease';
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, idx * 80);
        cardObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => cardObs.observe(card));

  // ---- URL HASH: filtrar por hash en la URL ----
  // Ej: servicios.html#coches → activa ese tab automáticamente
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const matchingTab = document.querySelector(`.tab[data-cat="${hash}"]`);
    if (matchingTab) matchingTab.click();
  }

});
