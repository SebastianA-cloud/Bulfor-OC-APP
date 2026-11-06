// registrar-pago-bci — marca como pagadas las facturas de proveedores (Facturas por
// pagar) a partir de los avisos "Aviso de transferencia de fondos" de BCI que le
// llegan a Genoveva. Los lee un Google Apps Script en su cuenta
// (scripts/pagos_bci_apps_script.gs) y los envía aquí cada hora.
//
// Seguridad:
//  * Exige el encabezado x-bulfor-token igual al secreto PAGOS_BCI_TOKEN (está
//    solo en Supabase y en el script de Genoveva; nunca en este repositorio).
//  * Escribe con la clave de servicio que Supabase entrega a las funciones.
//
// Regla para cada transferencia (no se procesa dos veces: comprobante único):
//  * El mensaje debe decir "FACTURA <número>" (si no: sueldos, retiros, etc. → sin_factura).
//  * Se busca la factura por número; si hay varias, gana la del proveedor con
//    nombre parecido al destino. Si el número no existe, se prueba con una
//    factura pendiente del mismo proveedor y el mismo monto (números mal escritos).
//  * El monto debe calzar (tolerancia $10, o descontando una nota de crédito del
//    mismo proveedor si el mensaje la menciona). Si calza → Pagado con la fecha
//    del aviso; si no → por_revisar (no se toca la factura).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bulfor-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URL_BASE = Deno.env.get("SUPABASE_URL") || "";
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TOKEN = Deno.env.get("PAGOS_BCI_TOKEN") || "";
const h = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" };
const TOLERANCIA = 10;

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...h, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// Nombre comparable: sin tildes, sin "S.A.", "SPA", "LTDA"… Solo palabras de 4+ letras.
const RELLENO = new Set(["SOCIEDAD", "COMERCIAL", "LIMITADA", "LTDA", "SPA", "CIA", "HIJOS", "CHILE", "COMERCIALIZADORA", "DISTRIBUIDORA", "IMPORT"]);
function palabras(t: string): Set<string> {
  return new Set(String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length >= 4 && !RELLENO.has(p)));
}
const parecido = (a: string, b: string) => { const B = palabras(b); return [...palabras(a)].some((p) => B.has(p)); };

function fechaISO(f: string): string | null {
  const m = String(f || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : (/^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null);
}

type Transferencia = { comprobante: string; fecha: string; destino: string; monto: number | string; mensaje?: string; gmail_id?: string };
type Factura = { id: number; factura: string; proveedor: string; rut_proveedor: string; monto_total: number; estado_pago: string | null; fecha_pago: string | null };

async function procesar(t: Transferencia, probar: boolean) {
  const comprobante = String(t.comprobante || "").trim();
  const fecha = fechaISO(t.fecha);
  const monto = Number(String(t.monto).replace(/[^0-9]/g, ""));
  const destino = String(t.destino || "").trim();
  const mensaje = String(t.mensaje || "").trim();
  if (!comprobante || !fecha || !monto) return { comprobante, estado: "error", detalle: "Faltan comprobante, fecha o monto." };

  const ya = await rest(`pagos_bci?select=id,estado&comprobante=eq.${encodeURIComponent(comprobante)}`);
  if (ya.length) return { comprobante, estado: "ya_procesado", detalle: ya[0].estado };

  const numeros = [...mensaje.matchAll(/FACTURAS?\s*(?:N[°º.]?\s*)?([\d\s,y-]+)/gi)]
    .flatMap((m) => m[1].match(/\d{2,}/g) || []);
  let estado = "sin_factura";
  let detalle = "El mensaje no menciona una factura.";
  let marcar: Factura[] = [];
  let facturas: string[] = [];

  if (numeros.length) {
    detalle = "";
    const lista = numeros.map((n) => `"${n}"`).join(",");
    const filas: Factura[] = await rest(`facturas_por_pagar?select=id,factura,proveedor,rut_proveedor,monto_total,estado_pago,fecha_pago&factura=in.(${lista})`);
    const elegidas: Factura[] = [];
    const faltan: string[] = [];
    for (const n of numeros) {
      const candidatas = filas.filter((f) => f.factura === n);
      const f = candidatas.length === 1 ? candidatas[0] : candidatas.find((c) => parecido(c.proveedor, destino));
      if (f) elegidas.push(f); else faltan.push(n);
    }
    // Número mal escrito: una sola factura pendiente del mismo proveedor y mismo monto.
    if (faltan.length === 1 && numeros.length === 1) {
      const mismas: Factura[] = (await rest(`facturas_por_pagar?select=id,factura,proveedor,rut_proveedor,monto_total,estado_pago,fecha_pago&monto_total=eq.${monto}&estado_pago=eq.Pendiente`))
        .filter((f: Factura) => parecido(f.proveedor, destino));
      if (mismas.length === 1) { elegidas.push(mismas[0]); faltan.length = 0; detalle = `El mensaje decía ${numeros[0]}; calza por proveedor y monto con la ${mismas[0].factura}. `; }
    }
    if (faltan.length) {
      estado = "por_revisar"; detalle = `No encontré la factura ${faltan.join(", ")} en Facturas por pagar.`;
    } else {
      const total = elegidas.reduce((s, f) => s + Number(f.monto_total || 0), 0);
      let diferencia = total - monto;
      let nota = "";
      const nc = mensaje.match(/N(?:OTA)?\s*(?:DE\s*)?C(?:REDITO|R[EÉ]DITO)?\.?\s*(\d+)/i);
      if (Math.abs(diferencia) > TOLERANCIA && nc) {
        // Nota de crédito del mismo proveedor cuyo folio empiece con lo escrito (los mensajes se cortan).
        const ncs = await rest(`notas_credito_recibidas?select=folio,monto_total&rut_proveedor=eq.${elegidas[0].rut_proveedor}&folio=like.${nc[1]}*`);
        const n = ncs.find((x: { monto_total: number }) => Math.abs(total - Number(x.monto_total) - monto) <= TOLERANCIA);
        if (n) { diferencia = total - Number(n.monto_total) - monto; nota = ` Descontada la NC ${n.folio} (${n.monto_total}).`; }
      }
      if (Math.abs(diferencia) > TOLERANCIA) {
        estado = "por_revisar"; detalle += `Monto distinto: facturas ${total}, transferido ${monto}.`;
      } else {
        const pendientes = elegidas.filter((f) => f.estado_pago !== "Pagado");
        marcar = pendientes;
        estado = pendientes.length ? "pagada" : "ya_pagada";
        detalle += (pendientes.length ? "Marcada pagada." : "Ya figuraba pagada.") + nota
          + (diferencia ? ` Diferencia de $${diferencia}.` : "");
      }
      facturas = elegidas.map((f) => f.factura);
    }
  }

  if (!probar) {
    for (const f of marcar) {
      await rest(`facturas_por_pagar?id=eq.${f.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ estado_pago: "Pagado", fecha_pago: fecha }) });
    }
    await rest("pagos_bci", { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ comprobante, fecha, destino, monto, mensaje, gmail_id: t.gmail_id || null, facturas, estado, detalle: detalle.trim() }) });
  }
  return { comprobante, fecha, destino, monto, mensaje, facturas, estado, detalle: detalle.trim() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!TOKEN || req.headers.get("x-bulfor-token") !== TOKEN) return json({ error: "No autorizado" }, 401);
  let body: { transferencias?: Transferencia[]; probar?: boolean } = {};
  try { body = await req.json(); } catch { return json({ error: "Datos inválidos." }, 400); }
  const lista = Array.isArray(body.transferencias) ? body.transferencias.slice(0, 200) : [];
  const resultados = [];
  for (const t of lista) {
    try { resultados.push(await procesar(t, !!body.probar)); }
    catch (e) { resultados.push({ comprobante: t?.comprobante, estado: "error", detalle: (e as Error).message }); }
  }
  return json({ ok: true, probar: !!body.probar, resultados });
});
