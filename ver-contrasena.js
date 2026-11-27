// ─── Botón "ver contraseña" ──────────────────────────────────────────────────
// Agrega un ojo a la derecha de TODO campo de contraseña de la app (login,
// "Cambiar clave" del portal y cualquiera que se agregue después): al tocarlo
// se muestra lo escrito y al tocarlo de nuevo se vuelve a ocultar.
//
// Funciona solo: revisa la página al cargar y vigila los campos que aparecen
// después (ventanas que se abren). El ícono va dibujado aquí mismo (SVG), así
// se ve aunque no carguen los íconos de internet.
(function () {
  const OJO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OJO_TACHADO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 5.4-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  function agregarOjo(input) {
    if (input.dataset.verClave) return;          // ya tiene su botón
    input.dataset.verClave = '1';
    // El botón se ubica sobre el borde derecho del campo; el campo deja espacio para él.
    const contenedor = input.parentElement;
    if (getComputedStyle(contenedor).position === 'static') contenedor.style.position = 'relative';
    input.style.paddingRight = '44px';
    const btn = document.createElement('button');
    btn.type = 'button';                          // no envía el formulario
    btn.className = 'ver-clave-btn';
    btn.title = 'Mostrar contraseña';
    btn.setAttribute('aria-label', 'Mostrar contraseña');
    btn.innerHTML = OJO;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      btn.innerHTML = mostrar ? OJO_TACHADO : OJO;
      btn.title = mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña';
      btn.setAttribute('aria-label', btn.title);
      input.focus();
    });
    // Centrado verticalmente respecto del campo (aunque el contenedor tenga una etiqueta arriba).
    const ubicar = () => { btn.style.top = (input.offsetTop + input.offsetHeight / 2) + 'px'; };
    input.insertAdjacentElement('afterend', btn);
    ubicar();
    requestAnimationFrame(ubicar);
  }

  function revisar(raiz) {
    (raiz.querySelectorAll ? raiz.querySelectorAll('input[type="password"]') : []).forEach(agregarOjo);
  }

  revisar(document);
  new MutationObserver(mutaciones => {
    mutaciones.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) revisar(n); }));
  }).observe(document.body, { childList: true, subtree: true });
})();
