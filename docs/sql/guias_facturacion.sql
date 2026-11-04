-- PROPUESTA: ejecutar únicamente con aprobación de Seba.
-- Agrega registros de seguimiento; no modifica documentos tributarios ni pagos.
begin;
create schema if not exists guias_privado;
revoke all on schema guias_privado from public, anon, authenticated;

create table public.guias_facturacion_grupos (
  factura_id bigint primary key references public.documentos_gdexpress(id),
  periodo date not null check (extract(day from periodo)=1),
  etiqueta text not null check (length(trim(etiqueta)) between 1 and 80),
  orden_compra text not null default '' check (length(orden_compra)<=80),
  cotizacion text not null default '' check (length(cotizacion)<=80),
  motivo text not null check (length(trim(motivo)) between 1 and 500),
  version integer not null default 1 check(version>0)
);
create table public.guias_facturacion_enlaces (
  guia_id bigint primary key references public.documentos_gdexpress(id),
  factura_id bigint not null references public.guias_facturacion_grupos(factura_id)
);
create index guias_facturacion_enlaces_factura on public.guias_facturacion_enlaces(factura_id);
create table public.guias_facturacion_historial (
  id bigint generated always as identity primary key,
  factura_id bigint not null references public.documentos_gdexpress(id),
  creado_en timestamptz not null default now(),
  usuario_id uuid not null,
  accion text not null,
  detalle jsonb not null
);
create index guias_facturacion_historial_factura on public.guias_facturacion_historial(factura_id,creado_en desc);
revoke all on sequence public.guias_facturacion_historial_id_seq from public,anon,authenticated;
alter table public.guias_facturacion_grupos enable row level security;
alter table public.guias_facturacion_enlaces enable row level security;
alter table public.guias_facturacion_historial enable row level security;
revoke all on public.guias_facturacion_grupos,public.guias_facturacion_enlaces,public.guias_facturacion_historial from public,anon,authenticated;
grant select,insert,update on public.guias_facturacion_grupos to authenticated;
grant select,insert,delete on public.guias_facturacion_enlaces to authenticated;
grant select on public.guias_facturacion_historial to authenticated;
create policy leer_autenticados on public.guias_facturacion_grupos for select to authenticated using ((select auth.uid()) is not null);
create policy insertar_editores on public.guias_facturacion_grupos for insert to authenticated with check ((select auth.jwt()->'app_metadata'->>'rol')='editor');
create policy actualizar_editores on public.guias_facturacion_grupos for update to authenticated using ((select auth.jwt()->'app_metadata'->>'rol')='editor') with check ((select auth.jwt()->'app_metadata'->>'rol')='editor');
create policy leer_autenticados on public.guias_facturacion_enlaces for select to authenticated using ((select auth.uid()) is not null);
create policy insertar_editores on public.guias_facturacion_enlaces for insert to authenticated with check ((select auth.jwt()->'app_metadata'->>'rol')='editor');
create policy eliminar_editores on public.guias_facturacion_enlaces for delete to authenticated using ((select auth.jwt()->'app_metadata'->>'rol')='editor');
create policy leer_autenticados on public.guias_facturacion_historial for select to authenticated using ((select auth.uid()) is not null);

-- Trigger privado: valida invariantes incluso si un editor usa la API directa.
-- SECURITY DEFINER solo para registrar el historial inmutable; no se expone por RPC.
create function guias_privado.validar_y_auditar() returns trigger
language plpgsql security definer set search_path='' as $$
declare f public.documentos_gdexpress; g public.documentos_gdexpress; v_factura bigint; datos jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'rol','')<>'editor' then
    raise exception 'Solo editores autenticados pueden modificar asociaciones';
  end if;
  v_factura:=case when TG_OP='DELETE' then OLD.factura_id else NEW.factura_id end;
  select * into f from public.documentos_gdexpress where id=v_factura;
  if f.id is null or f.tipo_dte<>'33' then raise exception 'La factura no es válida'; end if;
  if TG_TABLE_NAME='guias_facturacion_grupos' and TG_OP='UPDATE' and NEW.factura_id<>OLD.factura_id then raise exception 'No se permite cambiar la identidad de la factura'; end if;
  if TG_TABLE_NAME='guias_facturacion_enlaces' and TG_OP='INSERT' then
    if f.estado_aceptacion='N' or f.estado_reclamo='RCD'
      or exists(select 1 from public.facturas_pago p where p.factura=f.folio and regexp_replace(p.rut_hospital,'[^0-9kK]','','g')=regexp_replace(f.rut_hospital,'[^0-9kK]','','g') and (p.anulada or nullif(p.factura_reemplazo,'') is not null or nullif(p.nota_credito_asociada,'') is not null))
      or exists(select 1 from public.documentos_gdexpress n where n.tipo_dte='61' and n.nc_factura_ref=f.folio and regexp_replace(n.rut_hospital,'[^0-9kK]','','g')=regexp_replace(f.rut_hospital,'[^0-9kK]','','g')) then
        raise exception 'Factura anulada, rechazada o con nota de crédito: revisar antes de asociar';
    end if;
  end if;
  if TG_TABLE_NAME='guias_facturacion_enlaces' then
    select * into g from public.documentos_gdexpress where id=case when TG_OP='DELETE' then OLD.guia_id else NEW.guia_id end;
    if TG_OP<>'DELETE' and (g.tipo_dte<>'52' or nullif(regexp_replace(f.rut_hospital,'[^0-9kK]','','g'),'') is null or upper(regexp_replace(g.rut_hospital,'[^0-9kK]','','g')) is distinct from upper(regexp_replace(f.rut_hospital,'[^0-9kK]','','g'))) then raise exception 'La guía debe pertenecer al mismo hospital'; end if;
  end if;
  datos:=jsonb_build_object('antes',case when TG_OP='INSERT' then null else to_jsonb(OLD) end,'despues',case when TG_OP='DELETE' then null else to_jsonb(NEW) end,'factura',f.folio,'guia',g.folio);
  insert into public.guias_facturacion_historial(factura_id,usuario_id,accion,detalle) values(v_factura,auth.uid(),TG_TABLE_NAME||' '||TG_OP,datos);
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
revoke all on function guias_privado.validar_y_auditar() from public,anon,authenticated;
create trigger validar_auditar after insert or update on public.guias_facturacion_grupos for each row execute function guias_privado.validar_y_auditar();
create trigger validar_auditar after insert or delete on public.guias_facturacion_enlaces for each row execute function guias_privado.validar_y_auditar();

-- Una transacción por factura; versión evita sobrescribir otra edición.
-- Invoker conserva las políticas de lectura/escritura del usuario.
create function public.guias_facturacion_guardar(p_factura bigint,p_version integer,p_periodo date,p_etiqueta text,p_oc text,p_cot text,p_motivo text,p_guias bigint[])
returns integer language plpgsql security invoker set search_path='' as $$
declare v_version integer;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'rol','')<>'editor' then raise exception 'Solo editores pueden guardar asociaciones'; end if;
  -- Serializa incluso la primera edición de una factura sin grupo.
  perform pg_catalog.pg_advisory_xact_lock(p_factura);
  select version into v_version from public.guias_facturacion_grupos where factura_id=p_factura for update;
  if coalesce(v_version,0)<>p_version then raise exception 'Otra persona modificó esta asociación. Recarga antes de guardar'; end if;
  if p_guias is null or cardinality(p_guias)<>(select count(distinct x) from unnest(p_guias) x) then raise exception 'Selección de guías inválida'; end if;
  -- La PK de guia_id impide reservas concurrentes por dos facturas; el fallo
  -- revierte toda la transacción, sin necesitar permisos de edición de DTE.
  if (select count(*) from public.documentos_gdexpress where id=any(p_guias) and tipo_dte='52')<>cardinality(p_guias) then raise exception 'Hay guías inexistentes o inválidas'; end if;
  if exists(select 1 from public.guias_facturacion_enlaces where guia_id=any(p_guias) and factura_id<>p_factura) then raise exception 'Una guía ya está asociada a otra factura'; end if;
  insert into public.guias_facturacion_grupos(factura_id,periodo,etiqueta,orden_compra,cotizacion,motivo,version)
    values(p_factura,p_periodo,trim(p_etiqueta),upper(trim(p_oc)),upper(trim(p_cot)),trim(p_motivo),1)
    on conflict(factura_id) do update set periodo=excluded.periodo,etiqueta=excluded.etiqueta,orden_compra=excluded.orden_compra,cotizacion=excluded.cotizacion,motivo=excluded.motivo,version=public.guias_facturacion_grupos.version+1;
  delete from public.guias_facturacion_enlaces where factura_id=p_factura and not(guia_id=any(p_guias));
  insert into public.guias_facturacion_enlaces(guia_id,factura_id) select x,p_factura from unnest(p_guias) x where not exists(select 1 from public.guias_facturacion_enlaces e where e.guia_id=x and e.factura_id=p_factura);
  return coalesce(v_version,0)+1;
end $$;
revoke all on function public.guias_facturacion_guardar(bigint,integer,date,text,text,text,text,bigint[]) from public,anon;
grant execute on function public.guias_facturacion_guardar(bigint,integer,date,text,text,text,text,bigint[]) to authenticated;
notify pgrst,'reload schema';
commit;
