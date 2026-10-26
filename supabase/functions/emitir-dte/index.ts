// emitir-dte — envía a GDExpress una factura (33) o guía de despacho (52)
// armada en la app "Creación de documentos", con folio automático, y
// devuelve el folio asignado y el PDF oficial.
//
// Seguridad:
//  * La llave de GDExpress solo vive aquí (secretos de Supabase), nunca en
//    el navegador.
//  * Solo usuarios con rol "editor" pueden emitir.
//  * El ambiente lo decide el servidor con el secreto DTE_AMBIENTE:
//    "T" = homologación (pruebas, por defecto) / "P" = producción.
//
// Secretos necesarios: DTEBOX_IP, GDEXPRESS_API_KEY, DTE_AMBIENTE (opcional).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RUT_EMISOR = "76186755-5";
const RESOLUCION = { fecha: "2014-08-22", numero: "80" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// El XML va en ISO-8859-1 (como los documentos que ya emite GDExpress).
function latin1Base64(texto: string): string {
  let bin = "";
  for (const ch of texto) {
    const c = ch.codePointAt(0)!;
    bin += String.fromCharCode(c <= 255 ? c : 63); // fuera de latin1 → "?"
  }
  return btoa(bin);
}
function base64Latin1(b64: string): string {
  try { return atob(b64); } catch { return ""; }
}

async function usuarioEditor(req: Request): Promise<{ ok: boolean; email?: string }> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return { ok: false };
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
  });
  if (!r.ok) return { ok: false };
  const u = await r.json();
  return { ok: u?.app_metadata?.rol === "editor", email: u?.email };
}

async function gdx(ruta: string, metodo: "GET" | "POST", body?: unknown) {
  const ip = Deno.env.get("DTEBOX_IP");
  const key = Deno.env.get("GDEXPRESS_API_KEY");
  const r = await fetch(`http://${ip}/api/Core.svc/core/${ruta}`, {
    method: metodo,
    headers: { AuthKey: key || "", "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await r.text();
  try { return { http: r.status, data: JSON.parse(texto) }; } catch { return { http: r.status, data: { Result: 1, Description: texto.slice(0, 300) } }; }
}

// PDF oficial: GDExpress publica el documento unos minutos después de
// emitirlo; la búsqueda paginada trae entonces el enlace de descarga
// (DownloadCustomerDocumentUrl). Se descarga aquí y se devuelve en base64
// para que la app lo muestre e imprima sin depender del portal.
async function pdfDe(ambiente: string, tipo: number, folio: string) {
  try {
    const q = btoa(`(RUTEmisor:${RUT_EMISOR} AND TipoDTE:${tipo} AND Folio:${folio})`);
    const r = await gdx(`PaginatedSearch/${ambiente}/E/${q}/1/5`, "GET");
    if (!r.data?.Data) return {};
    const xml = base64Latin1(r.data.Data);
    const m = /<DownloadCustomerDocumentUrl>([^<]+)<\/DownloadCustomerDocumentUrl>/.exec(xml);
    if (!m) return {};
    const url = m[1].replace(/&amp;/g, "&");
    try {
      const d = await fetch(url);
      const tipoContenido = d.headers.get("content-type") || "";
      if (d.ok && tipoContenido.includes("pdf")) {
        const bytes = new Uint8Array(await d.arrayBuffer());
        let bin = "";
        for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
        return { pdfBase64: btoa(bin), pdfUrl: url };
      }
    } catch { /* si no se pudo descargar, queda el enlace */ }
    return { pdfUrl: url };
  } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  const ambiente = (Deno.env.get("DTE_AMBIENTE") || "T").toUpperCase() === "P" ? "P" : "T";
  const configurado = !!Deno.env.get("DTEBOX_IP") && !!Deno.env.get("GDEXPRESS_API_KEY");
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }

  // Consulta de estado (para mostrar el modo en la app).
  if (body.accion === "estado") return json({ ok: true, ambiente, configurado });

  const u = await usuarioEditor(req);
  if (!u.ok) return json({ ok: false, error: "Solo un usuario editor puede emitir documentos." }, 403);
  if (!configurado) return json({ ok: false, error: "Falta configurar la llave de GDExpress en Supabase (DTEBOX_IP y GDEXPRESS_API_KEY)." }, 500);

  const tipo = Number(body.tipo);

  // Volver a pedir el PDF de un documento ya emitido (cuando GDExpress aún no lo publicaba).
  if (body.accion === "pdf") {
    const folio = String(body.folio || "").replace(/\D/g, "");
    if (![33, 52].includes(tipo) || !folio) return json({ ok: false, error: "Documento inválido." }, 400);
    const amb = body.ambiente === "T" || body.ambiente === "P" ? String(body.ambiente) : ambiente;
    return json({ ok: true, ambiente: amb, folio, ...(await pdfDe(amb, tipo, folio)) });
  }

  let xml = String(body.xml || "");
  if (![33, 52].includes(tipo) || !xml.includes("<DTE")) return json({ ok: false, error: "Documento inválido." }, 400);
  xml = xml.replace(/^\s*<\?xml[^>]*\?>\s*/, ""); // GDExpress espera el <DTE> directo
  if (!new RegExp(`<TipoDTE>${tipo}</TipoDTE>`).test(xml)) return json({ ok: false, error: "El tipo de documento no coincide." }, 400);

  const envio = await gdx("SendDocumentAsXMLFolio", "POST", {
    Environment: ambiente,
    Content: latin1Base64(xml),
    ResolutionDate: RESOLUCION.fecha,
    ResolutionNumber: RESOLUCION.numero,
    PDF417Columns: "5",
    PDF417Level: "2",
    PDF417Type: "1",
  });
  const d = envio.data || {};
  if (String(d.Result) !== "0") {
    return json({ ok: false, ambiente, error: d.Description || `GDExpress respondió con error (HTTP ${envio.http}).`, respuesta: d });
  }

  // El folio asignado viene en el timbre (TED): <F>folio</F>.
  const ted = d.TED ? base64Latin1(d.TED) : "";
  const folio = (/<F>(\d+)<\/F>/.exec(ted) || [])[1] || null;
  const pdf = folio ? await pdfDe(ambiente, tipo, folio) : {};
  console.log(`emitir-dte: ${u.email} emitió tipo ${tipo} folio ${folio} en ${ambiente}`);
  return json({ ok: true, ambiente, folio, ...pdf, descripcion: d.Description || "" });
});
