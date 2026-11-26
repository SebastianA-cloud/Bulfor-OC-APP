// ═══════════════════════════════════════════════════════════════════════════
// PORTAL DEL TRABAJADOR — "Mis vacaciones"
//
// Una cuenta con rol "trabajador" (app_metadata.rol, que solo el servidor
// puede escribir) NO entra a la app de la oficina: al iniciar sesión,
// arrancarApp() la desvía aquí y no se carga nada más (ni OC, ni facturas,
// ni recetario). Además la base de datos la bloquea de verdad: una política
// restrictiva `sin_trabajadores` en todas las tablas. El trabajador solo usa
// cuatro funciones de la base (portal_mis_datos, portal_calendario,
// portal_solicitar, portal_anular), que entregan SU información.
//
// Para no duplicar cálculos, el portal llena los mismos arreglos del módulo
// de RR.HH. de index.html (personal, vacPeriodos, vacSolicitudes,
// vacDistribucion, feriados) solo con los datos del trabajador, y reutiliza
// saldoDeTrabajador(), diasHabilesEntre(), rangoLegible(), etc. Así el saldo
// que ve el trabajador es exactamente el mismo que ve Sebastián.
//
// Al final del archivo están las piezas del lado administrador: dar o quitar
// acceso al portal desde la ficha del trabajador y los avisos por correo.
// ═══════════════════════════════════════════════════════════════════════════

let portalDatos = null;        // respuesta de portal_mis_datos
let portalEquipo = [];         // calendario compartido (quién sale y cuándo)

// cerrarTodosLosModales() de index.html cierra las ventanas cuyo id está en
// MODAL_OVERLAY_IDS. Este archivo carga antes que esa lista, así que las del
// portal se anotan recién al abrirse.
function portalRegistrarModal(id) {
  if (typeof MODAL_OVERLAY_IDS !== 'undefined' && !MODAL_OVERLAY_IDS.includes(id)) MODAL_OVERLAY_IDS.push(id);
}

// ─── Adelantos ─────────────────────────────────────────────────────────────
// Cada período guarda desde qué fecha se puede usar (disponible_desde = el
// aniversario de ingreso en que se gana). Usar sus días antes de esa fecha
// es un ADELANTO: se permite, pero debe estar conversado con Sebastián.
// Sin fecha registrada se considera usable.
function periodoUsableDesde(periodoId) {
  const p = vacPeriodos.find(x => x.id === periodoId);
  return (p && p.disponible_desde) || null;
}

// Tramos de una solicitud que son adelanto: [{periodo, dias, desde}].
function adelantoDeSolicitud(sol) {
  if (!sol) return [];
  return vacDistribucion.filter(d => d.solicitud_id === sol.id).map(d => {
    const per = vacPeriodos.find(x => x.id === d.periodo_id);
    return { periodo: per ? per.periodo : '', dias: Number(d.dias), desde: per && per.disponible_desde };
  }).filter(t => t.desde && t.desde > sol.fecha_inicio);
}

// Texto corto para avisos: "3 días del período 26/27 (se puede usar desde el 01-03-2027)".
function textoAdelanto(tramos) {
  return tramos.map(t => `${redondear(t.dias)} día${t.dias === 1 ? '' : 's'} del período ${escapeHtml(t.periodo)} (se puede usar desde el ${fDate(t.desde)})`).join(' y ');
}

async function arrancarPortalTrabajador() {
  document.body.classList.add('modo-portal');
  let cont = document.getElementById('portal-trabajador');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'portal-trabajador';
    document.body.appendChild(cont);
  }
  cont.innerHTML = `<div class="portal-cargando">Cargando tus vacaciones…</div>`;
  try {
    await portalRecargar();
    portalRender();
  } catch (e) {
    cont.innerHTML = `
      <div class="portal-wrap">
        ${portalEncabezado('')}
        <div class="portal-aviso err">${escapeHtml(e.message || 'No se pudieron cargar tus datos.')}</div>
      </div>`;
  }
}

// Lee todo de nuevo desde la base. Se llama al entrar y después de cada
// solicitud o anulación: más simple y seguro que mantener copias a mano.
async function portalRecargar() {
  const hoy = vacHoy();
  const [datos, equipo] = await Promise.all([
    rpcVac('portal_mis_datos', {}),
    rpcVac('portal_calendario', { p_desde: hoy, p_hasta: vacSumarDias(hoy, 120) }).catch(() => []),
  ]);
  portalDatos = datos;
  portalEquipo = Array.isArray(equipo) ? equipo : [];
  personal        = [datos.trabajador];
  vacPeriodos     = (datos.periodos || []).map(p => ({ ...p, personal_id: datos.trabajador.id }));
  vacSolicitudes  = datos.solicitudes || [];
  vacDistribucion = datos.distribucion || [];
  feriados        = datos.feriados || {};
  vacVersion++;
}

function portalEncabezado(nombre) {
  const primerNombre = (nombre || '').split(' ')[0];
  return `
    <div class="portal-top">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <div class="login-badge portal-logo">B</div>
        <div style="min-width:0">
          <div style="font-size:12px;color:var(--text-3)">Farmacia Bulfor</div>
          <div style="font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${primerNombre ? 'Hola, ' + escapeHtml(primerNombre) : 'Mis vacaciones'}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="page-btn" style="padding:7px 10px" onclick="portalCambiarClave()" title="Cambiar contraseña"><i class="ti ti-key" aria-hidden="true"></i><span class="portal-solo-ancho"> Contraseña</span></button>
        <button class="page-btn" style="padding:7px 10px" onclick="cerrarSesion()" title="Cerrar sesión"><i class="ti ti-logout" aria-hidden="true"></i><span class="portal-solo-ancho"> Salir</span></button>
      </div>
    </div>`;
}

function portalRender() {
  const cont = document.getElementById('portal-trabajador');
  if (!cont || !portalDatos) return;
  const t = portalDatos.trabajador;
  const s = saldoDeTrabajador(t.id);
  const vigente = vacacionesVigentes(t.id);
  const prox = proximasVacacionesDe(t.id);
  const solicitudes = solicitudesDe(t.id);
  const hoy = vacHoy();
  const usableHoy = p => { const d = periodoUsableDesde(p.id); return !d || d <= hoy; };
  const dispHoy = redondear(s.periodos.filter(usableHoy).reduce((n, p) => n + p.disponibles, 0));
  const futuros = s.periodos.filter(p => !usableHoy(p) && p.disponibles > 0);

  // Antes del primer aniversario la ley todavía no da derecho a vacaciones:
  // lo que pida es un adelanto que Sebastián decide si aprueba.
  const aniversario = t.fecha_ingreso ? String(Number(t.fecha_ingreso.slice(0, 4)) + 1) + t.fecha_ingreso.slice(4, 10) : null;
  const antesDelAnio = aniversario && aniversario > hoy;

  cont.innerHTML = `
    <div class="portal-wrap">
      ${portalEncabezado(t.nombre)}

      ${vigente ? `<div class="portal-aviso ok"><i class="ti ti-beach" aria-hidden="true"></i> Estás de vacaciones hasta el <strong>${fDate(vigente.fecha_fin)}</strong>. Vuelves el ${fDate(portalDiaRegreso(vigente.fecha_fin))}.</div>` : ''}
      ${antesDelAnio ? `<div class="portal-aviso warn">Tu derecho legal a vacaciones comienza el <strong>${fDate(aniversario)}</strong> (al cumplir un año). Antes de esa fecha, lo que pidas es un adelanto que debe estar conversado con Sebastián.</div>` : ''}

      <div class="portal-stats">
        <div class="stat destacado"><div class="stat-label">Disponibles hoy</div><div class="stat-val">${s.periodos.length ? dispHoy : '—'}</div><div class="stat-sub">${!s.periodos.length ? 'aún sin períodos asignados'
          : futuros.length ? futuros.map(p => `+${p.disponibles} desde el ${fDate(periodoUsableDesde(p.id))} (período ${escapeHtml(p.periodo)})`).join('<br>') : 'días hábiles para pedir'}</div></div>
        <div class="stat"><div class="stat-label">Pendientes</div><div class="stat-val">${s.pendientes}</div><div class="stat-sub">días esperando aprobación</div></div>
        <div class="stat"><div class="stat-label">Próximas vacaciones</div><div class="stat-val" style="font-size:15px;line-height:1.35">${prox ? rangoLegible(prox.fecha_inicio, prox.fecha_fin) : '—'}</div><div class="stat-sub">${prox ? `${prox.dias_habiles} días · ${prox.estado === 'pendiente' ? 'por aprobar' : 'aprobadas'}` : 'nada programado'}</div></div>
      </div>

      <button class="page-btn portal-btn-principal" onclick="portalAbrirSolicitud()" ${s.disponibles > 0 ? '' : 'disabled'}>
        <i class="ti ti-plus" aria-hidden="true"></i> Solicitar vacaciones
      </button>
      ${s.disponibles > 0 ? '' : '<div style="font-size:12.5px;color:var(--text-3);text-align:center;margin-top:6px">No tienes días disponibles para pedir.</div>'}

      <div class="portal-seccion">Mis solicitudes</div>
      ${solicitudes.length ? solicitudes.map(portalTarjetaSolicitud).join('') : '<div class="portal-vacio">Todavía no tienes solicitudes.</div>'}

      <div class="portal-seccion">Mis días por período</div>
      ${s.periodos.length ? s.periodos.map(p => `
        <div class="portal-tarjeta">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
            <div><div style="font-weight:600">Período ${escapeHtml(p.periodo)}</div>
              <div style="font-size:11.5px;margin-top:2px;color:${usableHoy(p) ? 'var(--green)' : 'var(--amber)'}">${usableHoy(p) ? 'Ya lo puedes usar' : 'Se puede usar desde el ' + fDate(periodoUsableDesde(p.id))}</div></div>
            <div style="font-size:13px"><strong style="font-size:18px">${p.disponibles}</strong> disponibles</div>
          </div>
          <div class="portal-periodo-nums">
            <div><span>${p.totales}</span>asignados${p.progresivos ? ` (incl. ${p.progresivos} progresivo${p.progresivos === 1 ? '' : 's'})` : ''}</div>
            <div><span>${p.utilizados}</span>usados</div>
            <div><span>${p.pendientes}</span>pendientes</div>
          </div>
          ${p.observacion ? `<div style="font-size:11.5px;color:var(--text-3);margin-top:6px">${escapeHtml(p.observacion)}</div>` : ''}
        </div>`).join('') : '<div class="portal-vacio">Aún no tienes períodos asignados.</div>'}
      <div style="font-size:11.5px;color:var(--text-3);margin-top:6px">Al pedir vacaciones, los días se descuentan primero del período más antiguo. Usar días de un período antes de la fecha en que se puede usar es un adelanto y debe estar conversado con Sebastián.</div>

      <div class="portal-seccion">Vacaciones del equipo (próximos 4 meses)</div>
      ${portalEquipo.length ? `<div class="portal-tarjeta" style="padding:4px 14px">
        ${portalEquipo.map(e => `
          <div class="portal-fila-equipo">
            <div style="font-weight:${e.propia ? 600 : 500}">${escapeHtml(e.nombre)}${e.propia ? ' <span style="color:var(--text-3);font-weight:400">(tú)</span>' : ''}</div>
            <div style="color:var(--text-2);white-space:nowrap">${rangoLegible(e.fecha_inicio, e.fecha_fin)}</div>
          </div>`).join('')}
      </div>` : '<div class="portal-vacio">Nadie del equipo tiene vacaciones aprobadas en los próximos meses.</div>'}
      <div style="font-size:11.5px;color:var(--text-3);margin-top:6px">Solo se muestran vacaciones ya aprobadas, para que puedas planificar las tuyas.</div>
    </div>`;
}

// Día en que vuelve: el primer día hábil después del último día de vacaciones.
function portalDiaRegreso(fin) {
  let d = vacSumarDias(fin, 1), tope = 0;
  while (!esDiaHabil(d) && tope++ < 30) d = vacSumarDias(d, 1);
  return d;
}

function portalTarjetaSolicitud(sol) {
  const estado = estadoVisualSolicitud(sol);
  const respuesta = sol.respuesta && !/portal/i.test(sol.respuesta) ? sol.respuesta : '';
  return `
    <div class="portal-tarjeta">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="min-width:0">
          <div style="font-weight:600">${rangoLegible(sol.fecha_inicio, sol.fecha_fin)} de ${vacFecha(sol.fecha_inicio).getFullYear()}</div>
          <div style="font-size:12.5px;color:var(--text-2);margin-top:2px">${sol.dias_habiles} día${Number(sol.dias_habiles) === 1 ? '' : 's'} hábil${Number(sol.dias_habiles) === 1 ? '' : 'es'} · ${sol.origen === 'portal' ? 'pedida por ti' : 'registrada por la oficina'}</div>
        </div>
        ${badgeVac(estado)}
      </div>
      ${(() => { const a = adelantoDeSolicitud(sol); return a.length && sol.estado !== 'cancelado' && sol.estado !== 'rechazado' ? `<div style="font-size:12px;color:var(--amber);margin-top:8px"><strong>Adelanto:</strong> ${textoAdelanto(a)}.</div>` : ''; })()}
      ${sol.observaciones ? `<div style="font-size:12.5px;color:var(--text-2);margin-top:8px">${escapeHtml(sol.observaciones)}</div>` : ''}
      ${respuesta && (sol.estado === 'rechazado' || sol.estado === 'aprobado') ? `<div style="font-size:12.5px;margin-top:8px"><strong>Respuesta:</strong> ${escapeHtml(respuesta)}</div>` : ''}
      ${sol.estado === 'pendiente' ? `<div style="margin-top:10px"><button class="page-btn" style="padding:6px 12px;font-size:12.5px" onclick="portalAnular(${sol.id}, this)">Anular solicitud</button></div>` : ''}
    </div>`;
}

// ─── Solicitar ─────────────────────────────────────────────────────────────
function portalAbrirSolicitud() {
  cerrarTodosLosModales();
  const hoy = vacHoy();
  const modal = document.createElement('div');
  portalRegistrarModal('portal-solicitud-overlay');
  modal.id = 'portal-solicitud-overlay';
  modal.className = 'modal-overlay';
  modal.onclick = e => { if (e.target === modal) cerrarTodosLosModales(); };
  modal.innerHTML = `
    <div class="modal-shell modal-sm" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div style="flex:1;font-size:16px;font-weight:600">Solicitar vacaciones</div>
        <button onclick="cerrarTodosLosModales()" class="modal-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <div class="portal-fechas">
          <label>Desde<input type="date" id="ps-desde" min="${hoy}" oninput="portalRecalcular()"></label>
          <label>Hasta (inclusive)<input type="date" id="ps-hasta" min="${hoy}" oninput="portalRecalcular()"></label>
        </div>
        <div id="ps-calculo" class="portal-calculo">Elige las fechas y te muestro cuántos días se descuentan.</div>
        <label style="display:block;font-size:12.5px;color:var(--text-2);margin-top:12px">Comentario (opcional)
          <textarea id="ps-obs" rows="2" maxlength="500" style="width:100%;margin-top:4px;padding:8px 10px;resize:vertical"></textarea>
        </label>
        <div id="ps-error" class="portal-aviso err" style="display:none;margin-top:10px"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button class="page-btn" style="padding:8px 14px" onclick="cerrarTodosLosModales()">Cancelar</button>
          <button class="page-btn" id="ps-enviar" disabled style="padding:8px 16px;background:var(--accent);color:#fff;border-color:var(--accent)" onclick="portalEnviarSolicitud(this)">Enviar solicitud</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// Mismo cálculo que hace la base al guardar (días hábiles sin fines de semana
// ni feriados); aquí solo sirve para mostrárselo antes de enviar.
function portalRecalcular() {
  const desde = document.getElementById('ps-desde').value;
  const hastaEl = document.getElementById('ps-hasta');
  if (desde && (!hastaEl.value || hastaEl.value < desde)) hastaEl.value = desde;
  hastaEl.min = desde || vacHoy();
  const hasta = hastaEl.value;
  const out = document.getElementById('ps-calculo');
  const btn = document.getElementById('ps-enviar');
  btn.disabled = true;
  if (!desde || !hasta) { out.textContent = 'Elige las fechas y te muestro cuántos días se descuentan.'; return; }

  const t = portalDatos.trabajador;
  const dias = diasHabilesEntre(desde, hasta);
  const corridos = vacDiasCorridos(desde, hasta);
  const noHab = detalleNoHabiles(desde, hasta);
  const saldo = saldoDeTrabajador(t.id);
  const cruce = vacSolicitudes.find(x => (x.estado === 'aprobado' || x.estado === 'pendiente')
    && x.fecha_inicio <= hasta && x.fecha_fin >= desde);
  const equipo = portalEquipo.filter(e => !e.propia && e.fecha_inicio <= hasta && e.fecha_fin >= desde);

  const motivos = [];
  if (noHab.findes.length) motivos.push(`${noHab.findes.length} día${noHab.findes.length === 1 ? '' : 's'} de fin de semana`);
  if (noHab.feriados.length) motivos.push(`${noHab.feriados.length} feriado${noHab.feriados.length === 1 ? '' : 's'} (${noHab.feriados.map(f => escapeHtml(f.nombre)).join(', ')})`);

  let html = `<div style="font-size:20px;font-weight:600">${dias} día${dias === 1 ? '' : 's'} hábil${dias === 1 ? '' : 'es'}</div>
    <div style="font-size:12.5px;color:var(--text-2);margin-top:2px">${corridos} día${corridos === 1 ? '' : 's'} corrido${corridos === 1 ? '' : 's'}${motivos.length ? '; no se descuentan ' + motivos.join(' ni ') : ''}. Vuelves el ${fDate(portalDiaRegreso(hasta))}.</div>`;
  let ok = true;
  if (dias === 0) { html += `<div class="portal-aviso warn" style="margin-top:8px">Esas fechas no tienen días hábiles.</div>`; ok = false; }
  else if (dias > saldo.disponibles) { html += `<div class="portal-aviso err" style="margin-top:8px">Tienes ${saldo.disponibles} días disponibles: no te alcanza.</div>`; ok = false; }
  else {
    html += `<div style="font-size:12.5px;margin-top:6px">Te quedarían <strong>${redondear(saldo.disponibles - dias)}</strong> días en total.</div>`;
    // Misma regla que la base: se gasta primero el período más antiguo; lo
    // que salga de un período que aún no se puede usar en esa fecha es adelanto.
    const adel = sugerirDistribucion(t.id, dias).tramos
      .map(tr => ({ periodo: tr.periodo, dias: tr.dias, desde: periodoUsableDesde(tr.periodo_id) }))
      .filter(tr => tr.desde && tr.desde > desde);
    if (adel.length) html += `<div class="portal-aviso warn" style="margin-top:8px"><strong>Estás adelantando vacaciones:</strong> ${textoAdelanto(adel)}. Envíala solo si ya lo conversaste con Sebastián; la solicitud le llegará marcada como adelanto.</div>`;
  }
  if (cruce) { html += `<div class="portal-aviso err" style="margin-top:8px">Ya tienes vacaciones ${cruce.estado === 'pendiente' ? 'pedidas' : 'aprobadas'} que se cruzan con esas fechas (${rangoLegible(cruce.fecha_inicio, cruce.fecha_fin)}).</div>`; ok = false; }
  if (equipo.length) html += `<div style="font-size:12px;color:var(--amber);margin-top:6px">En esas fechas también sale: ${equipo.map(e => escapeHtml(e.nombre)).join(', ')}.</div>`;
  out.innerHTML = html;
  btn.disabled = !ok;
}

async function portalEnviarSolicitud(btn) {
  const err = document.getElementById('ps-error');
  err.style.display = 'none';
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    const id = await rpcVac('portal_solicitar', {
      p_inicio: document.getElementById('ps-desde').value,
      p_fin: document.getElementById('ps-hasta').value,
      p_obs: document.getElementById('ps-obs').value.trim() || null,
    });
    avisarVacacionesPorCorreo('nueva', id);
    await portalRecargar();
    cerrarTodosLosModales();
    portalRender();
    toast('Solicitud enviada. Te avisaremos cuando sea revisada.');
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = original;
  }
}

async function portalAnular(id, btn) {
  const sol = vacSolicitudes.find(x => x.id === id);
  if (!sol) return;
  const ok = await confirmModal(`¿Anular tu solicitud del ${rangoLegible(sol.fecha_inicio, sol.fecha_fin)}?\n\nLos ${sol.dias_habiles} días vuelven a quedar disponibles.`,
    { textoOk: 'Anular solicitud', textoCancelar: 'Volver' });
  if (!ok) return;
  btn.disabled = true; btn.textContent = 'Anulando…';
  try {
    await rpcVac('portal_anular', { p_id: id });
    await portalRecargar();
    portalRender();
    toast('Solicitud anulada');
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false; btn.textContent = 'Anular solicitud';
  }
}

// ─── Cambiar contraseña (la cuenta del propio trabajador) ──────────────────
function portalCambiarClave() {
  cerrarTodosLosModales();
  const modal = document.createElement('div');
  portalRegistrarModal('portal-clave-overlay');
  modal.id = 'portal-clave-overlay';
  modal.className = 'modal-overlay';
  modal.onclick = e => { if (e.target === modal) cerrarTodosLosModales(); };
  modal.innerHTML = `
    <div class="modal-shell modal-sm" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div style="flex:1;font-size:16px;font-weight:600">Cambiar contraseña</div>
        <button onclick="cerrarTodosLosModales()" class="modal-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <label style="display:block;font-size:12.5px;color:var(--text-2)">Nueva contraseña (mínimo 8 caracteres)
          <input type="password" id="pc-1" autocomplete="new-password" style="width:100%;margin-top:4px;padding:8px 10px"></label>
        <label style="display:block;font-size:12.5px;color:var(--text-2);margin-top:10px">Repítela
          <input type="password" id="pc-2" autocomplete="new-password" style="width:100%;margin-top:4px;padding:8px 10px"></label>
        <div id="pc-error" class="portal-aviso err" style="display:none;margin-top:10px"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button class="page-btn" style="padding:8px 14px" onclick="cerrarTodosLosModales()">Cancelar</button>
          <button class="page-btn" style="padding:8px 16px;background:var(--accent);color:#fff;border-color:var(--accent)" onclick="portalGuardarClave(this)">Guardar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('pc-1').focus();
}

async function portalGuardarClave(btn) {
  const a = document.getElementById('pc-1').value, b = document.getElementById('pc-2').value;
  const err = document.getElementById('pc-error');
  const mostrar = m => { err.textContent = m; err.style.display = 'block'; };
  if (a.length < 8) return mostrar('La contraseña debe tener al menos 8 caracteres.');
  if (a !== b) return mostrar('Las dos contraseñas no coinciden.');
  btn.disabled = true;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${sesionActual.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: a }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(/same/i.test(j.msg || j.error_description || '') ? 'Esa es tu contraseña actual: elige una distinta.' : (j.msg || j.error_description || 'No se pudo cambiar la contraseña.'));
    }
    cerrarTodosLosModales();
    toast('Contraseña actualizada');
  } catch (e) { mostrar(e.message); btn.disabled = false; }
}

// ═══════════════════════════════════════════════════════════════════════════
// LADO ADMINISTRADOR
// ═══════════════════════════════════════════════════════════════════════════

// Avisos por correo (api/notificar-vacaciones.js en Vercel). La función lee
// los datos desde la base con la sesión de quien llama, así que no se le
// puede pedir que mande correos inventados. Si falla, no interrumpe nada:
// la solicitud ya quedó guardada.
function avisarVacacionesPorCorreo(tipo, solicitudId) {
  if (!solicitudId || !sesionActual?.access_token) return;
  fetch('/api/notificar-vacaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesionActual.access_token}` },
    body: JSON.stringify({ tipo, solicitud_id: solicitudId }),
  }).catch(() => {});
}

// Bloque "Acceso al portal" de la ficha de vacaciones del trabajador.
function portalBloqueAcceso(p) {
  if (!esAdminPerfil()) return '';
  const tiene = !!p.user_id;
  return `
    <div class="portal-acceso">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600"><i class="ti ti-device-mobile" aria-hidden="true"></i> Portal del trabajador</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:2px">${tiene
          ? `Tiene acceso con <strong>${escapeHtml(p.email || 'su correo')}</strong>: puede ver su saldo y pedir vacaciones desde el celular.`
          : (p.email ? 'Sin acceso. Al darlo, podrá ver su saldo y pedir vacaciones desde el celular.' : 'Sin acceso. Primero agrega su correo en la ficha (Editar).')}</div>
      </div>
      ${tiene
        ? `<button class="page-btn" style="padding:7px 12px;white-space:nowrap" onclick="portalQuitarAcceso(${p.id}, this)">Quitar acceso</button>`
        : `<button class="page-btn" style="padding:7px 12px;white-space:nowrap;background:var(--accent);color:#fff;border-color:var(--accent)" ${p.email ? '' : 'disabled'} onclick="portalDarAcceso(${p.id}, this)">Dar acceso</button>`}
    </div>`;
}

async function llamarAdminUsuarios(cuerpo) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesionActual.access_token}`, apikey: SUPABASE_KEY },
    body: JSON.stringify(cuerpo),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error || 'No se pudo completar la acción.');
  return j;
}

function claveSugerida() {
  const letras = 'abcdefghjkmnpqrstuvwxyz', nums = '23456789';
  const r = (s, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => s[x % s.length]).join('');
  return 'Bulfor-' + r(letras, 4) + r(nums, 4);
}

async function portalDarAcceso(personalId, btn) {
  const p = personal.find(x => x.id === personalId);
  if (!p || !p.email) return;
  const clave = await promptModal(
    `Dar acceso al portal a ${p.nombre}.\n\nEntrará con su correo (${p.email}) y esta contraseña inicial. Anótala y entrégasela; después la puede cambiar desde el portal.`,
    claveSugerida());
  if (clave === null) return;
  if (clave.length < 8) { toast('La contraseña debe tener al menos 8 caracteres.', 'err'); return; }
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Creando…';
  try {
    const j = await llamarAdminUsuarios({ accion: 'crear_trabajador', personal_id: personalId, email: p.email, nombre: p.nombre, password: clave });
    p.user_id = j.user_id;
    toast(`Acceso creado para ${p.nombre}`);
    abrirPerfilVacaciones(personalId);
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false; btn.textContent = original;
  }
}

async function portalQuitarAcceso(personalId, btn) {
  const p = personal.find(x => x.id === personalId);
  if (!p) return;
  const ok = await confirmModal(`¿Quitar el acceso al portal a ${p.nombre}?\n\nSu cuenta queda desactivada y no podrá entrar. Sus vacaciones y su historial no se borran. Puedes volver a darle acceso cuando quieras.`,
    { textoOk: 'Quitar acceso' });
  if (!ok) return;
  btn.disabled = true; btn.textContent = 'Quitando…';
  try {
    await llamarAdminUsuarios({ accion: 'quitar_trabajador', personal_id: personalId });
    p.user_id = null;
    toast('Acceso quitado');
    abrirPerfilVacaciones(personalId);
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false; btn.textContent = 'Quitar acceso';
  }
}
