// ─── Perfiles y permisos ─────────────────────────────────────────────────────
// Cada cuenta ve solo los menús que tiene en la tabla `perfiles` (columna
// `paginas`, con los ids de página del menú: 'oc', 'facturas', 'rec-buscar'…).
// El administrador (Sebastián) ve todo y entra a "Usuarios y permisos".
// Una cuenta sin perfil o sin páginas no ve nada (solo Inicio).
//
// Importante: esto ordena la app, no es un bloqueo de datos (acordado con Seba,
// "nivel A"): las tablas siguen protegidas solo por sesión y rol editor.
let perfilActual = null;          // fila de `perfiles` de la cuenta conectada
const ADMIN_RESPALDO = 'sebastian.a@farmaciabulfor.cl';   // si `perfiles` no responde, el dueño no queda fuera

function idUsuarioSesion() {
  try { return JSON.parse(atob(sesionActual.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || null; }
  catch (_) { return null; }
}

async function cargarPerfil() {
  perfilActual = null;
  const uid = idUsuarioSesion();
  try {
    if (!uid) throw new Error('sin id');
    const res = await sb(`perfiles?select=*&user_id=eq.${uid}`);
    if (!res.ok) throw new Error('perfiles ' + res.status);
    perfilActual = (await res.json())[0] || { activo: true, es_admin: false, paginas: [] };
  } catch (e) {
    console.warn('No se pudo leer el perfil:', e);
    perfilActual = { activo: true, es_admin: (sesionActual?.email || '').toLowerCase() === ADMIN_RESPALDO, paginas: [], sinRespuesta: true };
  }
  return perfilActual;
}

const esAdminPerfil = () => !!(perfilActual && perfilActual.es_admin);

// ¿Puede ver esta página? Las páginas que no son del menú (fichas, vistas
// internas) se permiten; las del menú, solo si están en su perfil.
function paginaPermitida(id) {
  if (!id || id === 'inicio') return true;
  if (id === 'usuarios') return esAdminPerfil();
  // Perfil aún sin cargar (solo durante el arranque) o administrador: todo.
  if (!perfilActual || esAdminPerfil()) return true;
  const permitidas = new Set(perfilActual.paginas || []);
  if (permitidas.has(id)) return true;
  // Vista alternativa de una página permitida (Precios "Por cliente").
  if (typeof ALT_PAGINA !== 'undefined' && Object.entries(ALT_PAGINA).some(([p, alt]) => alt === id && permitidas.has(p))) return true;
  const enMenu = document.querySelector(`.nav-subitem[data-page="${id}"], .nav-subitem[data-page-alt="${id}"]`)
    || (typeof moduloDePagina === 'function' && moduloDePagina(id));
  return !enMenu;
}

function moduloPermitido(modulo) {
  if (modulo === 'inicio') return true;
  if (modulo === 'admin') return esAdminPerfil();
  const cfg = SUBMENUS[modulo];
  return !!cfg && cfg.items.some(it => paginaPermitida(it.page));
}

function primeraPaginaPermitida(modulo) {
  const cfg = SUBMENUS[modulo];
  return cfg ? (cfg.items.find(it => paginaPermitida(it.page)) || {}).page : null;
}

// Esconde del menú lateral, de las pestañas de arriba, de la barra del celular
// y de los accesos de Inicio todo lo que la cuenta no puede ver.
function aplicarPermisosNav() {
  document.querySelectorAll('.nav-subitem[data-page]').forEach(n =>
    n.classList.toggle('sin-permiso', !paginaPermitida(n.dataset.page)));
  document.querySelectorAll('[onclick^="mostrarModulo("]').forEach(n => {
    const m = /mostrarModulo\('([^']+)'/.exec(n.getAttribute('onclick'));
    if (!m) return;
    const ocultar = !moduloPermitido(m[1]);
    const cont = n.classList.contains('nav-item-modulo') ? n.closest('.nav-group') : n;
    if (cont) cont.classList.toggle('sin-permiso', ocultar);
  });
  // Títulos de grupo que quedan vacíos (barra de módulos e Inicio).
  document.querySelectorAll('.modulos-grupo, .nav-section-label').forEach(t => {
    let sig = t.nextElementSibling, alguno = false;
    while (sig && !sig.classList.contains(t.classList.contains('modulos-grupo') ? 'modulos-grupo' : 'nav-section-label')) {
      if ((sig.classList.contains('modulo-tab') || sig.classList.contains('nav-group')) && !sig.classList.contains('sin-permiso')) { alguno = true; break; }
      sig = sig.nextElementSibling;
    }
    t.classList.toggle('sin-permiso', !alguno);
  });
  document.querySelectorAll('.inicio-seccion').forEach(s => {
    const accesos = s.querySelectorAll('.inicio-acceso');
    if (accesos.length) s.classList.toggle('sin-permiso', [...accesos].every(a => a.classList.contains('sin-permiso')));
  });
  if (perfilActual && !esAdminPerfil() && !(perfilActual.paginas || []).length) {
    const sub = document.querySelector('#page-inicio .page-sub');
    if (sub) sub.textContent = 'Tu cuenta todavía no tiene menús asignados. Pídele a Sebastián que te los active.';
  }
}

// ─── Pantalla "Usuarios y permisos" (solo administrador) ────────────────────
let usrLista = [];

async function usrInit() {
  const cont = document.getElementById('usr-contenido');
  if (!cont) return;
  if (!esAdminPerfil()) { cont.innerHTML = '<div class="empty"><p>Solo el administrador puede ver esta pantalla.</p></div>'; return; }
  cont.innerHTML = '<div class="empty"><p>Cargando cuentas…</p></div>';
  try {
    const res = await sb('perfiles?select=*&order=es_admin.desc,nombre.asc');
    if (!res.ok) throw new Error('perfiles ' + res.status);
    usrLista = await res.json();
  } catch (e) {
    cont.innerHTML = `<div class="empty"><p>No se pudieron cargar las cuentas: ${escapeHtml(e.message)}</p></div>`;
    return;
  }
  usrRender();
}

function usrRender() {
  const cont = document.getElementById('usr-contenido');
  if (!cont) return;
  cont.innerHTML = `
    <div class="toolbar" style="justify-content:flex-end;margin-bottom:12px">
      <button class="btn-mp" onclick="usrNueva()"><i class="ti ti-user-plus"></i> Nueva cuenta</button>
    </div>
    <div class="table-card oc-tabla tabla-centrada"><table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Menús</th><th>Estado</th></tr></thead>
      <tbody>${usrLista.map(u => `
        <tr class="oc-fila" onclick="usrAbrir('${u.user_id}')">
          <td style="font-weight:600">${escapeHtml(u.nombre || '—')}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${u.es_admin ? '<span class="badge badge-blue">Administrador · ve todo</span>' : `${usrTodasLasPaginas().filter(x => (u.paginas || []).includes(x)).length} de ${usrTodasLasPaginas().length} páginas`}</td>
          <td>${u.activo ? '<span class="badge badge-green">Activa</span>' : '<span class="badge badge-gray">Desactivada</span>'}</td>
        </tr>`).join('')}</tbody></table></div>`;
}

const usrTodasLasPaginas = () => Object.entries(SUBMENUS).filter(([m]) => m !== 'admin').flatMap(([, c]) => c.items.map(it => it.page));
const USR_NOMBRE_MODULO = { 'oc-modulo': 'Órdenes de compra', 'precios': 'Precios', 'documentos': 'Creación de documentos',
  'facturas': 'Facturas de venta', 'proveedores': 'Facturas de proveedores', 'fedex': 'FedEx', 'chilexpress': 'Chilexpress',
  'elaboracion': 'Elaboración', 'recetario-modulo': 'Recetario', 'farmacia-modulo': 'Control farmacia', 'rrhh': 'Recursos humanos' };

function usrFicha(u) {
  const tiene = new Set(u.paginas || []);
  const modulos = Object.entries(SUBMENUS).filter(([m]) => m !== 'admin').map(([m, cfg]) => `
    <div class="usr-modulo">
      <label class="usr-modulo-cab"><input type="checkbox" ${cfg.items.every(it => tiene.has(it.page)) ? 'checked' : ''}
        onchange="usrMarcarModulo('${u.user_id}','${m}',this.checked)"> <b>${escapeHtml(USR_NOMBRE_MODULO[m] || m)}</b></label>
      ${cfg.items.length > 1 ? `<div class="usr-paginas">${cfg.items.map(it => `
        <label><input type="checkbox" data-page="${it.page}" ${tiene.has(it.page) ? 'checked' : ''}
          onchange="usrMarcarPagina('${u.user_id}','${it.page}',this.checked)"> ${escapeHtml(it.label)}</label>`).join('')}</div>` : ''}
    </div>`).join('');
  return {
    antetitulo: 'Usuarios y permisos',
    titulo: u.nombre || u.email,
    sub: `${escapeHtml(u.email)} · ${u.activo ? 'Activa' : 'Desactivada'}`,
    angosto: true,
    cuerpo: `
      <div class="usr-acciones">
        <button class="page-btn" onclick="usrRenombrar('${u.user_id}')"><i class="ti ti-pencil"></i> Cambiar nombre</button>
        ${u.es_admin ? '' : `<button class="page-btn" onclick="usrActivar('${u.user_id}', ${!u.activo})">${u.activo ? '<i class="ti ti-user-off"></i> Desactivar cuenta' : '<i class="ti ti-user-check"></i> Reactivar cuenta'}</button>`}
      </div>
      ${u.es_admin ? '<div class="panel-vacio">Administrador: ve todos los menús, incluido Usuarios y permisos.</div>'
        : `<div class="panel-h">Menús que ve <small style="font-weight:400;text-transform:none;letter-spacing:0">· los cambios se guardan al instante</small></div><div class="usr-modulos">${modulos}</div>`}`,
  };
}

function usrAbrir(id) {
  const u = usrLista.find(x => x.user_id === id);
  if (u) panelAbrir(usrFicha(u));
}

async function usrGuardarPaginas(id, paginas) {
  const u = usrLista.find(x => x.user_id === id);
  if (!u) return;
  const antes = u.paginas;
  u.paginas = paginas;
  const res = await sb(`perfiles?user_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ paginas, actualizado_en: new Date().toISOString() }) });
  if (!res.ok) { u.paginas = antes; toast('No se pudo guardar el permiso.', 'err'); }
  else toast('Permisos guardados');
  usrRender();
  panelAbrir(usrFicha(u));
}
function usrMarcarPagina(id, pagina, marcado) {
  const u = usrLista.find(x => x.user_id === id);
  if (!u) return;
  const s = new Set(u.paginas || []);
  marcado ? s.add(pagina) : s.delete(pagina);
  // "Borradores" va siempre junto con Creación de documentos.
  const docs = SUBMENUS.documentos.items.map(it => it.page);
  docs.some(p => s.has(p)) ? s.add('doc-borradores') : s.delete('doc-borradores');
  usrGuardarPaginas(id, [...s]);
}
function usrMarcarModulo(id, modulo, marcado) {
  const u = usrLista.find(x => x.user_id === id);
  if (!u) return;
  const s = new Set(u.paginas || []);
  SUBMENUS[modulo].items.forEach(it => marcado ? s.add(it.page) : s.delete(it.page));
  if (modulo === 'documentos') marcado ? s.add('doc-borradores') : s.delete('doc-borradores');
  usrGuardarPaginas(id, [...s]);
}

async function usrFuncion(datos) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-usuarios`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sesionActual?.access_token}`, 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  const r = await res.json().catch(() => ({}));
  if (!res.ok || !r.ok) throw new Error(r.error || 'No se pudo completar.');
  return r;
}

async function usrRenombrar(id) {
  const u = usrLista.find(x => x.user_id === id);
  if (!u) return;
  const nombre = prompt('Nuevo nombre para ' + u.email, u.nombre || '');
  if (nombre == null || !nombre.trim()) return;
  try { await usrFuncion({ accion: 'renombrar', user_id: id, nombre: nombre.trim() }); u.nombre = nombre.trim(); toast('Nombre actualizado'); }
  catch (e) { toast(e.message, 'err'); return; }
  usrRender(); panelAbrir(usrFicha(u));
}

async function usrActivar(id, activar) {
  const u = usrLista.find(x => x.user_id === id);
  if (!u) return;
  if (!activar && !await confirmModal(`${u.nombre || u.email} ya no podrá entrar a la app. ¿Desactivar la cuenta?`, { textoOk: 'Desactivar' })) return;
  try { await usrFuncion({ accion: activar ? 'activar' : 'desactivar', user_id: id }); u.activo = activar; toast(activar ? 'Cuenta reactivada' : 'Cuenta desactivada'); }
  catch (e) { toast(e.message, 'err'); return; }
  usrRender(); panelAbrir(usrFicha(u));
}

function usrNueva() {
  panelAbrir({
    antetitulo: 'Usuarios y permisos', titulo: 'Nueva cuenta', angosto: true,
    sub: 'La cuenta queda sin menús: después marcas qué puede ver.',
    cuerpo: `<div class="usr-form">
      <label>Nombre<input id="usr-n-nombre" placeholder="Ej.: María Pérez"></label>
      <label>Correo (lo que va antes de @farmaciabulfor.cl es su usuario para entrar)<input id="usr-n-email" type="email" placeholder="nombre@farmaciabulfor.cl"></label>
      <label>Contraseña inicial (mínimo 8 caracteres)<input id="usr-n-pass" type="text"></label>
      <button class="btn-mp" onclick="usrCrear(this)"><i class="ti ti-user-plus"></i> Crear cuenta</button>
    </div>`,
  });
}

async function usrCrear(btn) {
  const nombre = document.getElementById('usr-n-nombre').value.trim();
  const email = document.getElementById('usr-n-email').value.trim();
  const password = document.getElementById('usr-n-pass').value;
  if (!nombre || !email || password.length < 8) { toast('Completa nombre, correo y una contraseña de al menos 8 caracteres.', 'err'); return; }
  btn.disabled = true;
  try {
    const r = await usrFuncion({ accion: 'crear', nombre, email, password });
    usrLista.push(r.perfil);
    toast('Cuenta creada. Ahora marca qué menús puede ver.');
    usrRender(); panelAbrir(usrFicha(r.perfil));
  } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
}
