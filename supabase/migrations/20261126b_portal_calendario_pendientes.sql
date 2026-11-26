-- ═══════════════════════════════════════════════════════════════════════════
-- PORTAL DEL TRABAJADOR — calendario del equipo con solicitudes pendientes
--
-- Pedido de Seba (26-11-2026): al pedir días, el trabajador debe ver un aviso
-- si esas fechas chocan con las de otra persona que ya pidió antes, aunque
-- todavía no esté aprobada. Por eso portal_calendario ahora entrega también
-- las solicitudes PENDIENTES (con su estado) y acepta un rango de hasta un
-- año. Sigue entregando solo nombre, fechas y estado: nada de saldos ni
-- comentarios de los demás.
-- Cambia el tipo de lo que devuelve, por eso se borra y se vuelve a crear.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.portal_calendario(date, date);

create function public.portal_calendario(p_desde date, p_hasta date)
returns table (nombre text, fecha_inicio date, fecha_fin date, propia boolean, estado text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_pid bigint := public.portal_mi_ficha();
begin
  if v_pid is null then raise exception 'Tu cuenta no está vinculada a una ficha de trabajador activa.'; end if;
  if p_hasta - p_desde > 400 then raise exception 'Rango de fechas demasiado amplio.'; end if;
  return query
    select pe.nombre, s.fecha_inicio, s.fecha_fin, (pe.id = v_pid), s.estado
      from public.vacaciones_solicitudes s
      join public.personal pe on pe.id = s.personal_id
     where s.estado in ('aprobado', 'pendiente') and pe.estado = 'activo'
       and s.fecha_inicio <= p_hasta and s.fecha_fin >= p_desde
     order by s.fecha_inicio;
end $$;

revoke all on function public.portal_calendario(date,date) from public, anon;
grant execute on function public.portal_calendario(date,date) to authenticated;
