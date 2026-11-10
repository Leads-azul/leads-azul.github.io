-- =====================================================================
-- Portal de Leads Leads2b · banco de dados (Supabase)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sem perder dados: ele só cria o que ainda não existe
-- e atualiza funções e regras.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

-- Domínios de e-mail aceitos no cadastro.
-- Para aceitar outro domínio:  insert into dominios_permitidos values ('outrodominio.com.br');
create table if not exists public.dominios_permitidos (
  dominio text primary key
);
insert into public.dominios_permitidos (dominio) values ('voeazul.com.br')
  on conflict do nothing;

-- Uma linha por pessoa cadastrada (representante ou time de Inside Sales).
create table if not exists public.perfis (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text not null,
  email      text not null unique,
  celular    text,
  sigla      text not null check (sigla <> ''),
  cidade_uf  text,
  regiao     text check (regiao in ('Sudeste', 'Sul', 'Centro Oeste', 'Nordeste', 'Norte')),
  papel      text not null default 'representante' check (papel in ('representante', 'time')),
  situacao   text not null default 'pendente' check (situacao in ('pendente', 'aprovado', 'recusado')),
  criado_em  timestamptz not null default now()
);

-- Um pedido de leads por linha.
create table if not exists public.solicitacoes (
  id               bigint generated always as identity primary key,
  sigla            text not null,
  solicitante      uuid references public.perfis (id) on delete set null,
  solicitante_nome text,
  regiao           text,
  cidade_uf        text,
  segmento_1       text not null,
  segmento_2       text,
  segmento_3       text,
  empresas         text,
  situacao         text not null default 'Nova'
                   check (situacao in ('Nova', 'Em extração', 'Enviada', 'Concluída', 'Sem leads', 'Cancelada')),
  responsavel      text,
  observacao_time  text,
  criada_em        timestamptz not null default now(),
  enviada_em       timestamptz,
  concluida_em     timestamptz
);

-- Um lead (empresa) por linha, sempre ligado a um pedido e a uma loja.
create table if not exists public.leads (
  id              bigint generated always as identity primary key,
  solicitacao_id  bigint not null references public.solicitacoes (id) on delete cascade,
  sigla           text not null,
  empresa         text not null,
  cnpj            text,
  segmento        text,
  cidade_uf       text,
  contato         text,
  telefone        text,
  email           text,
  status          text not null default 'Novo'
                  check (status in ('Novo', 'Tentando contato', 'Em negociação', 'Fechou', 'Sem interesse', 'Contato inválido')),
  data_contato    date,
  observacao      text,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid
);

create index if not exists leads_sigla_idx on public.leads (sigla);
create index if not exists leads_solicitacao_idx on public.leads (solicitacao_id);
create index if not exists solicitacoes_sigla_idx on public.solicitacoes (sigla);

-- ---------------------------------------------------------------------
-- 2. Funções de apoio
-- ---------------------------------------------------------------------

-- Status que encerram um lead.
create or replace function public.status_final(p_status text)
returns boolean language sql immutable set search_path = public as $$
  select p_status in ('Fechou', 'Sem interesse', 'Contato inválido');
$$;

-- A pessoa logada é do time de Inside Sales (e está aprovada)?
create or replace function public.eh_time()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and papel = 'time' and situacao = 'aprovado'
  );
$$;

-- Sigla da loja da pessoa logada (só se o cadastro estiver aprovado).
create or replace function public.minha_sigla()
returns text language sql stable security definer set search_path = public as $$
  select sigla from public.perfis
  where id = auth.uid() and situacao = 'aprovado';
$$;

-- ---------------------------------------------------------------------
-- 3. Cadastro: cria o perfil e barra e-mails fora da Azul
-- ---------------------------------------------------------------------
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

  insert into public.perfis (id, nome, email, celular, sigla, cidade_uf, regiao)
  values (
    new.id,
    coalesce(nullif(trim(dados ->> 'nome'), ''), new.email),
    lower(new.email),
    nullif(trim(dados ->> 'celular'), ''),
    coalesce(nullif(upper(trim(dados ->> 'sigla')), ''), 'SEM SIGLA'),
    nullif(trim(dados ->> 'cidade_uf'), ''),
    v_regiao
  );
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- ---------------------------------------------------------------------
-- 4. Pedido novo: preenche dados da loja e aplica o bloqueio
-- ---------------------------------------------------------------------
create or replace function public.antes_de_solicitar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.perfis;
  abertos integer;
begin
  select * into p from public.perfis where id = auth.uid();

  if not public.eh_time() then
    if p.id is null or p.situacao <> 'aprovado' then
      raise exception 'Seu cadastro ainda não foi aprovado pelo time de Inside Sales.';
    end if;
    -- O representante só pede para a própria loja, e o pedido sempre nasce como "Nova".
    new.sigla            := p.sigla;
    new.solicitante      := p.id;
    new.solicitante_nome := p.nome;
    new.regiao           := p.regiao;
    new.cidade_uf        := p.cidade_uf;
    new.situacao         := 'Nova';
    new.responsavel      := null;
    new.observacao_time  := null;
    new.enviada_em       := null;
    new.concluida_em     := null;
  end if;

  new.sigla := upper(trim(new.sigla));
  if new.solicitante is not null then
    select * into p from public.perfis where id = new.solicitante;
    new.solicitante_nome := coalesce(new.solicitante_nome, p.nome);
    new.regiao           := coalesce(new.regiao, p.regiao);
    new.cidade_uf        := coalesce(new.cidade_uf, p.cidade_uf);
  end if;
  new.criada_em := now();

  -- Regra principal: só pede uma base nova quem finalizou todos os leads da loja.
  select count(*) into abertos
  from public.leads
  where sigla = new.sigla and not public.status_final(status);
  if abertos > 0 then
    raise exception 'A loja % ainda tem % lead(s) sem status final. Finalize todos para pedir uma nova base.', new.sigla, abertos;
  end if;

  if exists (
    select 1 from public.solicitacoes
    where sigla = new.sigla and situacao in ('Nova', 'Em extração')
  ) then
    raise exception 'A loja % já tem um pedido em andamento. Aguarde o envio dos leads.', new.sigla;
  end if;

  return new;
end;
$$;

drop trigger if exists antes_de_solicitar on public.solicitacoes;
create trigger antes_de_solicitar
  before insert on public.solicitacoes
  for each row execute function public.antes_de_solicitar();

-- ---------------------------------------------------------------------
-- 5. Leads: loja vem do pedido; representante só mexe em status, data e observação
-- ---------------------------------------------------------------------
create or replace function public.antes_de_gravar_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select s.sigla into new.sigla from public.solicitacoes s where s.id = new.solicitacao_id;
    if new.status is null then new.status := 'Novo'; end if;
  else
    if not public.eh_time() then
      new.solicitacao_id := old.solicitacao_id;
      new.sigla          := old.sigla;
      new.empresa        := old.empresa;
      new.cnpj           := old.cnpj;
      new.segmento       := old.segmento;
      new.cidade_uf      := old.cidade_uf;
      new.contato        := old.contato;
      new.telefone       := old.telefone;
      new.email          := old.email;
    end if;
  end if;
  new.atualizado_em  := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists antes_de_gravar_lead on public.leads;
create trigger antes_de_gravar_lead
  before insert or update on public.leads
  for each row execute function public.antes_de_gravar_lead();

-- Fecha o pedido sozinho quando todos os leads têm status final (e reabre se algum voltar).
create or replace function public.atualizar_situacao_pedido(p_solicitacao bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  total integer;
  abertos integer;
  atual text;
begin
  select situacao into atual from public.solicitacoes where id = p_solicitacao;
  if atual is null or atual not in ('Enviada', 'Concluída') then
    return;
  end if;
  select count(*), count(*) filter (where not public.status_final(status))
    into total, abertos
  from public.leads where solicitacao_id = p_solicitacao;

  if total > 0 and abertos = 0 and atual = 'Enviada' then
    update public.solicitacoes set situacao = 'Concluída', concluida_em = now() where id = p_solicitacao;
  elsif abertos > 0 and atual = 'Concluída' then
    update public.solicitacoes set situacao = 'Enviada', concluida_em = null where id = p_solicitacao;
  end if;
end;
$$;

create or replace function public.depois_de_gravar_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.atualizar_situacao_pedido(old.solicitacao_id);
    return old;
  end if;
  perform public.atualizar_situacao_pedido(new.solicitacao_id);
  return new;
end;
$$;

drop trigger if exists depois_de_gravar_lead on public.leads;
create trigger depois_de_gravar_lead
  after insert or update or delete on public.leads
  for each row execute function public.depois_de_gravar_lead();

-- Quando o time marca o pedido como "Enviada", confere na hora se já está tudo finalizado.
create or replace function public.depois_de_atualizar_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.situacao = 'Enviada' and old.situacao is distinct from 'Enviada' then
    perform public.atualizar_situacao_pedido(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists depois_de_atualizar_pedido on public.solicitacoes;
create trigger depois_de_atualizar_pedido
  after update on public.solicitacoes
  for each row execute function public.depois_de_atualizar_pedido();

-- ---------------------------------------------------------------------
-- 6. Redefinir senha (só o time). O representante esqueceu a senha:
--    o time define uma senha temporária e manda pelo WhatsApp.
-- ---------------------------------------------------------------------
create or replace function public.redefinir_senha(p_usuario uuid, p_senha text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.eh_time() then
    raise exception 'Só o time de Inside Sales pode redefinir senhas.';
  end if;
  if length(coalesce(p_senha, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres.';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_usuario;
end;
$$;

revoke execute on function public.redefinir_senha(uuid, text) from public, anon;
grant execute on function public.redefinir_senha(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Quem vê e quem altera o quê (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.dominios_permitidos enable row level security;
alter table public.perfis       enable row level security;
alter table public.solicitacoes enable row level security;
alter table public.leads        enable row level security;

revoke all on public.dominios_permitidos, public.perfis, public.solicitacoes, public.leads from anon;
grant select on public.dominios_permitidos to anon, authenticated;
grant select, update on public.perfis to authenticated;
grant select, insert, update, delete on public.solicitacoes, public.leads to authenticated;

drop policy if exists "dominios: todos leem" on public.dominios_permitidos;
create policy "dominios: todos leem" on public.dominios_permitidos
  for select using (true);

drop policy if exists "perfis: ver o próprio ou time vê todos" on public.perfis;
create policy "perfis: ver o próprio ou time vê todos" on public.perfis
  for select to authenticated using (id = auth.uid() or public.eh_time());

drop policy if exists "perfis: só o time altera" on public.perfis;
create policy "perfis: só o time altera" on public.perfis
  for update to authenticated using (public.eh_time()) with check (public.eh_time());

drop policy if exists "pedidos: loja vê os seus, time vê todos" on public.solicitacoes;
create policy "pedidos: loja vê os seus, time vê todos" on public.solicitacoes
  for select to authenticated using (public.eh_time() or sigla = public.minha_sigla());

drop policy if exists "pedidos: representante pede para a própria loja" on public.solicitacoes;
create policy "pedidos: representante pede para a própria loja" on public.solicitacoes
  for insert to authenticated with check (public.eh_time() or sigla = public.minha_sigla());

drop policy if exists "pedidos: só o time altera" on public.solicitacoes;
create policy "pedidos: só o time altera" on public.solicitacoes
  for update to authenticated using (public.eh_time()) with check (public.eh_time());

drop policy if exists "pedidos: só o time apaga" on public.solicitacoes;
create policy "pedidos: só o time apaga" on public.solicitacoes
  for delete to authenticated using (public.eh_time());

drop policy if exists "leads: loja vê os seus, time vê todos" on public.leads;
create policy "leads: loja vê os seus, time vê todos" on public.leads
  for select to authenticated using (public.eh_time() or sigla = public.minha_sigla());

drop policy if exists "leads: só o time inclui" on public.leads;
create policy "leads: só o time inclui" on public.leads
  for insert to authenticated with check (public.eh_time());

drop policy if exists "leads: loja atualiza os seus, time atualiza todos" on public.leads;
create policy "leads: loja atualiza os seus, time atualiza todos" on public.leads
  for update to authenticated
  using (public.eh_time() or sigla = public.minha_sigla())
  with check (public.eh_time() or sigla = public.minha_sigla());

drop policy if exists "leads: só o time apaga" on public.leads;
create policy "leads: só o time apaga" on public.leads
  for delete to authenticated using (public.eh_time());

-- ---------------------------------------------------------------------
-- 8. Primeiro acesso do time
-- Depois de se cadastrar no site, rode a linha abaixo trocando o e-mail
-- (sem os dois traços do começo) para virar administrador:
--
-- update public.perfis set papel = 'time', situacao = 'aprovado' where email = 'seu.email@voeazul.com.br';
-- ---------------------------------------------------------------------
