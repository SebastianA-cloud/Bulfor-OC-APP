// /api/notificar-receta.js
//
// Vercel detecta este archivo solo (no hace falta configurar nada más).
// Supabase le avisa a esta URL cada vez que se crea una nueva Orden de
// Elaboración (que es el momento exacto en que se sube una receta y queda
// "Por digitar"), y esta función manda el correo de aviso con Resend.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Chequeo simple de seguridad: Supabase manda este header con el secreto
  // que configuramos, para que nadie más pueda llamar a esta función.
  const secretoRecibido = req.headers['x-webhook-secret'];
  if (secretoRecibido !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const body = req.body;
    const registro = body?.record || {};
    const indicacion = registro.indicacion || 'Sin detalle';

    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Bulfor OC <onboarding@resend.dev>',
        to: [process.env.NOTIFY_EMAIL],
        subject: 'Se ha subido una receta — Por digitar',
        html: `
          <p>Se ha subido una receta a la plataforma de Órdenes de Elaboración.</p>
          <p><strong>Preparado:</strong> ${indicacion}</p>
          <p>Entra a la app para revisarla.</p>
        `,
      }),
    });

    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      console.error('Error de Resend:', textoError);
      return res.status(502).json({ error: 'No se pudo enviar el correo', detalle: textoError });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Error en notificar-receta:', e);
    return res.status(500).json({ error: e.message });
  }
}
