// admin-usuarios — administración de cuentas de la app, solo para el administrador
// (Sebastián). Crea cuentas, cambia su nombre y las desactiva/reactiva.
//
// Seguridad:
//  * Solo responde si quien llama tiene sesión iniciada y en la tabla `perfiles`
//    figura como administrador activo (es_admin = true).
//  * Usa la clave de servicio que Supabase entrega a las funciones
//    (SUPABASE_SERVICE_ROLE_KEY); nunca sale de aquí ni va en el código de la app.
//  * Una cuenta desactivada queda "baneada" en Auth: no puede iniciar sesión
//    ni renovar la sesión que tenía abierta.
//  * Los menús que ve cada cuenta (columna `paginas`) los cambia la app
//    directamente en `perfiles`, protegida por RLS (solo el administrador).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URL_BASE = Deno.env.get("SUPABASE_URL") || "";
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const hServicio = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" };

// Devuelve el id de quien llama si es administrador activo; si no, null.
async function adminQueLlama(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${URL_BASE}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON } });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u?.id) return null;
  const p = await fetch(`${URL_BASE}/rest/v1/perfiles?select=es_admin,activo&user_id=eq.${u.id}`, { headers: hServicio });
  const filas = p.ok ? await p.json() : [];
  return filas[0]?.es_admin && filas[0]?.activo ? u.id : null;
}

async function actualizarPerfil(userId: string, cambios: Record<string, unknown>) {
  const r = await fetch(`${URL_BASE}/rest/v1/perfiles?user_id=eq.${userId}`, {
    method: "PATCH", headers: { ...hServicio, Prefer: "return=minimal" },
    body: JSON.stringify({ ...cambios, actualizado_en: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("No se pudo actualizar el perfil.");
}

async function actualizarCuenta(userId: string, cambios: Record<string, unknown>) {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${userId}`, {
    method: "PUT", headers: hServicio, body: JSON.stringify(cambios),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.msg || "No se pudo actualizar la cuenta.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const admin = await adminQueLlama(req);
  if (!admin) return json({ error: "Solo el administrador puede hacer esto." }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Datos inválidos." }, 400); }
  const accion = String(body.accion || "");

  try {
    if (accion === "crear") {
      const email = String(body.email || "").trim().toLowerCase();
      const nombre = String(body.nombre || "").trim();
      const password = String(body.password || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Correo no válido." }, 400);
      if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
      // Rol "editor" igual que las cuentas actuales: las reglas de la base lo
      // exigen para escribir. Sin menús hasta que el administrador se los dé.
      const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
        method: "POST", headers: hServicio,
        body: JSON.stringify({ email, password, email_confirm: true,
          user_metadata: { rol: "editor", nombre }, app_metadata: { rol: "editor" } }),
      });
      const u = await r.json().catch(() => ({}));
      if (!r.ok || !u?.id) return json({ error: u?.msg || u?.error_description || "No se pudo crear la cuenta (¿el correo ya existe?)." }, 400);
      const p = await fetch(`${URL_BASE}/rest/v1/perfiles`, {
        method: "POST", headers: { ...hServicio, Prefer: "return=representation" },
        body: JSON.stringify({ user_id: u.id, email, nombre, activo: true, es_admin: false, paginas: [] }),
      });
      if (!p.ok) return json({ error: "La cuenta se creó, pero no su perfil. Revisar en Supabase." }, 500);
      return json({ ok: true, perfil: (await p.json())[0] });
    }

    const userId = String(body.user_id || "");
    if (!/^[0-9a-f-]{36}$/.test(userId)) return json({ error: "Cuenta no válida." }, 400);

    if (accion === "renombrar") {
      const nombre = String(body.nombre || "").trim();
      if (!nombre) return json({ error: "Escribe un nombre." }, 400);
      await actualizarCuenta(userId, { user_metadata: { rol: "editor", nombre } });
      await actualizarPerfil(userId, { nombre });
      return json({ ok: true });
    }

    if (accion === "desactivar" || accion === "activar") {
      if (userId === admin) return json({ error: "No puedes desactivar tu propia cuenta." }, 400);
      const activar = accion === "activar";
      // ~100 años de bloqueo = desactivada; "none" la vuelve a habilitar.
      await actualizarCuenta(userId, { ban_duration: activar ? "none" : "876000h" });
      await actualizarPerfil(userId, { activo: activar });
      return json({ ok: true });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Error inesperado." }, 500);
  }
});
