// ═══ Piezas comunes del rediseño ═════════════════════════════════════════
// Se usan en toda la app para que todas las pantallas se comporten igual:
//
//  * panelAbrir(ficha)  → ventana con el detalle de algo (una factura, una
//    OC, un envío…), al centro y lo más grande que cabe en la pantalla (antes
//    era un panel angosto a la derecha, pero apretaba mucho la información).
//    Arriba van los números para copiar; luego los botones de acción, el
//    contenido y el bloque "Relacionado", cuyas fichas se abren en la misma
//    ventana con "← Volver a …" para regresar.
//  * infoTip(texto)     → la "ⓘ" chiquita que muestra una explicación al pasar
//    el mouse (o al tocarla en el celular), en vez de recuadros grandes.
//  * copiarTexto(valor) → copia al portapapeles y avisa "✓ Copiado".
//
// Una "ficha" es un objeto así (todo es opcional menos el título):
//   {
//     titulo: 'Factura N° 22309',
//     antetitulo: 'Orden de compra',          // opcional: título destacado (con línea roja)
//     tituloCopiar: true,                      // ícono chico para copiar el título
//     tituloExtra: '<a …>Ver en Mercado Público</a>', // html al lado del título
//     resumen: '<div class="panel-datos">…</div>', // va bajo el subtítulo, antes del monto
//     sub: 'Hospital Clínico La Florida · 13-10-2026',
//     destacado: '$ 2.522.241',               // número grande bajo el título
//     etiquetas: '<span class="tag">…</span>', // estados en color
//     ids: [                                   // números importantes
//       { label: 'OC', valor: '812030-997-AG26' },             // con botón Copiar
//       { label: 'Factura', valor: '22309', ver: () => ficha }, // con botón "Ver ›"
//     ],
//     acciones: '<button …>Ver PDF</button>',  // solo acciones
//     cuerpo: '<div>…</div>',                  // contenido propio de cada pantalla
//     relacionado: [
//       { icono: 'ti-truck', titulo: 'Envío FedEx', resumen: 'Entregado 17-10', abrir: () => ficha },
//     ],
//     pie: '<details>…</details>',            // va al final, después de Relacionado
//     navegacion: { texto: 'Factura 3 de 85', anterior: fn, siguiente: fn },  // flechas ↑ ↓
//     alCerrar: fn,
//   }

const panelPila = [];   // fichas abiertas, para "← Volver"
let panelAcciones = {}; // funciones de los botones de la ficha visible

const panelEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// La "ⓘ" de ayuda. El texto va en un atributo, así que se escapa.
function infoTip(texto) {
  return `<span class="info-tip" tabindex="0" role="note" aria-label="${panelEsc(texto)}" data-tip="${panelEsc(texto)}">i</span>`;
}

// La explicación de la "i" se muestra en un globo que se acomoda dentro de la
// pantalla (antes se cortaba cuando la "i" quedaba cerca de un borde).
function infoTipMostrar(tip) {
  const texto = tip.getAttribute('data-tip');
  if (!texto) return;
  let g = document.getElementById('info-tip-globo');
  if (!g) { g = document.createElement('div'); g.id = 'info-tip-globo'; g.className = 'info-tip-globo'; document.body.appendChild(g); }
  g.textContent = texto;
  g.style.display = 'block';
  const r = tip.getBoundingClientRect(), gw = g.offsetWidth, gh = g.offsetHeight, m = 8;
  const left = Math.min(Math.max(m, r.left + r.width / 2 - gw / 2), window.innerWidth - gw - m);
  const arriba = r.top - gh - 8;
  g.style.left = left + 'px';
  g.style.top = (arriba >= m ? arriba : r.bottom + 8) + 'px';
}
function infoTipOcultar() {
  const g = document.getElementById('info-tip-globo');
  if (g) g.style.display = 'none';
}
document.addEventListener('mouseover', ev => { const t = ev.target.closest?.('.info-tip'); if (t) infoTipMostrar(t); });
document.addEventListener('mouseout', ev => { if (ev.target.closest?.('.info-tip')) infoTipOcultar(); });
document.addEventListener('focusin', ev => { const t = ev.target.closest?.('.info-tip'); if (t) infoTipMostrar(t); });
document.addEventListener('focusout', ev => { if (ev.target.closest?.('.info-tip')) infoTipOcultar(); });
document.addEventListener('scroll', infoTipOcultar, true);

async function copiarTexto(valor, boton) {
  const texto = String(valor ?? '');
  try { await navigator.clipboard.writeText(texto); }
  catch (e) {
    // Navegadores sin permiso de portapapeles: se copia con un campo oculto.
    const t = document.createElement('textarea');
    t.value = texto; t.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e2) { /* sin copia */ }
    t.remove();
  }
  if (boton) {
    const antes = boton.innerHTML;
    boton.classList.add('ok');
    boton.innerHTML = '<i class="ti ti-check"></i> Copiado';
    setTimeout(() => { boton.classList.remove('ok'); boton.innerHTML = antes; }, 1600);
  }
}

// Copia una tabla para pegarla en un correo (Gmail, Outlook) como tabla con
// sus casillas, o en Excel/texto como columnas.
async function copiarTabla(html, texto, boton) {
  let ok = false;
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([texto], { type: 'text/plain' }),
    })]);
    ok = true;
  } catch (e) {
    // Navegadores sin ese permiso: se copia la tabla seleccionándola en pantalla.
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.style.cssText = 'position:fixed;left:-9999px;top:0';
    div.innerHTML = html;
    document.body.appendChild(div);
    const rango = document.createRange(); rango.selectNodeContents(div);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rango);
    try { ok = document.execCommand('copy'); } catch (e2) { /* sin copia */ }
    sel.removeAllRanges(); div.remove();
  }
  if (boton) {
    const antes = boton.innerHTML;
    boton.innerHTML = ok ? '<i class="ti ti-check"></i> Copiada' : 'No se pudo copiar';
    setTimeout(() => { boton.innerHTML = antes; }, 1600);
  }
}

// Abre una ficha. Si viene de "Relacionado" (desde=true) se apila para volver.
function panelAbrir(ficha, desde) {
  if (!ficha) return;
  if (!desde) {
    // Abrir desde la lista reemplaza todo lo anterior.
    const anterior = panelPila[0];
    panelPila.length = 0;
    if (anterior && anterior.alCerrar && anterior !== ficha) anterior.alCerrar();
  }
  panelPila.push(ficha);
  panelPintar();
}

function panelVolver() {
  if (panelPila.length > 1) { panelPila.pop(); panelPintar(); }
}

function panelCerrar() {
  const primera = panelPila[0];
  panelPila.length = 0;
  document.getElementById('panel-lateral')?.remove();
  document.getElementById('panel-fondo')?.remove();
  document.body.classList.remove('con-panel');
  if (primera && primera.alCerrar) primera.alCerrar();
}

function panelPintar() {
  const f = panelPila[panelPila.length - 1];
  if (!f) return panelCerrar();
  panelAcciones = {};
  let n = 0;
  const accion = fn => { const k = 'a' + (n++); panelAcciones[k] = fn; return k; };

  const anterior = panelPila.length > 1 ? panelPila[panelPila.length - 2] : null;
  const nav = f.navegacion && !anterior ? f.navegacion : null;
  const arriba = anterior
    ? `<button class="panel-volver" onclick="panelVolver()"><i class="ti ti-arrow-left"></i> Volver a ${panelEsc(anterior.titulo)}</button>`
    : `<span class="panel-pos">${panelEsc(nav?.texto || '')}</span>`;
  const flechas = nav ? `
      <button class="panel-btn-ico" title="Anterior (↑)" ${nav.anterior ? `onclick="panelAcciones.${accion(nav.anterior)}()"` : 'disabled'}><i class="ti ti-arrow-up"></i></button>
      <button class="panel-btn-ico" title="Siguiente (↓)" ${nav.siguiente ? `onclick="panelAcciones.${accion(nav.siguiente)}()"` : 'disabled'}><i class="ti ti-arrow-down"></i></button>` : '';
  if (nav) { panelAcciones.arriba = nav.anterior || null; panelAcciones.abajo = nav.siguiente || null; }

  const ids = (f.ids || []).filter(x => x && x.valor).map(x => `
      <span class="panel-id"><span class="panel-id-l">${panelEsc(x.label)}</span><b>${panelEsc(x.valor)}</b>${x.ver
        ? `<button class="panel-id-ver" onclick="panelAbrir(panelAcciones.${accion(x.ver)}(), true)">Ver ›</button>`
        : `<button class="panel-id-copiar" onclick="copiarTexto(${panelEsc(JSON.stringify(String(x.valor)))}, this)"><i class="ti ti-copy"></i> Copiar</button>`}</span>`).join('');

  const rel = (f.relacionado || []).filter(Boolean).map(r => `
      <button class="panel-rel" onclick="panelAbrir(panelAcciones.${accion(r.abrir)}(), true)">
        <span class="panel-rel-ico"><i class="ti ${panelEsc(r.icono || 'ti-link')}"></i></span>
        <span class="panel-rel-tx"><b>${panelEsc(r.titulo)}</b><small>${panelEsc(r.resumen || '')}</small></span>
        <i class="ti ti-chevron-right panel-rel-go"></i>
      </button>`).join('');

  // Fondo oscuro detrás de la ventana: un clic afuera la cierra.
  if (!document.getElementById('panel-fondo')) {
    const fondo = document.createElement('div');
    fondo.id = 'panel-fondo';
    fondo.className = 'panel-fondo';
    fondo.onclick = panelCerrar;
    document.body.appendChild(fondo);
  }
  let el = document.getElementById('panel-lateral');
  if (!el) {
    el = document.createElement('aside');
    el.id = 'panel-lateral';
    el.className = 'panel-lateral';
    el.setAttribute('aria-label', 'Detalle');
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="panel-cab">${arriba}<span class="panel-cab-btns">${flechas}
      <button class="panel-btn-ico" title="Cerrar (Esc)" onclick="panelCerrar()"><i class="ti ti-x"></i></button></span></div>
    <div class="panel-cuerpo">
      ${f.antetitulo ? `<div class="panel-antetit">${panelEsc(f.antetitulo)}</div>` : ''}
      <div class="panel-tit${f.antetitulo ? ' panel-tit-destacado' : ''}"><span>${panelEsc(f.titulo)}</span>${f.tituloCopiar
        ? `<button class="panel-copiar-mini" title="Copiar" onclick="copiarTexto(${panelEsc(JSON.stringify(String(f.titulo)))}, this)"><i class="ti ti-copy"></i></button>` : ''}${f.tituloExtra || ''}</div>
      ${f.sub ? `<div class="panel-sub">${panelEsc(f.sub)}</div>` : ''}
      ${ids ? `<div class="panel-ids">${ids}</div>` : ''}
      ${f.resumen ? `<div class="panel-resumen">${f.resumen}</div>` : ''}
      ${f.destacado ? `<div class="panel-destacado">${panelEsc(f.destacado)}</div>` : ''}
      ${f.etiquetas ? `<div class="panel-etiquetas">${f.etiquetas}</div>` : ''}
      ${f.acciones ? `<div class="panel-acciones">${f.acciones}</div>` : ''}
      ${f.cuerpo || ''}
      ${rel ? `<div class="panel-h">Relacionado</div><div class="panel-rels">${rel}</div>` : ''}
      ${f.pie || ''}
    </div>`;
  el.querySelector('.panel-cuerpo').scrollTop = 0;
  document.body.classList.add('con-panel');
}

// Teclado: Esc cierra, ↑ ↓ pasan a la anterior/siguiente (si no se está escribiendo).
document.addEventListener('keydown', ev => {
  if (!document.getElementById('panel-lateral')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable) return;
  if (document.querySelector('.modal-overlay')) return;   // un modal encima manda
  if (ev.key === 'Escape') { ev.preventDefault(); panelCerrar(); }
  else if (ev.key === 'ArrowUp' && panelAcciones.arriba && panelPila.length === 1) { ev.preventDefault(); panelAcciones.arriba(); }
  else if (ev.key === 'ArrowDown' && panelAcciones.abajo && panelPila.length === 1) { ev.preventDefault(); panelAcciones.abajo(); }
});
