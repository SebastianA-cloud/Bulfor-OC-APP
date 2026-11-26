// /api/notificar-vacaciones.js
//
// Avisos por correo (Resend) del portal de vacaciones:
//  * tipo "nueva": un trabajador pidió vacaciones desde el portal → correo a
//    Sebastián (NOTIFY_EMAIL, la misma casilla de los avisos de recetas).
//  * tipo "respuesta": Sebastián aprobó o rechazó una solicitud del portal →
//    correo al trabajador.
//
// Seguridad: la app llama con la sesión de quien hizo la acción. Esta función
// NO confía en lo que diga el navegador: con esa misma sesión lee la
// solicitud desde Supabase (que aplica sus reglas de acceso) y arma el correo
// solo con datos de la base. Así nadie puede usarla para mandar correos
// inventados. No usa la clave de servicio.
//
// Variables de entorno en Vercel: RESEND_API_KEY y NOTIFY_EMAIL (ya existen).
// Opcional: RESEND_FROM. Ojo: con el remitente de prueba de Resend
// (onboarding@resend.dev) los correos SOLO llegan a la casilla dueña de la
// cuenta de Resend; para que lleguen a los trabajadores hay que verificar el
// dominio farmaciabulfor.cl en Resend y poner RESEND_FROM con ese dominio.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uodijcksuqaaovohutkf.supabase.co';
// Clave pública (anon): es la misma que ya va en index.html, no es secreta.
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZGlqY2tzdXFhYW92b2h1dGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDk1MTAsImV4cCI6MjA5NzAyNTUxMH0._gRO2Rp6eVD8u3aLJvhJPxLGfrZ9d9gMjqChQl7DyLQ';
const APP_URL = process.env.APP_URL || 'https://bulfor-oc-app-theta.vercel.app';

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function fechaLarga(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}
function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function supabase(path, token, opciones = {}) {
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    ...opciones,
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opciones.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

async function enviarCorreo(para, asunto, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM || 'Bulfor Vacaciones <onboarding@resend.dev>', to: [para], subject: asunto, html }),
  });
  if (!r.ok) throw new Error('Resend: ' + (await r.text()));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const { tipo, solicitud_id } = req.body || {};
    const id = Number(solicitud_id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Solicitud no válida' });

    // ¿Quién llama? (valida la sesión con Supabase)
    const usuario = await supabase('/auth/v1/user', token);
    const rol = usuario?.app_metadata?.rol;

    if (tipo === 'nueva') {
      if (rol !== 'trabajador') return res.status(403).json({ error: 'No autorizado' });
      // Solo sus propios datos, a través de la función del portal.
      const datos = await supabase('/rest/v1/rpc/portal_mis_datos', token, { method: 'POST', body: '{}' });
      const s = (datos.solicitudes || []).find(x => x.id === id);
      if (!s || s.origen !== 'portal' || s.estado !== 'pendiente') return res.status(404).json({ error: 'Solicitud no encontrada' });
      // Evita reenvíos: solo avisa de solicitudes recién creadas.
      if (Date.now() - new Date(s.created_at).getTime() > 10 * 60 * 1000) return res.status(200).json({ ok: true, omitido: true });
      const t = datos.trabajador;
      await enviarCorreo(process.env.NOTIFY_EMAIL, `Vacaciones: ${t.nombre} pidió ${s.dias_habiles} días`, `
        <p><strong>${esc(t.nombre)}</strong> pidió vacaciones desde el portal.</p>
        <p><strong>Fechas:</strong> ${fechaLarga(s.fecha_inicio)} al ${fechaLarga(s.fecha_fin)}<br>
           <strong>Días hábiles:</strong> ${esc(s.dias_habiles)}</p>
        ${s.observaciones ? `<p><strong>Comentario:</strong> ${esc(s.observaciones)}</p>` : ''}
        <p>Entra a la app (Recursos humanos → Vacaciones) para aprobarla o rechazarla:<br>
           <a href="${APP_URL}">${APP_URL}</a></p>`);
      return res.status(200).json({ ok: true });
    }

    if (tipo === 'respuesta') {
      if (rol !== 'editor') return res.status(403).json({ error: 'No autorizado' });
      const [s] = await supabase(`/rest/v1/vacaciones_solicitudes?id=eq.${id}&select=id,personal_id,fecha_inicio,fecha_fin,dias_habiles,estado,origen`, token);
      if (!s || s.origen !== 'portal' || !['aprobado', 'rechazado'].includes(s.estado)) return res.status(404).json({ error: 'Solicitud no encontrada' });
      const [p] = await supabase(`/rest/v1/personal?id=eq.${s.personal_id}&select=nombre,email`, token);
      if (!p?.email) return res.status(200).json({ ok: true, omitido: 'sin correo' });
      const [b] = await supabase(`/rest/v1/vacaciones_bitacora?entidad=eq.solicitud&entidad_id=eq.${id}&accion=eq.estado&order=created_at.desc&limit=1&select=detalle`, token);
      const aprobada = s.estado === 'aprobado';
      const primerNombre = String(p.nombre || '').split(' ')[0];
      await enviarCorreo(p.email, aprobada ? 'Tus vacaciones fueron aprobadas' : 'Tu solicitud de vacaciones fue rechazada', `
        <p>Hola ${esc(primerNombre)}:</p>
        <p>Tu solicitud de vacaciones del <strong>${fechaLarga(s.fecha_inicio)} al ${fechaLarga(s.fecha_fin)}</strong>
           (${esc(s.dias_habiles)} días hábiles) fue <strong>${aprobada ? 'aprobada' : 'rechazada'}</strong>.</p>
        ${b?.detalle ? `<p><strong>${aprobada ? 'Comentario' : 'Motivo'}:</strong> ${esc(b.detalle)}</p>` : ''}
        <p>Puedes ver tu saldo y tus solicitudes en <a href="${APP_URL}">${APP_URL}</a>.</p>
        <p>Farmacia Bulfor</p>`);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Tipo no válido' });
  } catch (e) {
    console.error('Error en notificar-vacaciones:', e);
    return res.status(500).json({ error: e.message });
  }
}
