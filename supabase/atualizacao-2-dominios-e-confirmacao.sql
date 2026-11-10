-- =====================================================================
-- Portal de Leads · atualização 2
-- 1) Aceita também e-mails @azulcargo.com.br no cadastro.
-- 2) Prepara a confirmação de e-mail: o time passa a ver no portal
--    se cada pessoa já clicou no link de confirmação.
-- Pode rodar mais de uma vez sem problema. Não apaga nenhum dado.
-- =====================================================================

insert into public.dominios_permitidos (dominio) values ('azulcargo.com.br')
  on conflict do nothing;

alter table public.perfis add column if not exists email_confirmado boolean not null default false;

create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dominio text := lower(split_part(new.email, '@', 2));
  dados   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_regiao text := nullif(dados ->> 'regiao', '');
begin
  if not exists (select 1 from public.dominios_permitidos d where d.dominio = v_dominio) then
    raise exception 'Use seu e-mail corporativo da Azul.';
  end if;
  if v_regiao is not null and v_regiao not in ('Sudeste', 'Sul', 'Centro Oeste', 'Nordeste', 'Norte') then
    v_regiao := null;
  end if;

  insert into public.perfis (id, nome, email, celular, sigla, cidade_uf, regiao, email_confirmado)
  values (
    new.id,
    coalesce(nullif(trim(dados ->> 'nome'), ''), new.email),
    lower(new.email),
    nullif(trim(dados ->> 'celular'), ''),
    coalesce(nullif(upper(trim(dados ->> 'sigla')), ''), 'SEM SIGLA'),
    nullif(trim(dados ->> 'cidade_uf'), ''),
    v_regiao,
    new.email_confirmed_at is not null
  );
  return new;
end;
$$;

create or replace function public.ao_confirmar_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.perfis set email_confirmado = (new.email_confirmed_at is not null) where id = new.id;
  return new;
end;
$$;

drop trigger if exists ao_confirmar_email on auth.users;
create trigger ao_confirmar_email
  after update of email_confirmed_at on auth.users
  for each row execute function public.ao_confirmar_email();

-- Quem já tinha cadastro (confirmação estava desligada) fica como confirmado.
update public.perfis p set email_confirmado = true
  from auth.users u where u.id = p.id and u.email_confirmed_at is not null and not p.email_confirmado;

-- Conferência: deve listar os dois domínios.
select dominio from public.dominios_permitidos order by dominio;
