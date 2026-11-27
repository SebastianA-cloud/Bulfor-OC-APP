// ─── CONTACTOS DE CADA HOSPITAL (pestaña "Contactos" de la ficha del hospital)
// (27-11-2026, pedido por Seba.) Junta tres fuentes:
//  1. Personas que emiten las OC (nombre y cargo; Mercado Público ya NO entrega
//     su teléfono ni correo: vienen vacíos).
//  2. Correos y teléfonos que el hospital escribe en las Observaciones de la OC
//     ("Encargada: María … - maria@hospital.cl - (2) 2612 1560").
//  3. Lo que el equipo escribe a mano (tabla contactos_hospital): completa a una
//     persona de las OC (clave_oc = su correo o nombre en minúsculas) o agrega
//     una persona nueva (clave_oc vacía). La sincronización nunca la toca.
// Todo lo de aquí empieza con "ct". index.html llama hospContactosHtml(ficha).

let ctManual = null;          // filas de contactos_hospital (todas; son pocas)
let ctCargando = null;
let ctEditando = null;        // { clave } o { id } o { nuevo: true } mientras se edita una tarjeta

function ctCargar(forzar) {
  if (ctCargando && !forzar) return ctCargando;
  ctCargando = fetchAll('contactos_hospital', 'select=*&order=actualizado_en.desc')
    .then(f => { ctManual = f || []; return ctManual; })
    .catch(() => { ctManual = []; return ctManual; });
  return ctCargando;
}

function ctRepintar() {
  const ficha = window.__hospFicha;
  const cont = document.getElementById('hosp-ficha-vista');
  if (ficha && ficha.vista === 'contactos' && cont) cont.innerHTML = hospContactosHtml(ficha);
}

// ─── Correos y teléfonos dentro de las Observaciones ───────────────────────
const CT_MAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Teléfonos chilenos escritos de mil formas: "+56 2 2612 1560", "(2) 26121560",
// "56-2-29518908", "9 8765 4321". Para no confundirlos con códigos o montos se
// exige que vengan con +56 o paréntesis, o que cerca diga fono/teléfono/cel…
const CT_FONO = /(?<![\d+])(?:\+?56[\s.-]*)?(?:\(\s*\d{1,2}\s*\)[\s.-]*|\d{1,2}[\s.-]+)?\d{3,5}[\s.-]?\d{3,5}(?!\d)/g;
const CT_PISTA_FONO = /(fono|tel[eé]f|\btel\b|tel\.|cel\b|celular|m[oó]vil|whats|anexo|contacto|llamar)/i;

function ctFonoValido(texto, m, idx) {
  const digitos = m.replace(/\D/g, '');
  if (digitos.length < 8 || digitos.length > 11) return false;
  const despues = texto.slice(idx + m.length, idx + m.length + 3);
  if (/^-[A-Z]/i.test(despues)) return false;               // es un código de OC (1234-56-AG26)
  if (/[$.,]\s*$/.test(texto.slice(Math.max(0, idx - 2), idx))) return false; // monto
  if (/^\s*(\+|\()/.test(m)) return true;
  return CT_PISTA_FONO.test(texto.slice(Math.max(0, idx - 35), idx));
}

function ctFrase(texto, idx, largo) {
  const a = Math.max(0, idx - 60), b = Math.min(texto.length, idx + largo + 60);
  const t = s => escapeHtml(s.replace(/\s+/g, ' '));
  return `${a > 0 ? '…' : ''}${t(texto.slice(a, idx))}<b>${t(texto.slice(idx, idx + largo))}</b>${t(texto.slice(idx + largo, b))}${b < texto.length ? '…' : ''}`;
}

function ctDatosDeObservaciones(ordenes) {
  const porValor = {};
  ordenes.forEach(r => {
    const texto = String(r.observaciones || '');
    if (!texto) return;
    const fecha = String(r.fechaenvio || r.fechaoc || '');
    const anotar = (tipo, valor, clave, idx) => {
      const d = porValor[clave] || (porValor[clave] = { tipo, valor, n: 0, ultima: '' });
      d.n++;
      if (fecha >= d.ultima) Object.assign(d, { ultima: fecha, frase: ctFrase(texto, idx, valor.length), codigo: r.codigooc });
    };
    for (const m of texto.matchAll(CT_MAIL)) anotar('mail', m[0].replace(/\.$/, ''), 'm:' + m[0].toLowerCase().replace(/\.$/, ''), m.index);
    for (const m of texto.matchAll(CT_FONO)) {
      const v = m[0].trim();
      if (ctFonoValido(texto, m[0], m.index)) anotar('fono', v, 'f:' + v.replace(/\D/g, '').replace(/^56/, ''), m.index);
    }
  });
  return Object.values(porValor).sort((a, b) => b.ultima.localeCompare(a.ultima));
}

// ─── Pestaña Contactos ─────────────────────────────────────────────────────
const copiarBtnContacto = (v, titulo = 'Copiar') => `<button type="button" class="panel-copiar-mini" title="${titulo}" onclick="event.stopPropagation();copiarTexto(${escapeHtml(JSON.stringify(v))}, this)"><i class="ti ti-copy"></i></button>`;
const ctAttr = v => escapeHtml(JSON.stringify(v));

function hospContactosHtml(ficha) {
  if (ctManual === null) { ctCargar().then(ctRepintar); }
  const hospital = ficha.hospital;
  const manuales = (ctManual || []).filter(c => c.hospital === hospital);

  // 1. Personas de las OC
  const porPersona = {};
  ficha.ordenes.forEach(r => {
    const nombre = (r.contacto_nombre || '').trim();
    const mail = (r.contacto_mail || '').trim().toLowerCase();
    if (!nombre && !mail) return;
    const clave = mail || nombre.toLowerCase();
    const fecha = String(r.fechaenvio || r.fechaoc || '');
    const p = porPersona[clave] || (porPersona[clave] = { clave, n: 0, ultima: '' });
    p.n++;
    if (fecha >= p.ultima) Object.assign(p, { ultima: fecha, nombre, cargo: r.contacto_cargo, unidad: r.unidadcompradora,
      fono: (r.contacto_fono || '').trim(), mail: (r.contacto_mail || '').trim() });
  });
  // 3. Lo escrito a mano completa o reemplaza (gana lo manual si tiene valor)
  const usados = new Set();
  const personas = Object.values(porPersona).map(p => {
    const m = manuales.find(c => c.clave_oc === p.clave);
    if (!m) return p;
    usados.add(m.id);
    return { ...p, manual: m, nombre: m.nombre || p.nombre, cargo: m.cargo || p.cargo, unidad: m.unidad || p.unidad,
      fono: m.fono || p.fono, mail: m.mail || p.mail, nota: m.nota };
  });
  const agregados = manuales.filter(c => !usados.has(c.id)).map(c => ({ manual: c, nuevo: true, nombre: c.nombre, cargo: c.cargo,
    unidad: c.unidad, fono: c.fono, mail: c.mail, nota: c.nota, ultima: '' }));
  const lista = [...agregados, ...personas.sort((a, b) => b.ultima.localeCompare(a.ultima))];

  // 2. Correos y teléfonos de las observaciones
  const datos = ctDatosDeObservaciones(ficha.ordenes);

  const tarjeta = p => {
    const editando = ctEditando && ((p.manual && ctEditando.id === p.manual.id) || (!p.nuevo && ctEditando.clave === p.clave));
    if (editando) return ctFormHtml(p);
    const ref = p.nuevo ? `{id:${p.manual.id}}` : `{clave:${ctAttr(p.clave)}}`;
    return `<div class="hosp-contacto">
      <div class="hosp-contacto-nombre"><b>${escapeHtml(p.nombre || '—')}</b>${p.cargo ? `<span>${escapeHtml(p.cargo)}</span>` : ''}${p.unidad ? `<span>${escapeHtml(p.unidad)}</span>` : ''}${p.nota ? `<span class="ct-nota">${escapeHtml(p.nota)}</span>` : ''}</div>
      <div class="hosp-contacto-datos">
        ${p.fono ? `<span><a href="tel:${escapeHtml(p.fono.replace(/[^0-9+]/g, ''))}"><i class="ti ti-phone" aria-hidden="true"></i> ${escapeHtml(p.fono)}</a> ${copiarBtnContacto(p.fono, 'Copiar teléfono')}</span>` : '<span class="ct-falta">Sin teléfono</span>'}
        ${p.mail ? `<span><a href="mailto:${escapeHtml(p.mail)}"><i class="ti ti-mail" aria-hidden="true"></i> ${escapeHtml(p.mail)}</a> ${copiarBtnContacto(p.mail, 'Copiar correo')}</span>` : '<span class="ct-falta">Sin correo</span>'}
      </div>
      <div class="hosp-contacto-oc">${p.nuevo ? 'Agregado a mano' : `Última OC ${fDate(p.ultima)} · ${p.n} OC`}${p.manual ? `<br><span class="ct-quien">Editado por ${escapeHtml(p.manual.actualizado_por || '—')}</span>` : ''}
        <div class="ct-botones"><button type="button" class="ct-btn" onclick='ctEditar(${ref})'><i class="ti ti-pencil" aria-hidden="true"></i> Editar</button></div></div>
    </div>`;
  };

  return `<div class="ct-cabecera">
      <p>Personas que han emitido órdenes de compra a Bulfor (la más reciente primero) y las que agregue el equipo. Mercado Público no entrega su teléfono ni correo: complétalos con <b>Editar</b>.</p>
      <button type="button" class="ct-btn ct-btn-rojo" onclick="ctEditar({nuevo:true})"><i class="ti ti-user-plus" aria-hidden="true"></i> Agregar contacto</button>
    </div>
    ${ctEditando && ctEditando.nuevo ? ctFormHtml({ nuevo: true }) : ''}
    ${lista.length ? `<div class="hosp-contactos">${lista.map(tarjeta).join('')}</div>` : '<div class="fpp-empty"><p>Todavía no hay contactos para este hospital.</p></div>'}
    <div class="panel-h" style="margin-top:18px">Correos y teléfonos que aparecen en las OC</div>
    ${datos.length ? `<p class="ct-ayuda">Sacados de las Observaciones que escribe el hospital en cada OC. Lee la frase para saber si es una persona o, por ejemplo, la casilla para enviar facturas.</p>
      <div class="ct-datos">${datos.map(d => `<div class="ct-dato">
        <div class="ct-dato-valor">${d.tipo === 'mail'
          ? `<a href="mailto:${escapeHtml(d.valor)}"><i class="ti ti-mail" aria-hidden="true"></i> ${escapeHtml(d.valor)}</a>`
          : `<a href="tel:${escapeHtml(d.valor.replace(/[^0-9+]/g, ''))}"><i class="ti ti-phone" aria-hidden="true"></i> ${escapeHtml(d.valor)}</a>`} ${copiarBtnContacto(d.valor)}</div>
        <div class="ct-frase">“${d.frase}”</div>
        <div class="hosp-contacto-oc">Última vez: ${fDate(d.ultima)} (OC ${escapeHtml(d.codigo || '')}) · en ${d.n} OC</div>
      </div>`).join('')}</div>`
      : `<p class="ct-ayuda">${ficha.ordenes.some(r => r.observaciones != null) ? 'Las OC de este hospital no traen correos ni teléfonos en sus observaciones.' : 'Las observaciones de las OC se están cargando desde Mercado Público.'}</p>`}`;
}

// ─── Edición manual ────────────────────────────────────────────────────────
function ctEditar(ref) { ctEditando = ref; ctRepintar(); setTimeout(() => document.querySelector('.ct-form input')?.focus(), 0); }
function ctCancelar() { ctEditando = null; ctRepintar(); }

function ctFormHtml(p) {
  const v = k => escapeHtml(p[k] || '');
  const desdeOC = !p.nuevo;
  return `<form class="ct-form" onsubmit="event.preventDefault();ctGuardar(this)">
    <div class="ct-form-tit">${p.nuevo && !p.manual ? 'Nuevo contacto' : 'Editar contacto'}${desdeOC ? ' <small>(lo que escribas reemplaza lo de Mercado Público solo en la app)</small>' : ''}</div>
    <div class="ct-form-grilla">
      <label>Nombre<input name="nombre" value="${v('nombre')}" ${p.nuevo ? 'required' : ''}></label>
      <label>Cargo<input name="cargo" value="${v('cargo')}"></label>
      <label>Unidad<input name="unidad" value="${v('unidad')}"></label>
      <label>Teléfono<input name="fono" value="${v('fono')}" inputmode="tel" placeholder="+56 2 2xxx xxxx"></label>
      <label>Correo<input name="mail" type="email" value="${v('mail')}" placeholder="nombre@hospital.cl"></label>
      <label class="ct-ancho">Nota<input name="nota" value="${v('nota')}" placeholder="Ej.: químico jefe, llamar en la mañana"></label>
    </div>
    <div class="ct-botones">
      <button type="submit" class="ct-btn ct-btn-rojo"><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar</button>
      <button type="button" class="ct-btn" onclick="ctCancelar()">Cancelar</button>
      ${p.manual ? `<button type="button" class="ct-btn ct-btn-borrar" onclick="ctBorrar(${p.manual.id}, ${p.nuevo ? 'true' : 'false'})">${p.nuevo ? 'Quitar contacto' : 'Volver a los datos de Mercado Público'}</button>` : ''}
    </div>
  </form>`;
}

async function ctGuardar(form) {
  const ficha = window.__hospFicha;
  const datos = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim() || null]));
  Object.assign(datos, { hospital: ficha.hospital, actualizado_por: sesionActual?.email || null, actualizado_en: new Date().toISOString() });
  let res;
  const existente = ctEditando.id ? (ctManual || []).find(c => c.id === ctEditando.id)
    : ctEditando.clave ? (ctManual || []).find(c => c.hospital === ficha.hospital && c.clave_oc === ctEditando.clave) : null;
  if (existente) {
    res = await sb(`contactos_hospital?id=eq.${existente.id}`, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(datos) });
  } else {
    datos.clave_oc = ctEditando.clave || null;
    datos.creado_por = sesionActual?.email || null;
    res = await sb('contactos_hospital', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(datos) });
  }
  if (!res.ok) { toast('No se pudo guardar el contacto. Intenta de nuevo.', 'err'); return; }
  const fila = (await res.json())[0];
  ctManual = (ctManual || []).filter(c => c.id !== fila.id).concat(fila);
  ctEditando = null;
  toast('Contacto guardado');
  ctRepintar();
}

async function ctBorrar(id, esNuevo) {
  if (!confirm(esNuevo ? '¿Quitar este contacto?' : '¿Borrar lo escrito a mano y volver a los datos de Mercado Público?')) return;
  const res = await sb(`contactos_hospital?id=eq.${id}`, { method: 'DELETE' });
  if (!res.ok) { toast('No se pudo borrar. Intenta de nuevo.', 'err'); return; }
  ctManual = (ctManual || []).filter(c => c.id !== id);
  ctEditando = null;
  toast(esNuevo ? 'Contacto quitado' : 'Se volvió a los datos de Mercado Público');
  ctRepintar();
}
