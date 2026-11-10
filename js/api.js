// Camada de dados: Supabase (uso real) ou memória (modo demonstração).
(function () {
  const cfg = window.PORTAL_CONFIG || {};
  const FINAIS = new Set(window.LISTAS.status.filter(s => s.final).map(s => s.nome));

  const dominiosTexto = () => (cfg.dominiosPermitidos || ["voeazul.com.br"]).map(d => "@" + d).join(" ou ");

  // Traduz erros técnicos para mensagens que o usuário entende.
  function traduzir(err) {
    const msg = (err && (err.message || err.error_description || String(err))) || "Erro desconhecido.";
    if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
    if (/already registered|already been registered|User already exists/i.test(msg)) return "Este e-mail já tem cadastro. Entre com sua senha ou peça ao time para redefinir.";
    if (/Database error saving new user/i.test(msg)) return "Use seu e-mail corporativo (" + dominiosTexto() + ") para se cadastrar.";
    if (/Password should be at least/i.test(msg)) return "A senha precisa ter pelo menos 8 caracteres.";
    if (/Email not confirmed/i.test(msg)) return "E-mail ainda não confirmado. Abra a mensagem do Portal de Leads na sua caixa de entrada e clique no link de confirmação.";
    if (/Error sending confirmation email|Email address not authorized|sending.*email/i.test(msg)) return "Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em alguns minutos ou fale com o time de Inside Sales.";
    if (/For security purposes, you can only request this after/i.test(msg)) return "Aguarde um minuto antes de pedir um novo e-mail.";
    if (/rate limit/i.test(msg)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    if (/Failed to fetch|NetworkError/i.test(msg)) return "Sem conexão com o servidor. Confira sua internet e tente de novo.";
    if (/row-level security|permission denied/i.test(msg)) return "Você não tem permissão para esta ação.";
    return msg.replace(/^ERROR:\s*/, "");
  }

  // ------------------------------------------------------------------
  // Supabase
  // ------------------------------------------------------------------
  function criarSupabase() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    async function ok(promise) {
      const { data, error } = await promise;
      if (error) throw new Error(traduzir(error));
      return data;
    }

    async function todos(tabela, ordem) {
      const passo = 1000;
      let de = 0, saida = [];
      for (;;) {
        const lote = await ok(sb.from(tabela).select("*").order(ordem, { ascending: false }).range(de, de + passo - 1));
        saida = saida.concat(lote);
        if (lote.length < passo) break;
        de += passo;
      }
      return saida;
    }

    return {
      demo: false,
      async sessao() {
        const { data } = await sb.auth.getSession();
        return data.session ? data.session.user : null;
      },
      async entrar(email, senha) {
        await ok(sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha }));
      },
      // Com "Confirm email" ligado no Supabase, o cadastro volta sem sessão:
      // a pessoa precisa clicar no link enviado para o e-mail antes de entrar.
      async cadastrar(email, senha, dados) {
        const data = await ok(sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha, options: { data: dados, emailRedirectTo: location.origin + location.pathname } }));
        return { confirmar: !data.session };
      },
      async reenviarConfirmacao(email) {
        await ok(sb.auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: location.origin + location.pathname } }));
      },
      async sair() { await sb.auth.signOut(); },
      async trocarSenha(nova) { await ok(sb.auth.updateUser({ password: nova })); },
      async meuPerfil() {
        const u = await this.sessao();
        if (!u) return null;
        const r = await ok(sb.from("perfis").select("*").eq("id", u.id).maybeSingle());
        return r;
      },
      perfis: () => todos("perfis", "criado_em"),
      async atualizarPerfil(id, dados) { await ok(sb.from("perfis").update(dados).eq("id", id)); },
      async redefinirSenha(id, senha) { await ok(sb.rpc("redefinir_senha", { p_usuario: id, p_senha: senha })); },
      pedidos: () => todos("solicitacoes", "criada_em"),
      async criarPedido(dados) { return ok(sb.from("solicitacoes").insert(dados).select().single()); },
      async atualizarPedido(id, dados) { await ok(sb.from("solicitacoes").update(dados).eq("id", id)); },
      leads: () => todos("leads", "id"),
      async incluirLeads(linhas) {
        for (let i = 0; i < linhas.length; i += 500) {
          await ok(sb.from("leads").insert(linhas.slice(i, i + 500)));
        }
      },
      async atualizarLead(id, dados) {
        return ok(sb.from("leads").update(dados).eq("id", id).select().single());
      },
      async apagarLeadsDoPedido(pedidoId) { await ok(sb.from("leads").delete().eq("solicitacao_id", pedidoId)); }
    };
  }

  // ------------------------------------------------------------------
  // Demonstração em memória (nada é salvo; os dados são fictícios)
  // ------------------------------------------------------------------
  function criarDemo() {
    const agora = Date.now();
    const dia = 86400000;
    const iso = (d) => new Date(d).toISOString();
    const db = {
      perfis: [
        { id: "t1", nome: "Time Inside Sales", email: "inside.sales@voeazul.com.br", celular: "11900000000", sigla: "IS", cidade_uf: "São Paulo/SP", regiao: "Sudeste", papel: "time", situacao: "aprovado", criado_em: iso(agora - 40 * dia) },
        { id: "r1", nome: "Marina Exemplo", email: "marina.exemplo@voeazul.com.br", celular: "19900000001", sigla: "CPQ", cidade_uf: "Campinas/SP", regiao: "Sudeste", papel: "representante", situacao: "aprovado", criado_em: iso(agora - 30 * dia) },
        { id: "r2", nome: "Paulo Modelo", email: "paulo.modelo@voeazul.com.br", celular: "41900000002", sigla: "CWB", cidade_uf: "Curitiba/PR", regiao: "Sul", papel: "representante", situacao: "aprovado", criado_em: iso(agora - 25 * dia) },
        { id: "r3", nome: "Ana Teste", email: "ana.teste@voeazul.com.br", celular: "81900000003", sigla: "REC", cidade_uf: "Recife/PE", regiao: "Nordeste", papel: "representante", situacao: "pendente", criado_em: iso(agora - 1 * dia) },
        { id: "r4", nome: "Bruno Demonstração", email: "bruno.demo@azulcargo.com.br", celular: "41900000004", sigla: "CWB", cidade_uf: "Curitiba/PR", regiao: "Sul", papel: "representante", situacao: "pendente", email_confirmado: !cfg.confirmacaoEmail, criado_em: iso(agora - 0.2 * dia) }
      ],
      pedidos: [],
      leads: []
    };
    let seqPedido = 1, seqLead = 1;
    let usuario = null;

    function pedido(p) { const r = Object.assign({ id: seqPedido++, situacao: "Nova", responsavel: null, observacao_time: null, enviada_em: null, concluida_em: null, segmento_2: null, segmento_3: null, empresas: null }, p); db.pedidos.push(r); return r; }
    function lead(pid, empresa, extra) {
      const p = db.pedidos.find(x => x.id === pid);
      db.leads.push(Object.assign({ id: seqLead++, solicitacao_id: pid, sigla: p.sigla, empresa, cnpj: "00.000.000/0001-" + String(10 + seqLead).padStart(2, "0"), segmento: p.segmento_1, cidade_uf: p.cidade_uf, contato: "Contato fictício", telefone: "1190000" + String(1000 + seqLead), email: "contato" + seqLead + "@exemplo.com.br", status: "Novo", data_contato: null, observacao: null, atualizado_em: iso(agora - 3 * dia) }, extra || {}));
    }
    const p1 = pedido({ sigla: "CPQ", solicitante: "r1", solicitante_nome: "Marina Exemplo", regiao: "Sudeste", cidade_uf: "Campinas/SP", segmento_1: "Confecções", segmento_2: "Indústria têxtil", criada_em: iso(agora - 12 * dia), situacao: "Enviada", responsavel: "Lucas", enviada_em: iso(agora - 10 * dia) });
    const empresas = ["Malharia Horizonte", "Tecidos Vale Verde", "Confecção Primavera", "Ateliê Linha Fina", "Têxtil Serra Azul", "Moda Rio Claro", "Fios do Interior", "Uniformes Atlântico"];
    const st = ["Fechou", "Em negociação", "Tentando contato", "Sem interesse", "Novo", "Novo", "Contato inválido", "Tentando contato"];
    empresas.forEach((e, i) => lead(p1.id, e, { status: st[i], data_contato: st[i] === "Novo" ? null : new Date(agora - (i + 1) * dia).toISOString().slice(0, 10), observacao: st[i] === "Em negociação" ? "Pediu proposta para envios semanais" : null }));
    const p2 = pedido({ sigla: "CWB", solicitante: "r2", solicitante_nome: "Paulo Modelo", regiao: "Sul", cidade_uf: "Curitiba/PR", segmento_1: "Comércio de autopeças", criada_em: iso(agora - 20 * dia), situacao: "Concluída", responsavel: "Van", enviada_em: iso(agora - 18 * dia), concluida_em: iso(agora - 4 * dia) });
    ["Auto Peças Pinheiro", "Distribuidora Rota Sul", "Peças Boqueirão"].forEach((e, i) => lead(p2.id, e, { status: ["Fechou", "Sem interesse", "Contato inválido"][i], data_contato: new Date(agora - (5 + i) * dia).toISOString().slice(0, 10) }));
    pedido({ sigla: "CWB", solicitante: "r2", solicitante_nome: "Paulo Modelo", regiao: "Sul", cidade_uf: "Curitiba/PR", segmento_1: "Farmácias", segmento_2: "Laboratórios clínicos", empresas: "CNAE 4771-7/01", criada_em: iso(agora - 1 * dia) });

    const eu = () => db.perfis.find(p => p.id === (usuario && usuario.id));
    const ehTime = () => { const p = eu(); return p && p.papel === "time" && p.situacao === "aprovado"; };
    const minhaSigla = () => { const p = eu(); return p && p.situacao === "aprovado" ? p.sigla : null; };
    const copia = (x) => JSON.parse(JSON.stringify(x));
    const espera = () => new Promise(r => setTimeout(r, 120));

    function reavaliar(pid) {
      const p = db.pedidos.find(x => x.id === pid);
      if (!p || !["Enviada", "Concluída"].includes(p.situacao)) return;
      const ls = db.leads.filter(l => l.solicitacao_id === pid);
      const abertos = ls.filter(l => !FINAIS.has(l.status)).length;
      if (ls.length && !abertos && p.situacao === "Enviada") { p.situacao = "Concluída"; p.concluida_em = new Date().toISOString(); }
      else if (abertos && p.situacao === "Concluída") { p.situacao = "Enviada"; p.concluida_em = null; }
    }

    return {
      demo: true,
      async sessao() { return usuario; },
      async entrar(email) {
        await espera();
        const p = db.perfis.find(x => x.email === email.trim().toLowerCase());
        if (!p) throw new Error("E-mail ou senha incorretos.");
        if (p.email_confirmado === false) throw new Error(traduzir({ message: "Email not confirmed" }));
        usuario = { id: p.id, email: p.email };
      },
      async entrarComo(id) { usuario = { id, email: db.perfis.find(p => p.id === id).email }; },
      async cadastrar(email, senha, dados) {
        await espera();
        email = email.trim().toLowerCase();
        const dom = email.split("@")[1];
        if (!(cfg.dominiosPermitidos || []).includes(dom)) throw new Error(traduzir({ message: "Database error saving new user" }));
        if (db.perfis.some(p => p.email === email)) throw new Error("Este e-mail já tem cadastro. Entre com sua senha ou peça ao time para redefinir.");
        const id = "u" + Math.random().toString(36).slice(2, 8);
        db.perfis.push({ id, nome: dados.nome, email, celular: dados.celular, sigla: (dados.sigla || "").toUpperCase(), cidade_uf: dados.cidade_uf, regiao: dados.regiao, papel: "representante", situacao: "pendente", email_confirmado: !cfg.confirmacaoEmail, criado_em: new Date().toISOString() });
        if (cfg.confirmacaoEmail) return { confirmar: true };
        usuario = { id, email };
        return { confirmar: false };
      },
      async reenviarConfirmacao() { await espera(); },
      // Só na demonstração: faz o papel do clique no link do e-mail.
      async simularConfirmacao(email) {
        const p = db.perfis.find(x => x.email === email.trim().toLowerCase());
        p.email_confirmado = true; usuario = { id: p.id, email: p.email };
      },
      async sair() { usuario = null; },
      async trocarSenha() { await espera(); },
      async meuPerfil() { return eu() ? copia(eu()) : null; },
      async perfis() { return copia(ehTime() ? db.perfis : db.perfis.filter(p => p.id === usuario.id)); },
      async atualizarPerfil(id, dados) { if (!ehTime()) throw new Error("Você não tem permissão para esta ação."); Object.assign(db.perfis.find(p => p.id === id), dados); },
      async redefinirSenha() { if (!ehTime()) throw new Error("Só o time de Inside Sales pode redefinir senhas."); await espera(); },
      async pedidos() { return copia(db.pedidos.filter(p => ehTime() || p.sigla === minhaSigla())).reverse(); },
      async criarPedido(d) {
        await espera();
        const p = eu();
        if (!ehTime() && (!p || p.situacao !== "aprovado")) throw new Error("Seu cadastro ainda não foi aprovado pelo time de Inside Sales.");
        const sigla = ehTime() ? d.sigla : p.sigla;
        const abertos = db.leads.filter(l => l.sigla === sigla && !FINAIS.has(l.status)).length;
        if (abertos) throw new Error(`A loja ${sigla} ainda tem ${abertos} lead(s) sem status final. Finalize todos para pedir uma nova base.`);
        if (db.pedidos.some(x => x.sigla === sigla && ["Nova", "Em extração"].includes(x.situacao))) throw new Error(`A loja ${sigla} já tem um pedido em andamento. Aguarde o envio dos leads.`);
        return copia(pedido(Object.assign({}, d, { sigla, solicitante: p.id, solicitante_nome: p.nome, regiao: p.regiao, cidade_uf: p.cidade_uf, criada_em: new Date().toISOString(), situacao: "Nova" })));
      },
      async atualizarPedido(id, d) {
        if (!ehTime()) throw new Error("Você não tem permissão para esta ação.");
        const p = db.pedidos.find(x => x.id === id); const antes = p.situacao; Object.assign(p, d);
        if (p.situacao === "Enviada" && antes !== "Enviada") reavaliar(id);
      },
      async leads() { return copia(db.leads.filter(l => ehTime() || l.sigla === minhaSigla())).reverse(); },
      async incluirLeads(linhas) {
        if (!ehTime()) throw new Error("Você não tem permissão para esta ação.");
        await espera();
        linhas.forEach(l => { const p = db.pedidos.find(x => x.id === l.solicitacao_id); db.leads.push(Object.assign({ id: seqLead++, status: "Novo", data_contato: null, observacao: null, atualizado_em: new Date().toISOString() }, l, { sigla: p.sigla })); });
      },
      async atualizarLead(id, d) {
        const l = db.leads.find(x => x.id === id);
        if (!ehTime() && l.sigla !== minhaSigla()) throw new Error("Você não tem permissão para esta ação.");
        const permitido = ehTime() ? d : { status: d.status, data_contato: d.data_contato, observacao: d.observacao };
        Object.keys(permitido).forEach(k => permitido[k] === undefined && delete permitido[k]);
        Object.assign(l, permitido, { atualizado_em: new Date().toISOString() });
        reavaliar(l.solicitacao_id);
        return copia(l);
      },
      async apagarLeadsDoPedido(pid) { db.leads = db.leads.filter(l => l.solicitacao_id !== pid); }
    };
  }

  const configurado = cfg.supabaseUrl && cfg.supabaseKey && window.supabase;
  window.API = configurado ? criarSupabase() : criarDemo();
  window.API.traduzir = traduzir;
})();
