-- ═══════════════════════════════════════════════════════════════════════════
-- PORTAL DEL TRABAJADOR — VACACIONES
--
-- Qué hace:
--  1. Vincula cada ficha de `personal` con su cuenta de la app (user_id).
--  2. Define quién es "trabajador": la marca va en app_metadata.rol, que solo
--     el servidor puede escribir (user_metadata la puede cambiar el propio
--     usuario, por eso NO se usa para esto).
--  3. Bloqueo de verdad, en la base: una política RESTRICTIVA en todas las
--     tablas de `public` y en los archivos (storage) que dice "si la cuenta es
--     de trabajador, nada". Es restrictiva: se SUMA a las reglas actuales sin
--     tocarlas, así que el equipo de oficina sigue exactamente igual.
--  4. Cada período guarda desde qué fecha se puede usar (disponible_desde);
--     usar días antes de esa fecha es un adelanto acordado.
--  5. El trabajador no lee tablas: usa solo cuatro funciones que entregan SU
--     información y le permiten pedir o anular SUS vacaciones. Las funciones
--     recalculan días hábiles y saldo aquí en la base, no en el navegador.
--
-- Ojo a futuro: cada tabla nueva de `public` debe llevar la misma política
-- `sin_trabajadores` (está anotado en docs/CEREBRO.md y en CLAUDE.md).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ficha ↔ cuenta ──────────────────────────────────────────────────────────
alter table public.personal
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

-- Las solicitudes hechas por el propio trabajador se reconocen por su origen.
alter table public.vacaciones_solicitudes drop constraint if exists vacaciones_solicitudes_origen_check;
alter table public.vacaciones_solicitudes add constraint vacaciones_solicitudes_origen_check
  check (origen = any (array['app'::text, 'excel'::text, 'portal'::text]));

-- 1b. Desde cuándo se puede usar cada período ──────────────────────────────
-- Un período se gana en el aniversario de ingreso. Antes de esa fecha, usar
-- sus días es un ADELANTO (se permite, pero debe estar conversado con
-- Sebastián: el portal lo avisa y la solicitud llega marcada).
-- Se guarda en vez de calcularse porque no siempre calza con el nombre del
-- período (caso real: ingreso en diciembre). Si no se indica, se sugiere el
-- aniversario de ingreso en el año siguiente al de inicio del período.
alter table public.vacaciones_periodos add column if not exists disponible_desde date;

create or replace function public.vac_periodo_disponible_desde()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.disponible_desde is null then
    -- `+ interval` resuelve solo el 29 de febrero (pasa al 28).
    select (pe.fecha_ingreso + make_interval(years => new.anio_inicio + 1 - extract(year from pe.fecha_ingreso)::int))::date
      into new.disponible_desde
      from public.personal pe where pe.id = new.personal_id and pe.fecha_ingreso is not null;
  end if;
  return new;
end $$;
drop trigger if exists vac_periodo_disponible_desde on public.vacaciones_periodos;
create trigger vac_periodo_disponible_desde before insert on public.vacaciones_periodos
  for each row execute function public.vac_periodo_disponible_desde();

-- Períodos ya cargados (26-11-2026): la regla general…
update public.vacaciones_periodos p
   set disponible_desde = (pe.fecha_ingreso + make_interval(years => p.anio_inicio + 1 - extract(year from pe.fecha_ingreso)::int))::date
  from public.personal pe
 where pe.id = p.personal_id and p.disponible_desde is null and pe.fecha_ingreso is not null;
-- …y la excepción confirmada por Seba: el trabajador id 9 (ingreso en
-- diciembre) ganó su "25/26" el 01-12-2025 y su "26/27" el 01-12-2026.
update public.vacaciones_periodos set disponible_desde = make_date(anio_inicio, 12, 1) where personal_id = 9;

-- 2. ¿La cuenta conectada es de trabajador? ──────────────────────────────────
create or replace function public.es_trabajador()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') = 'trabajador', false);
$$;

-- 3. Bloqueo restrictivo en todas las tablas y en storage ────────────────────
-- `(select …)` hace que se evalúe una vez por consulta y no por cada fila.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists sin_trabajadores on public.%I', t.tablename);
    execute format(
      'create policy sin_trabajadores on public.%I as restrictive for all to authenticated '
      'using (not (select public.es_trabajador())) with check (not (select public.es_trabajador()))',
      t.tablename);
  end loop;
end $$;

drop policy if exists sin_trabajadores on storage.objects;
create policy sin_trabajadores on storage.objects as restrictive for all to authenticated
  using (not (select public.es_trabajador())) with check (not (select public.es_trabajador()));

-- 4. Funciones del portal ────────────────────────────────────────────────────
-- Todas son SECURITY DEFINER (pasan por encima del bloqueo), por eso cada una
-- parte averiguando qué ficha corresponde a la cuenta conectada y nunca
-- recibe un id de trabajador desde el navegador.

-- Ficha del trabajador conectado (solo si está activo).
create or replace function public.portal_mi_ficha()
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.personal
   where user_id = auth.uid() and estado = 'activo' and public.es_trabajador()
   limit 1;
$$;

-- Todo lo que ve el trabajador en "Mis vacaciones", en una sola llamada.
create or replace function public.portal_mis_datos()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_pid bigint := public.portal_mi_ficha();
begin
  if v_pid is null then
    raise exception 'Tu cuenta no está vinculada a una ficha de trabajador activa. Habla con Sebastián.';
  end if;
  return jsonb_build_object(
    'trabajador', (select jsonb_build_object('id', id, 'nombre', nombre, 'cargo', cargo,
                          'fecha_ingreso', fecha_ingreso, 'email', email, 'estado', estado)
                     from public.personal where id = v_pid),
    'periodos', coalesce((select jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at' order by p.anio_inicio)
                            from public.vacaciones_periodos p where p.personal_id = v_pid), '[]'::jsonb),
    -- La respuesta de quien aprueba (motivo de rechazo, etc.) sale de la bitácora.
    'solicitudes', coalesce((select jsonb_agg(
                              (to_jsonb(s) - 'creado_por' - 'actualizado_por') || jsonb_build_object(
                                'respuesta', (select b.detalle from public.vacaciones_bitacora b
                                               where b.entidad = 'solicitud' and b.entidad_id = s.id
                                                 and b.accion = 'estado' and b.detalle is not null
                                               order by b.created_at desc limit 1))
                              order by s.fecha_inicio desc)
                               from public.vacaciones_solicitudes s where s.personal_id = v_pid), '[]'::jsonb),
    'distribucion', coalesce((select jsonb_agg(to_jsonb(d) - 'created_at')
                                from public.vacaciones_distribucion d
                                join public.vacaciones_solicitudes s on s.id = d.solicitud_id
                               where s.personal_id = v_pid), '[]'::jsonb),
    'feriados', coalesce((select jsonb_object_agg(fecha, nombre) from public.feriados), '{}'::jsonb)
  );
end $$;

-- Calendario compartido: quién sale y cuándo (sin saldos ni observaciones).
create or replace function public.portal_calendario(p_desde date, p_hasta date)
returns table (nombre text, fecha_inicio date, fecha_fin date, propia boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_pid bigint := public.portal_mi_ficha();
begin
  if v_pid is null then raise exception 'Tu cuenta no está vinculada a una ficha de trabajador activa.'; end if;
  if p_hasta - p_desde > 200 then raise exception 'Rango de fechas demasiado amplio.'; end if;
  return query
    select pe.nombre, s.fecha_inicio, s.fecha_fin, (pe.id = v_pid)
      from public.vacaciones_solicitudes s
      join public.personal pe on pe.id = s.personal_id
     where s.estado = 'aprobado' and pe.estado = 'activo'
       and s.fecha_inicio <= p_hasta and s.fecha_fin >= p_desde
     order by s.fecha_inicio;
end $$;

-- Pedir vacaciones. Calcula días hábiles (sin fines de semana ni feriados),
-- reparte desde el período más antiguo (igual que sugerirDistribucion() de la
-- app) y deja la solicitud Pendiente. Devuelve el id de la solicitud.
create or replace function public.portal_solicitar(p_inicio date, p_fin date, p_obs text default null)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pid    bigint := public.portal_mi_ficha();
  v_email  text   := coalesce(auth.jwt() ->> 'email', 'trabajador');
  v_hoy    date   := (now() at time zone 'America/Santiago')::date;
  v_dias   numeric;
  v_resto  numeric;
  v_usa    numeric;
  v_disp   numeric;
  v_total  numeric := 0;
  v_id     bigint;
  v_dist   text;
  v_adel   numeric := 0;
  r        record;
begin
  if v_pid is null then raise exception 'Tu cuenta no está vinculada a una ficha de trabajador activa. Habla con Sebastián.'; end if;
  if p_inicio is null or p_fin is null then raise exception 'Indica la fecha de inicio y de término.'; end if;
  if p_fin < p_inicio then raise exception 'La fecha de término es anterior a la de inicio.'; end if;
  if p_inicio < v_hoy then raise exception 'No se pueden pedir vacaciones en fechas pasadas.'; end if;
  if p_fin - p_inicio > 90 then raise exception 'El tramo es demasiado largo (máximo 90 días corridos por solicitud).'; end if;
  if length(coalesce(p_obs, '')) > 500 then raise exception 'El comentario es demasiado largo (máximo 500 caracteres).'; end if;

  select count(*) into v_dias
    from generate_series(p_inicio, p_fin, interval '1 day') g(d)
   where extract(isodow from g.d) < 6
     and not exists (select 1 from public.feriados f where f.fecha = g.d::date);
  if v_dias = 0 then raise exception 'Esas fechas no tienen días hábiles: son fin de semana o feriado.'; end if;

  if exists (select 1 from public.vacaciones_solicitudes
              where personal_id = v_pid and estado in ('pendiente','aprobado')
                and fecha_inicio <= p_fin and fecha_fin >= p_inicio) then
    raise exception 'Ya tienes vacaciones pedidas o aprobadas que se cruzan con esas fechas.';
  end if;

  -- Saldo total disponible (aprobadas y pendientes ya lo consumen).
  select coalesce(sum(p.dias_totales - public.vac_dias_usados(p.id)), 0) into v_total
    from public.vacaciones_periodos p where p.personal_id = v_pid;
  if v_dias > v_total then
    raise exception 'Pides % días hábiles, pero tienes % disponibles.', public.vac_num(v_dias), public.vac_num(greatest(v_total, 0));
  end if;

  insert into public.vacaciones_solicitudes
    (personal_id, fecha_inicio, fecha_fin, dias_habiles, estado, observaciones,
     excepcion_saldo, origen, creado_por, actualizado_por)
  values (v_pid, p_inicio, p_fin, v_dias, 'pendiente', nullif(trim(p_obs), ''),
          false, 'portal', v_email, v_email)
  returning id into v_id;

  v_resto := v_dias;
  for r in select p.id, p.dias_totales, p.disponible_desde from public.vacaciones_periodos p
            where p.personal_id = v_pid order by p.anio_inicio loop
    exit when v_resto <= 0;
    v_disp := r.dias_totales - public.vac_dias_usados(r.id);
    if v_disp > 0 then
      v_usa := least(v_disp, v_resto);
      insert into public.vacaciones_distribucion (solicitud_id, periodo_id, dias) values (v_id, r.id, v_usa);
      v_resto := v_resto - v_usa;
      -- Días de un período que aún no se puede usar en la fecha de inicio = adelanto.
      if r.disponible_desde is not null and r.disponible_desde > p_inicio then v_adel := v_adel + v_usa; end if;
    end if;
  end loop;
  if v_resto > 0 then raise exception 'No alcanza el saldo para cubrir esos días.'; end if;

  perform public.vac_verificar_saldo(v_pid, null);

  select string_agg(pe.periodo || ': ' || public.vac_num(d.dias), ', ' order by pe.anio_inicio) into v_dist
    from public.vacaciones_distribucion d join public.vacaciones_periodos pe on pe.id = d.periodo_id
   where d.solicitud_id = v_id;
  insert into public.vacaciones_bitacora (entidad, entidad_id, personal_id, accion, detalle, usuario)
  values ('solicitud', v_id, v_pid, 'crear',
          format('Pedida desde el portal · %s a %s · %s días · pendiente · períodos %s%s',
                 p_inicio, p_fin, public.vac_num(v_dias), coalesce(v_dist, '—'),
                 case when v_adel > 0 then ' · ADELANTO de ' || public.vac_num(v_adel) || ' días' else '' end),
          v_email);
  return v_id;
end $$;

-- Anular una solicitud propia que todavía está pendiente.
create or replace function public.portal_anular(p_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pid   bigint := public.portal_mi_ficha();
  v_email text   := coalesce(auth.jwt() ->> 'email', 'trabajador');
  v_s     public.vacaciones_solicitudes%rowtype;
begin
  if v_pid is null then raise exception 'Tu cuenta no está vinculada a una ficha de trabajador activa.'; end if;
  select * into v_s from public.vacaciones_solicitudes where id = p_id and personal_id = v_pid;
  if not found then raise exception 'No se encontró esa solicitud.'; end if;
  if v_s.estado <> 'pendiente' then
    raise exception 'Solo puedes anular solicitudes pendientes. Para cambiar vacaciones ya aprobadas, habla con Sebastián.';
  end if;
  update public.vacaciones_solicitudes set estado = 'cancelado', actualizado_por = v_email where id = p_id;
  insert into public.vacaciones_bitacora
    (entidad, entidad_id, personal_id, accion, campo, valor_anterior, valor_nuevo, detalle, usuario)
  values ('solicitud', p_id, v_pid, 'estado', 'estado', 'pendiente', 'cancelado',
          'Anulada por el trabajador desde el portal', v_email);
end $$;

-- Permisos: solo cuentas con sesión (anon no).
revoke all on function public.es_trabajador()              from public, anon;
revoke all on function public.portal_mi_ficha()            from public, anon;
revoke all on function public.portal_mis_datos()           from public, anon;
revoke all on function public.portal_calendario(date,date) from public, anon;
revoke all on function public.portal_solicitar(date,date,text) from public, anon;
revoke all on function public.portal_anular(bigint)        from public, anon;
grant execute on function public.es_trabajador()              to authenticated;
grant execute on function public.portal_mi_ficha()            to authenticated;
grant execute on function public.portal_mis_datos()           to authenticated;
grant execute on function public.portal_calendario(date,date) to authenticated;
grant execute on function public.portal_solicitar(date,date,text) to authenticated;
grant execute on function public.portal_anular(bigint)        to authenticated;
