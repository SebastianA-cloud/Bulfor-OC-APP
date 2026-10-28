// buscar-factura — busca en GDExpress, en el momento, facturas (33) recién
// emitidas que la app todavía no tiene (la sincronización corre cada cierto
// rato). Devuelve el cliente, su RUT, la fecha, el neto y la OC.
//
// Solo lee: no emite ni modifica nada en GDExpress ni en la base de datos.
//
// Seguridad:
//  * La llave de GDExpress solo vive aquí (secretos de Supabase), nunca en
//    el navegador.
//  * Solo usuarios con sesión iniciada en la app pueden consultar.
//  * Siempre busca en producción ("P"): son los documentos reales emitidos.
//
// Secretos necesarios (los mismos de emitir-dte): DTEBOX_IP, GDEXPRESS_API_KEY.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RUT_EMISOR = "76186755-5";
const PATRON_OC = /\b\d{3,9}-\d{1,6}-[A-Z]{2,4}\d{2,4}\b/;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function usuarioConSesion(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
  });
  if (!r.ok) return false;
  const u = await r.json();
  return !!u?.email;
}

// El resultado de la búsqueda viene como XML en base64 (ISO-8859-1).
function base64Latin1(b64: string): string {
  try { return atob(b64); } catch { return ""; }
}
const campo = (xml: string, tag: string) => {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return m ? m[1].replace(/&amp;/g, "&").trim() : "";
};

async function buscarFolio(folio: string) {
  const ip = Deno.env.get("DTEBOX_IP");
  const key = Deno.env.get("GDEXPRESS_API_KEY");
  const q = btoa(`(RUTEmisor:${RUT_EMISOR} AND TipoDTE:33 AND Folio:${folio})`);
  const r = await fetch(`http://${ip}/api/Core.svc/core/PaginatedSearch/P/E/${q}/1/5`, {
    headers: { AuthKey: key || "", Accept: "application/json" },
  });
  const d = await r.json().catch(() => ({}));
  if (!d?.Data) return null;
  const xml = base64Latin1(d.Data);
  const doc = /<document>([\s\S]*?)<\/document>/.exec(xml)?.[1];
  if (!doc || campo(doc, "Folio") !== folio) return null;
  const fecha = (campo(doc, "FchEmis") || campo(doc, "EmissionDate") || campo(doc, "DocumentDate")).slice(0, 10);
  return {
    folio,
    rut: campo(doc, "RUTRecep"),
    hospital: campo(doc, "RznSocRecep"),
    fecha_emision: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    neto: Number(campo(doc, "MntNeto")) || null,
    oc: PATRON_OC.exec(campo(doc, "DocumentReferences"))?.[0] || null,
    doc_url: campo(doc, "DownloadCustomerDocumentUrl") || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);
  if (!(await usuarioConSesion(req))) return json({ ok: false, error: "Inicia sesión en la app para buscar facturas." }, 401);
  if (!Deno.env.get("DTEBOX_IP") || !Deno.env.get("GDEXPRESS_API_KEY")) return json({ ok: false, error: "Falta configurar la llave de GDExpress en Supabase." }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  // Hasta 5 folios por consulta (un envío rara vez lleva más).
  const folios = [...new Set((Array.isArray(body.folios) ? body.folios : []).map((f) => String(f).replace(/\D/g, "")).filter((f) => f.length >= 3))].slice(0, 5);
  if (!folios.length) return json({ ok: false, error: "Indica al menos un N° de factura." }, 400);

  try {
    const facturas = (await Promise.all(folios.map(buscarFolio))).filter(Boolean);
    return json({ ok: true, facturas });
  } catch (e) {
    return json({ ok: false, error: "No se pudo consultar GDExpress: " + (e as Error).message }, 502);
  }
});
