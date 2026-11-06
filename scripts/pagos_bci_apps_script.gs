// Pagos a proveedores desde los avisos de BCI — Google Apps Script
// Va en la cuenta de Google de genoveva@farmaciabulfor.cl (script.google.com).
//
// Cada hora busca los correos "Aviso de transferencia de fondos" de BCI de los
// últimos 3 días, saca de cada uno destino, monto, fecha, N° de comprobante y
// mensaje ("FACTURA 4020"), y los manda a la función registrar-pago-bci de
// Supabase, que marca la factura como pagada en Facturas por pagar.
// Si un correo ya se mandó antes, Supabase lo reconoce por el comprobante y no
// hace nada: se puede correr las veces que sea.
//
// La clave NO va en este archivo: se guarda en Configuración del proyecto →
// Propiedades de la secuencia de comandos → PAGOS_BCI_TOKEN (la misma que el
// secreto PAGOS_BCI_TOKEN de Supabase).

const URL_FUNCION = 'https://uodijcksuqaaovohutkf.supabase.co/functions/v1/registrar-pago-bci';
// Clave pública (anon) de la app: la misma que ya está en index.html.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZGlqY2tzdXFhYW92b2h1dGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDk1MTAsImV4cCI6MjA5NzAyNTUxMH0._gRO2Rp6eVD8u3aLJvhJPxLGfrZ9d9gMjqChQl7DyLQ';
const BUSQUEDA = 'from:contacto@bci.cl subject:"Aviso de transferencia de fondos"';

const ENTIDADES = { nbsp: ' ', amp: '&', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', ordm: 'º', deg: '°' };
function quitarHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&(\w+);/g, (_, e) => ENTIDADES[e] || ' ');
}

// Lee un aviso de BCI. Devuelve null si no es una transferencia de la empresa.
function leerAviso(mensaje) {
  // Texto plano del correo (si no trae, el HTML sin etiquetas), en una sola línea.
  const plano = mensaje.getPlainBody() || '';
  const base = plano.indexOf('Monto transferido') >= 0 ? plano : quitarHtml(mensaje.getBody());
  const texto = base.replace(/\|/g, ' ').replace(/\s+/g, ' ');
  if (texto.indexOf('76186755-5') < 0) return null;          // solo cuentas de la sociedad
  const sacar = (re) => { const m = texto.match(re); return m ? m[1].trim() : ''; };
  const aviso = {
    destino: sacar(/Nombre:\s*(.*?)\s*Monto transferido:/i),
    monto: sacar(/Monto transferido:\s*\$?\s*([\d.,]+)/i),
    comprobante: sacar(/N\S{0,2}\s*de comprobante:\s*(\d+)/i),
    fecha: sacar(/Fecha:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i),
    mensaje: sacar(/Mensaje:\s*(.*?)\s*Por tu seguridad/i),
    gmail_id: mensaje.getId(),
  };
  return aviso.comprobante && aviso.monto ? aviso : null;
}

function enviar(transferencias, probar) {
  const token = PropertiesService.getScriptProperties().getProperty('PAGOS_BCI_TOKEN');
  if (!token) throw new Error('Falta la propiedad PAGOS_BCI_TOKEN en la configuración del proyecto.');
  const r = UrlFetchApp.fetch(URL_FUNCION, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ANON, apikey: ANON, 'x-bulfor-token': token },
    payload: JSON.stringify({ transferencias: transferencias, probar: !!probar }),
  });
  if (r.getResponseCode() !== 200) throw new Error('Supabase respondió ' + r.getResponseCode() + ': ' + r.getContentText());
  return JSON.parse(r.getContentText()).resultados || [];
}

function buscar(dias) {
  const lista = [];
  GmailApp.search(BUSQUEDA + ' newer_than:' + dias + 'd', 0, 100).forEach((hilo) =>
    hilo.getMessages().forEach((m) => { const a = leerAviso(m); if (a) lista.push(a); }));
  return lista;
}

// La que corre sola cada hora.
function revisarPagosBci() {
  const lista = buscar(3);
  if (!lista.length) return;
  enviar(lista, false).forEach((r) => {
    if (r.estado !== 'ya_procesado') console.log(r.fecha + ' ' + r.destino + ' $' + r.monto + ' → ' + r.estado + ': ' + r.detalle);
  });
}

// Prueba sin cambiar nada: muestra qué haría con los avisos del último mes.
function probar() {
  const lista = buscar(30);
  console.log('Avisos de transferencia encontrados: ' + lista.length);
  enviar(lista, true).forEach((r) => console.log(r.fecha + ' ' + r.destino + ' $' + r.monto + ' "' + r.mensaje + '" → ' + r.estado + ': ' + r.detalle));
}

// Correr una sola vez para dejarlo funcionando cada hora.
function instalar() {
  ScriptApp.getProjectTriggers().forEach((t) => { if (t.getHandlerFunction() === 'revisarPagosBci') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('revisarPagosBci').timeBased().everyHours(1).create();
  console.log('Listo: revisarPagosBci correrá cada hora.');
}
