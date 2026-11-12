// Camada de dados: Firebase (uso real) ou memória (modo demonstração).
// As telas (app.js) só conversam com o objeto window.API, que tem a mesma forma nos dois modos.
(function () {
  const cfg = window.PORTAL_CONFIG || {};
  const L = window.LISTAS;
  const TRAVA = new Set(L.status.filter(s => s.trava).map(s => s.nome));
  const MAX = L.leadsPorPedido || 10;
  const CHAVES = Array.from({ length: 10 }, (_, i) => "l" + i);
  const DOMINIOS = cfg.dominiosPermitidos || ["voeazul.com.br", "azulcargo.com.br"];

  const dominiosTexto = () => DOMINIOS.map(d => "@" + d).join(" ou ");
  // Carteira do executivo: "EX" + começo do id do login (é o que as regras conferem).
  const siglaExecutivo = (uid) => ("EX" + String(uid).slice(0, 8)).toUpperCase();
  const nomeCarteira = (nome) => "Carteira de " + String(nome).trim().split(/\s+/).slice(0, 2).join(" ");
  const siglaDoEmail = (email) => String(email || "").toLowerCase().split("@")[0].split(".")[0].toUpperCase();

  // Traduz erros técnicos para mensagens que o usuário entende.
  function traduzir(err) {
    const cod = (err && err.code) || "";
    const msg = (err && (err.message || String(err))) || "Erro desconhecido.";
    const mapa = {
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/wrong-password": "E-mail ou senha incorretos.",
      "auth/user-not-found": "E-mail ou senha incorretos.",
      "auth/invalid-email": "E-mail inválido.",
      "auth/email-already-in-use": "Este e-mail já tem cadastro. Entre com sua senha ou use \"Esqueci minha senha\".",
      "auth/weak-password": "A senha precisa ter pelo menos 8 caracteres.",
      "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
      "auth/network-request-failed": "Sem conexão com o servidor. Confira sua internet e tente de novo.",
      "auth/requires-recent-login": "Por segurança, saia e entre de novo antes de trocar a senha.",
      "auth/user-disabled": "Este acesso foi desativado. Fale com o time de Inside Sales.",
      "permission-denied": "Você não tem permissão para esta ação.",
      "unavailable": "Sem conexão com o servidor. Confira sua internet e tente de novo."
    };
    if (mapa[cod]) return mapa[cod];
    if (/Missing or insufficient permissions/i.test(msg)) return "Você não tem permissão para esta ação.";
    if (/Failed to fetch|NetworkError|offline/i.test(msg)) return "Sem conexão com o servidor. Confira sua internet e tente de novo.";
    return msg.replace(/^Firebase:\s*/, "").replace(/\s*\(auth\/[a-z-]+\)\.?$/, "");
  }

  // Próxima sexta-feira (pedido feito na sexta vai para a sexta seguinte).
  function proximaSexta(base) {
    const d = base ? new Date(base) : new Date();
    const falta = ((5 - d.getDay() + 7) % 7) || 7;
    d.setDate(d.getDate() + falta);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // Limpa o que vem da Leads2b: "Nome <a@b.com>; c@d.com" -> "a@b.com"; telefone só com números.
  // Histórico de um lead, do mais novo para o mais antigo. Se o time apagou os leads do pedido e importou de novo,
  // a mesma posição (l0..l9) recebe outra empresa: mostra só o que veio depois do último "recebido".
  function desdeRecebido(lista) {
    const asc = lista.slice().sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
    let i = -1; asc.forEach((h, n) => { if (h.tipo === "recebido") i = n; });
    return asc.slice(Math.max(0, i)).reverse();
  }
  function limparEmail(v) {
    const m = String(v || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0].toLowerCase() : "";
  }
  function limparTelefone(v) {
    const primeiro = String(v || "").split(/[;,/|]| ou /i)[0];
    let d = primeiro.replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    d = d.replace(/^0+/, "");
    return d.length >= 10 ? d : "";
  }

  // Um telefone da Leads2b -> { n: só números, t: "cel" | "fixo" | "0800" }, ou null se estiver incompleto.
  function normalizarTelefone(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
    if (/^0?800\d{7}$/.test(d)) return { n: "0800" + d.slice(-7), t: "0800" };
    d = d.replace(/^0+/, "");
    if (!/^[1-9][1-9]/.test(d)) return null;
    if (d.length === 11 && d[2] === "9") return { n: d, t: "cel" };
    if (d.length === 10 && /[2-5]/.test(d[2])) return { n: d, t: "fixo" };
    return null;
  }
  // Uma célula com vários telefones ("+55 11 3188 7000, +55 11 97789 0051, ...") -> lista sem repetidos.
  function lerTelefones(v) {
    const vistos = new Set(), saida = [];
    let descartados = 0;
    String(v || "").split(/[,;\/|\n]| ou /i).map(x => x.trim()).filter(Boolean).forEach(x => {
      const t = normalizarTelefone(x);
      if (!t || vistos.has(t.n)) { descartados++; return; }
      vistos.add(t.n); saida.push(t);
    });
    return { lista: saida, descartados };
  }
  function lerEmails(v) {
    const vistos = new Set();
    return (String(v || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(x => x.toLowerCase()).filter(x => !vistos.has(x) && vistos.add(x));
  }
  // Campos extras que vêm da Leads2b. Só o que está aqui é gravado no lead.
  const LISTA_EXTRA = ["emails", "cnaes", "socios"];
  const TEXTO_EXTRA = ["fantasia", "site", "linkedin", "instagram", "endereco", "bairro", "cep", "porte", "funcionarios", "faturamento", "tipo_unidade", "filiais"];
  function extrasDoLead(l) {
    const x = {};
    TEXTO_EXTRA.forEach(k => { if (l[k]) x[k] = String(l[k]).slice(0, 300); });
    LISTA_EXTRA.forEach(k => { if (Array.isArray(l[k]) && l[k].length) x[k] = l[k].slice(0, 60).map(v => String(v).slice(0, 200)); });
    if (Array.isArray(l.telefones) && l.telefones.length) x.telefones = l.telefones.slice(0, 80).map(t => ({ n: String(t.n).slice(0, 15), t: t.t }));
    return x;
  }

  // O que vai para o histórico quando um lead muda (status, motivo, contato válido, próximo contato, tentativa).
  const dataBR = (v) => v ? String(v).slice(0, 10).split("-").reverse().join("/") : "";
  function foneTexto(d) {
    d = String(d || "");
    if (d.startsWith("0800")) return `0800 ${d.slice(4, 7)} ${d.slice(7)}`;
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
  }
  function motivoTexto(l) { return l.motivo === "Outro motivo" ? (l.motivo_outro || "Outro motivo") : (l.motivo || ""); }
  function eventosDoLead(antes, depois, dados, tentativa) {
    const ev = [];
    if (tentativa) ev.push([tentativa.canal, `Tentativa ${depois.tentativas} · ${tentativa.texto}`]);
    const extraMotivo = depois.status === "Sem interesse" && depois.motivo
      ? ` · Motivo: ${motivoTexto(depois)}${depois.tentar_em ? ` · tentar de novo em ${dataBR(depois.tentar_em)}` : ""}` : "";
    if (dados.status && dados.status !== antes.status) ev.push(["status", `Status: ${antes.status} → ${dados.status}${extraMotivo}`]);
    else if (depois.status === "Sem interesse" && (depois.motivo !== antes.motivo || depois.motivo_outro !== antes.motivo_outro || depois.tentar_em !== antes.tentar_em) && depois.motivo)
      ev.push(["status", `Sem interesse${extraMotivo}`]);
    if (dados.contato_valido !== undefined && dados.contato_valido !== antes.contato_valido && dados.contato_valido) ev.push(["contato_valido", `Tem contato válido? ${dados.contato_valido}`]);
    if (dados.tel_errados) {
      const velhos = new Set(antes.tel_errados || []), novos = new Set(dados.tel_errados);
      dados.tel_errados.filter(n => !velhos.has(n)).forEach(n => ev.push(["telefone", `Número errado: ${foneTexto(n)}`]));
      [...velhos].filter(n => !novos.has(n)).forEach(n => ev.push(["telefone", `Número voltou para a lista: ${foneTexto(n)}`]));
    }
    if (depois.retorno && (depois.retorno !== antes.retorno || depois.retorno_hora !== antes.retorno_hora || depois.lembrete !== antes.lembrete))
      ev.push(["agenda", `Próximo contato: ${dataBR(depois.retorno)}${depois.retorno_hora ? " às " + depois.retorno_hora : ""}${depois.lembrete ? " · " + depois.lembrete : ""}`]);
    return ev;
  }
  function aplicarTentativa(antes, depois, tentativa) {
    if (!tentativa) return;
    depois.tentativas = (Number(antes.tentativas) || 0) + 1;
    depois.ultima_tentativa = new Date().toISOString();
  }

  const travandoDe = (leads) => Object.values(leads || {}).filter(l => TRAVA.has(l.status)).length;
  const liberadaDe = (leads) => {
    const ls = Object.values(leads || {});
    return ls.length > 0 && ls.every(l => !TRAVA.has(l.status));
  };

  // Pedidos com leads dentro -> lista de leads "achatada" para as telas.
  function achatar(pedidos) {
    const saida = [];
    pedidos.forEach(p => CHAVES.forEach(k => {
      const l = p.leads && p.leads[k];
      if (l) saida.push({ ...l, id: p.id + ":" + k, chave: k, solicitacao_id: p.id, sigla: p.sigla });
    }));
    return saida;
  }
  const separarId = (id) => { const i = id.lastIndexOf(":"); return [id.slice(0, i), id.slice(i + 1)]; };

  // ------------------------------------------------------------------
  // Firebase
  // ------------------------------------------------------------------
  function criarFirebase() {
    const app = firebase.initializeApp(cfg.firebase, cfg.nomeApp || "[DEFAULT]");
    const auth = app.auth();
    const db = app.firestore();
    if (cfg.emulador) { auth.useEmulator("http://127.0.0.1:9099"); db.useEmulator("127.0.0.1", 8080); } // só nos testes
    auth.languageCode = "pt-BR";
    const TS = () => firebase.firestore.FieldValue.serverTimestamp();
    const ts = (v) => v && v.toDate ? v.toDate().toISOString() : v || null;
    const doc = (d) => { const x = d.data(); Object.keys(x).forEach(k => { if (x[k] && x[k].toDate) x[k] = ts(x[k]); }); return { id: d.id, ...x }; };
    const continuar = () => ({ url: location.origin + location.pathname });

    let pronto;
    const esperarAuth = () => pronto || (pronto = new Promise(r => { const u = auth.onAuthStateChanged(x => { u(); r(x); }); }));
    let cacheNome = "";

    const api = {
      demo: false,
      traduzir, proximaSexta, limparEmail, limparTelefone, siglaDoEmail, normalizarTelefone, lerTelefones, lerEmails, foneTexto,

      async sessao() {
        const u = await esperarAuth();
        const atual = auth.currentUser || u;
        if (!atual) return null;
        return { id: atual.uid, email: atual.email, verificado: atual.emailVerified };
      },
      async entrar(email, senha) { await auth.signInWithEmailAndPassword(email.trim().toLowerCase(), senha); },
      async esqueciSenha(email) { await auth.sendPasswordResetEmail(email.trim().toLowerCase(), continuar()); },

      // Cadastro: cria o login e grava perfil, unidade e acesso (sem e-mail de confirmação; o time aprova).
      async cadastrar(email, senha, dados) {
        email = email.trim().toLowerCase();
        // Refazer cadastro (cadastro excluído pelo time): reaproveita o login que já existe.
        const atual = auth.currentUser;
        const cred = atual && atual.email === email ? { user: atual } : await auth.createUserWithEmailAndPassword(email, senha);
        const uid = cred.user.uid;
        const lote = db.batch();
        const exec = !dados.time && dados.cargo === "Executivo";
        const sigla = dados.time ? "" : exec ? siglaExecutivo(uid) : dados.sigla.toUpperCase();
        lote.set(db.doc("perfis/" + uid), { nome: dados.nome, email, celular: dados.celular, cargo: dados.time ? "Inside Sales" : (dados.cargo || "Representante"),
          papel: "representante", situacao: "pendente", emailVerificado: false, siglaPrincipal: sigla, criadoEm: TS() });
        if (sigla) {
          const ref = db.doc("unidades/" + sigla);
          const existe = await ref.get().then(s => s.exists).catch(() => false);
          if (!existe) lote.set(ref, { sigla, cidade_uf: dados.cidade_uf, regiao: dados.regiao, pedidoAtual: null, criadaEm: TS(), ...(exec ? { nome: nomeCarteira(dados.nome), tipo: "executivo" } : {}) });
          lote.set(db.doc(`acessos/${uid}_${sigla}`), { uid, sigla, situacao: "pendente", principal: true, nome: dados.nome, email, criadoEm: TS() });
        }
        await lote.commit();
        return { confirmar: false };
      },
      // Administrador: tira a pessoa do portal (vai para a aba Excluídos) e fecha os acessos dela. Pedidos, leads e histórico continuam salvos.
      async excluirCadastro(uid) {
        const lote = db.batch();
        (await db.collection("acessos").where("uid", "==", uid).get()).docs.forEach(d => lote.update(d.ref, { situacao: "recusado" }));
        lote.update(db.doc("perfis/" + uid), { situacao: "excluido", excluido_em: TS(), excluido_por: cacheNome });
        await lote.commit();
      },
      // Volta para Aguardando; ao aprovar, a unidade principal é liberada de novo.
      async reativarCadastro(uid) { await db.doc("perfis/" + uid).update({ situacao: "pendente" }); },
      async reenviarConfirmacao() { if (auth.currentUser) await auth.currentUser.sendEmailVerification(continuar()); },
      // Depois do clique no link: atualiza o login e marca o perfil como confirmado.
      async conferirConfirmacao() {
        const u = auth.currentUser; if (!u) return false;
        await u.reload();
        if (!auth.currentUser.emailVerified) return false;
        await auth.currentUser.getIdToken(true);
        const ref = db.doc("perfis/" + u.uid);
        const p = await ref.get();
        if (p.exists && !p.data().emailVerificado) await ref.update({ emailVerificado: true });
        return true;
      },
      async sair() { await auth.signOut(); },
      async trocarSenha(nova) { await auth.currentUser.updatePassword(nova); },

      async meuPerfil() {
        const u = auth.currentUser; if (!u) return null;
        const s = await db.doc("perfis/" + u.uid).get();
        if (!s.exists) return null;
        const p = doc(s);
        cacheNome = p.nome;
        const acs = (await db.collection("acessos").where("uid", "==", u.uid).get()).docs.map(doc);
        const unidades = await Promise.all(acs.map(async a => {
          const us = await db.doc("unidades/" + a.sigla).get();
          return { ...(us.exists ? doc(us) : { sigla: a.sigla }), acesso: a.situacao, principal: a.principal, acessoId: a.id };
        }));
        return { ...p, verificado: u.emailVerified, unidades: unidades.sort((a, b) => (b.principal - a.principal) || a.sigla.localeCompare(b.sigla)) };
      },
      async pedirUnidade(dados) {
        const u = auth.currentUser;
        const sigla = dados.sigla.toUpperCase();
        const lote = db.batch();
        const ref = db.doc("unidades/" + sigla);
        if (!(await ref.get()).exists) lote.set(ref, { sigla, cidade_uf: dados.cidade_uf, regiao: dados.regiao, pedidoAtual: null, criadaEm: TS() });
        lote.set(db.doc(`acessos/${u.uid}_${sigla}`), { uid: u.uid, sigla, situacao: "pendente", principal: false, nome: cacheNome, email: u.email.toLowerCase(), criadoEm: TS() });
        await lote.commit();
      },

      // Time
      async perfis() { return (await db.collection("perfis").get()).docs.map(doc); },
      async acessos() { return (await db.collection("acessos").get()).docs.map(doc); },
      async unidades() { return (await db.collection("unidades").get()).docs.map(doc); },
      async atualizarPerfil(id, dados) { await db.doc("perfis/" + id).update(dados); },
      async atualizarAcesso(id, situacao) { await db.doc("acessos/" + id).update({ situacao }); },
      // Aprova a pessoa e a unidade principal dela de uma vez.
      async aprovarCadastro(id) {
        const lote = db.batch();
        lote.update(db.doc("perfis/" + id), { situacao: "aprovado" });
        const acs = (await db.collection("acessos").where("uid", "==", id).where("principal", "==", true).get()).docs;
        acs.forEach(a => lote.update(a.ref, { situacao: "aprovado" }));
        await lote.commit();
      },
      async enviarRedefinicao(email) { await auth.sendPasswordResetEmail(email, continuar()); },

      // Pedidos (o time vê todos; o representante, os das unidades dele)
      async pedidos(siglas) {
        let docs;
        if (siglas) {
          const partes = await Promise.all(siglas.map(s => db.collection("pedidos").where("sigla", "==", s).get()));
          docs = partes.flatMap(q => q.docs);
        } else docs = (await db.collection("pedidos").get()).docs;
        return docs.map(doc).sort((a, b) => String(b.criada_em).localeCompare(String(a.criada_em)));
      },
      leadsDe: achatar,

      // Cria o pedido e troca o "pedido atual" da unidade no mesmo envio (é o que aplica o bloqueio).
      async criarPedido(dados) {
        const u = auth.currentUser;
        const ref = db.collection("pedidos").doc(dados.sigla + "-" + Date.now().toString(36).toUpperCase());
        const lote = db.batch();
        lote.set(ref, { sigla: dados.sigla, regiao: dados.regiao || null, cidade_uf: dados.cidade_uf || null, solicitante: u.uid, solicitante_nome: cacheNome,
          segmentos: dados.segmentos, cidades: dados.cidades, empresas: dados.empresas || null, situacao: "Nova", previsao: proximaSexta(),
          responsavel: null, observacao_time: null, leads: {}, liberada: false, travando: 0, alterado: null, criada_em: TS(), enviada_em: null, concluida_em: null });
        lote.update(db.doc("unidades/" + dados.sigla), { pedidoAtual: ref.id });
        await lote.commit();
        return { id: ref.id, previsao: proximaSexta() };
      },
      async atualizarPedido(id, dados) {
        const d = { ...dados };
        ["enviada_em", "concluida_em"].forEach(k => { if (d[k] === true) d[k] = TS(); });
        await db.doc("pedidos/" + id).update(d);
      },

      // Time: coloca os leads da planilha dentro do pedido (máximo de 10 por pedido).
      async incluirLeads(pedidoId, linhas, extra) {
        const ref = db.doc("pedidos/" + pedidoId);
        await db.runTransaction(async (t) => {
          const p = (await t.get(ref)).data();
          const leads = { ...(p.leads || {}) };
          const livres = CHAVES.filter(k => !leads[k]);
          if (linhas.length > livres.length) throw new Error(`Cada pedido aceita até ${MAX} leads. Este pedido ainda tem espaço para ${livres.length}.`);
          const novas = [];
          linhas.forEach((l, i) => {
            const k = livres[i];
            leads[k] = { empresa: l.empresa, cnpj: l.cnpj || null, segmento: l.segmento || null, cidade_uf: l.cidade_uf || null, contato: l.contato || null,
              telefone: limparTelefone(l.telefone) || null, email: limparEmail(l.email) || null, status: "Novo", data_contato: null, contato_valido: "",
              atualizado_em: new Date().toISOString(), ...extrasDoLead(l) };
            novas.push(k);
          });
          t.update(ref, { leads, liberada: liberadaDe(leads), travando: travandoDe(leads), ...(extra || {}), ...(extra && extra.enviada_em === true ? { enviada_em: TS() } : {}) });
          novas.forEach(k => t.set(ref.collection("historico").doc(), { lead: k, tipo: "recebido", texto: `Lead recebido no pedido ${pedidoId}`, autor: auth.currentUser.uid,
            autor_nome: cacheNome, criado_em: TS(), editado_em: null }));
        });
      },
      async apagarLeadsDoPedido(pedidoId) { await db.doc("pedidos/" + pedidoId).update({ leads: {}, liberada: false, travando: 0, alterado: null }); },

      // Representante ou time: muda os campos do lead (status, datas, motivo, próximo contato...) e grava o histórico junto.
      // tentativa = { canal, texto }: conta mais uma tentativa de contato.
      async atualizarLead(id, dados, tentativa) {
        const [pid, k] = separarId(id);
        const ref = db.doc("pedidos/" + pid);
        let saida;
        await db.runTransaction(async (t) => {
          const p = (await t.get(ref)).data();
          const antes = p.leads[k];
          const depois = { ...antes, ...dados, atualizado_em: new Date().toISOString() };
          aplicarTentativa(antes, depois, tentativa);
          const leads = { ...p.leads, [k]: depois };
          const liberada = liberadaDe(leads);
          const upd = { [`leads.${k}`]: depois, liberada, travando: travandoDe(leads), alterado: k };
          if (["Enviada", "Concluída"].includes(p.situacao)) {
            upd.situacao = liberada ? "Concluída" : "Enviada";
            if (upd.situacao !== p.situacao) upd.concluida_em = liberada ? TS() : null;
          }
          t.update(ref, upd);
          const reg = (tipo, texto) => t.set(ref.collection("historico").doc(), { lead: k, tipo, texto: texto.slice(0, 2000), autor: auth.currentUser.uid, autor_nome: cacheNome, criado_em: TS(), editado_em: null });
          eventosDoLead(antes, depois, dados, tentativa).forEach(([tipo, texto]) => reg(tipo, texto));
          saida = depois;
        });
        return saida;
      },

      // Histórico
      async historico(leadId) {
        const [pid, k] = separarId(leadId);
        const q = await db.collection(`pedidos/${pid}/historico`).where("lead", "==", k).get();
        return desdeRecebido(q.docs.map(doc));
      },
      async registrar(leadId, tipo, texto) {
        const [pid, k] = separarId(leadId);
        await db.collection(`pedidos/${pid}/historico`).add({ lead: k, tipo, texto, autor: auth.currentUser.uid, autor_nome: cacheNome, criado_em: TS(), editado_em: null });
      },
      async editarObservacao(leadId, hid, texto) {
        const [pid] = separarId(leadId);
        await db.doc(`pedidos/${pid}/historico/${hid}`).update({ texto, editado_em: TS() });
      },
      async excluirObservacao(leadId, hid) {
        const [pid] = separarId(leadId);
        await db.doc(`pedidos/${pid}/historico/${hid}`).delete();
      }
    };
    return api;
  }

  // ------------------------------------------------------------------
  // Demonstração em memória (nada é salvo; os dados são fictícios)
  // ------------------------------------------------------------------
  function criarDemo() {
    const agora = Date.now(), dia = 86400000;
    const iso = (d) => new Date(d).toISOString();
    const hojeMenos = (n) => { const d = new Date(agora - n * dia); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }; // data local
    const db = {
      perfis: [
        { id: "t1", nome: "Time Inside Sales", email: "inside.sales@voeazul.com.br", celular: "11900000000", cargo: "Inside Sales", papel: "admin", situacao: "aprovado", emailVerificado: true, siglaPrincipal: "", criadoEm: iso(agora - 40 * dia) },
        { id: "t2", nome: "Van Exemplo", email: "inside.van@voeazul.com.br", celular: "11900000009", cargo: "Inside Sales", papel: "time", situacao: "aprovado", emailVerificado: true, siglaPrincipal: "", criadoEm: iso(agora - 20 * dia) },
        { id: "r1", nome: "Marina Exemplo", email: "cpq.marina@voeazul.com.br", celular: "19900000001", papel: "representante", situacao: "aprovado", emailVerificado: true, siglaPrincipal: "CPQ", criadoEm: iso(agora - 30 * dia) },
        { id: "r2", nome: "Paulo Modelo", email: "cwb.paulo@voeazul.com.br", celular: "41900000002", cargo: "Representante", papel: "representante", situacao: "aprovado", emailVerificado: true, siglaPrincipal: "CWB", criadoEm: iso(agora - 25 * dia) },
        { id: "r3", nome: "Ana Teste", email: "rec.ana@voeazul.com.br", celular: "81900000003", papel: "representante", situacao: "pendente", emailVerificado: true, siglaPrincipal: "REC", criadoEm: iso(agora - 1 * dia) }
      ],
      unidades: [
        { id: "CPQ", sigla: "CPQ", cidade_uf: "Campinas/SP", regiao: "Sudeste", pedidoAtual: "CPQ-1" },
        { id: "VCP", sigla: "VCP", cidade_uf: "Valinhos/SP", regiao: "Sudeste", pedidoAtual: null },
        { id: "CWB", sigla: "CWB", cidade_uf: "Curitiba/PR", regiao: "Sul", pedidoAtual: "CWB-1" },
        { id: "REC", sigla: "REC", cidade_uf: "Recife/PE", regiao: "Nordeste", pedidoAtual: null }
      ],
      acessos: [
        { id: "r1_CPQ", uid: "r1", sigla: "CPQ", situacao: "aprovado", principal: true, nome: "Marina Exemplo", email: "cpq.marina@voeazul.com.br" },
        { id: "r1_VCP", uid: "r1", sigla: "VCP", situacao: "aprovado", principal: false, nome: "Marina Exemplo", email: "cpq.marina@voeazul.com.br" },
        { id: "r2_CWB", uid: "r2", sigla: "CWB", situacao: "aprovado", principal: true, nome: "Paulo Modelo", email: "cwb.paulo@voeazul.com.br" },
        { id: "r3_REC", uid: "r3", sigla: "REC", situacao: "pendente", principal: true, nome: "Ana Teste", email: "rec.ana@voeazul.com.br" }
      ],
      pedidos: [], historico: []
    };
    let usuario = null, seq = 1;
    const nomes = ["Tecidos Vale Verde", "Malharia Horizonte", "Confecção Primavera", "Uniformes Atlântico", "Moda Rio Claro", "Têxtil Serra Azul", "Bordados Santa Luzia", "Jeans Paulínia"];
    const sts = ["Em negociação", "Sem interesse", "Embarque iniciado", "Prospecção", "Novo", "Novo", "Prospecção", "Novo"];
    const leadsCpq = {};
    nomes.forEach((n, i) => {
      leadsCpq["l" + i] = { empresa: n, cnpj: `00.000.000/0001-${String(10 + i).padStart(2, "0")}`, segmento: "Confecções", cidade_uf: "Campinas/SP",
        contato: "Contato fictício", telefone: `1990000${String(1000 + i)}`, email: `contato${i}@exemplo.com.br`, status: sts[i],
        data_contato: sts[i] === "Novo" ? null : hojeMenos(8 - i), contato_valido: sts[i] === "Novo" ? "" : "Sim", atualizado_em: iso(agora - (12 - i) * dia),
        tentativas: [2, 2, 3, 3, 0, 0, 1, 0][i], ultima_tentativa: [2, 2, 3, 3, 0, 0, 1, 0][i] ? iso(agora - (2 + i) * dia) : null };
    });
    // Exemplos das novidades: próximo contato, motivo de perda e qualificação.
    Object.assign(leadsCpq.l0, { fantasia: "Vale Verde Tecidos", telefone: "19900001000",
      telefones: [{ n: "19900001000", t: "cel" }, { n: "19990001001", t: "cel" }, { n: "19990001002", t: "cel" }, { n: "1932510000", t: "fixo" }, { n: "1932510011", t: "fixo" }, { n: "4136000002", t: "fixo" }, { n: "08006660000", t: "0800" }],
      emails: ["contato0@exemplo.com.br", "compras@exemplo.com.br", "financeiro@exemplo.com.br", "vendas@exemplo.com.br"],
      site: "exemplo.com.br", linkedin: "linkedin.com/company/exemplo", instagram: "instagram.com/exemplo",
      endereco: "Rua Exemplo, 100 - Centro", bairro: "Centro", cep: "13015000", porte: "DEMAIS", funcionarios: "51-200", faturamento: "10M-30M", tipo_unidade: "MATRIZ", filiais: "3",
      cnaes: ["1351100", "4641901"], socios: ["Sócia Fictícia", "Sócio Fictício"] });
    Object.assign(leadsCpq.l0, { retorno: hojeMenos(0), retorno_hora: "10:00", lembrete: "Retornar com a cotação para Vinhedo.", volume: "~20 envios/mês", destinos: "Interior de SP e Sul de MG", transportadora: "Correios" });
    Object.assign(leadsCpq.l1, { motivo: "Sem volume agora", tentar_em: hojeMenos(0), lembrete: "" });
    Object.assign(leadsCpq.l3, { retorno: hojeMenos(1), retorno_hora: "14:00", lembrete: "Ligar depois das 14h, ela decide as compras." });
    Object.assign(leadsCpq.l6, { retorno: hojeMenos(-3), retorno_hora: "", lembrete: "Mandar a mensagem de retomada." });
    db.pedidos.push({ id: "CPQ-1", sigla: "CPQ", regiao: "Sudeste", cidade_uf: "Campinas/SP", solicitante: "r1", solicitante_nome: "Marina Exemplo",
      segmentos: ["Confecções", "Indústria têxtil"], cidades: ["Campinas/SP"], empresas: null, situacao: "Enviada", previsao: hojeMenos(10),
      responsavel: "Time Inside Sales", observacao_time: null, leads: leadsCpq, liberada: false, criada_em: iso(agora - 13 * dia), enviada_em: iso(agora - 12 * dia), concluida_em: null });
    db.pedidos.push({ id: "CWB-1", sigla: "CWB", regiao: "Sul", cidade_uf: "Curitiba/PR", solicitante: "r2", solicitante_nome: "Paulo Modelo",
      segmentos: ["Farmácias", "Laboratórios clínicos"], cidades: ["Curitiba/PR", "São José dos Pinhais/PR"], empresas: "CNAE 4771-7/01", situacao: "Nova", previsao: proximaSexta(),
      responsavel: null, observacao_time: null, leads: {}, liberada: false, criada_em: iso(agora - 1 * dia), enviada_em: null, concluida_em: null });
    CHAVES.slice(0, 8).forEach((k, i) => {
      db.historico.push({ id: "h" + seq++, pedido: "CPQ-1", lead: k, tipo: "recebido", texto: "Lead recebido no pedido CPQ-1", autor: "t1", autor_nome: "Time Inside Sales", criado_em: iso(agora - 12 * dia), editado_em: null });
      if (sts[i] !== "Novo") db.historico.push({ id: "h" + seq++, pedido: "CPQ-1", lead: k, tipo: "status", texto: `Status: Novo → ${sts[i]}`, autor: "r1", autor_nome: "Marina Exemplo", criado_em: iso(agora - (8 - i) * dia), editado_em: null });
    });
    db.historico.push({ id: "h" + seq++, pedido: "CPQ-1", lead: "l0", tipo: "observacao", texto: "Pediu proposta para envios semanais.", autor: "r1", autor_nome: "Marina Exemplo", criado_em: iso(agora - 2 * dia), editado_em: null });

    const copia = (x) => JSON.parse(JSON.stringify(x));
    const espera = () => new Promise(r => setTimeout(r, 120));
    const eu = () => usuario && db.perfis.find(p => p.id === usuario.id);
    const ehTime = () => eu() && ["time", "admin"].includes(eu().papel) && eu().situacao === "aprovado";
    const ehAdmin = () => ehTime() && eu().papel === "admin";
    const usa = (sigla) => ehTime() || db.acessos.some(a => a.uid === usuario.id && a.sigla === sigla && a.situacao === "aprovado");
    const negar = () => { const e = new Error("Você não tem permissão para esta ação."); e.code = "permission-denied"; throw e; };
    const pedidoLiberado = (id) => { const p = db.pedidos.find(x => x.id === id); return !p || ["Concluída", "Sem leads", "Cancelada"].includes(p.situacao) || (p.situacao === "Enviada" && p.liberada); };
    const reg = (pid, k, tipo, texto) => db.historico.push({ id: "h" + seq++, pedido: pid, lead: k, tipo, texto, autor: usuario.id, autor_nome: eu().nome, criado_em: new Date().toISOString(), editado_em: null });
    const mesmoDia = (t) => new Date(t).toLocaleDateString("pt-BR") === new Date().toLocaleDateString("pt-BR");

    return {
      demo: true,
      traduzir, proximaSexta, limparEmail, limparTelefone, siglaDoEmail, normalizarTelefone, lerTelefones, lerEmails, foneTexto,
      async sessao() { return usuario ? { ...usuario, verificado: !!(eu() && eu().emailVerificado) } : null; },
      async entrar(email) {
        await espera();
        const p = db.perfis.find(x => x.email === email.trim().toLowerCase());
        if (!p) { const e = new Error(); e.code = "auth/invalid-credential"; throw e; }
        usuario = { id: p.id, email: p.email };
      },
      async entrarComo(id) { usuario = { id, email: db.perfis.find(p => p.id === id).email }; },
      async esqueciSenha() { await espera(); },
      async cadastrar(email, senha, dados) {
        await espera();
        email = email.trim().toLowerCase();
        if (!DOMINIOS.includes(email.split("@")[1])) throw new Error(`Use seu e-mail corporativo (${dominiosTexto()}).`);
        if (db.perfis.some(p => p.email === email)) { const e = new Error(); e.code = "auth/email-already-in-use"; throw e; }
        const id = "u" + Math.random().toString(36).slice(2, 8);
        const exec = !dados.time && dados.cargo === "Executivo";
        const sigla = dados.time ? "" : exec ? siglaExecutivo(id) : dados.sigla.toUpperCase();
        db.perfis.push({ id, nome: dados.nome, email, celular: dados.celular, cargo: dados.time ? "Inside Sales" : (dados.cargo || "Representante"), papel: "representante", situacao: "pendente", emailVerificado: false, siglaPrincipal: sigla, criadoEm: new Date().toISOString() });
        if (sigla) {
          if (!db.unidades.some(u => u.sigla === sigla)) db.unidades.push({ id: sigla, sigla, cidade_uf: dados.cidade_uf, regiao: dados.regiao, pedidoAtual: null, ...(exec ? { nome: nomeCarteira(dados.nome), tipo: "executivo" } : {}) });
          db.acessos.push({ id: `${id}_${sigla}`, uid: id, sigla, situacao: "pendente", principal: true, nome: dados.nome, email });
        }
        usuario = { id, email };
        return { confirmar: false };
      },
      async reenviarConfirmacao() { await espera(); },
      async conferirConfirmacao() { return !!(eu() && eu().emailVerificado); },
      async simularConfirmacao() { eu().emailVerificado = true; },
      async sair() { usuario = null; },
      async trocarSenha() { await espera(); },
      async meuPerfil() {
        if (!eu()) return null;
        const unidades = db.acessos.filter(a => a.uid === usuario.id).map(a => ({ ...copia(db.unidades.find(u => u.sigla === a.sigla) || { sigla: a.sigla }), acesso: a.situacao, principal: a.principal, acessoId: a.id }));
        return { ...copia(eu()), verificado: eu().emailVerificado, unidades: unidades.sort((a, b) => (b.principal - a.principal) || a.sigla.localeCompare(b.sigla)) };
      },
      async pedirUnidade(dados) {
        await espera();
        const sigla = dados.sigla.toUpperCase();
        if (!db.unidades.some(u => u.sigla === sigla)) db.unidades.push({ id: sigla, sigla, cidade_uf: dados.cidade_uf, regiao: dados.regiao, pedidoAtual: null });
        if (!db.acessos.some(a => a.uid === usuario.id && a.sigla === sigla)) db.acessos.push({ id: `${usuario.id}_${sigla}`, uid: usuario.id, sigla, situacao: "pendente", principal: false, nome: eu().nome, email: eu().email });
      },
      async perfis() { if (!ehTime()) negar(); return copia(db.perfis); },
      async acessos() { if (!ehTime()) negar(); return copia(db.acessos); },
      async unidades() { return copia(db.unidades); },
      async atualizarPerfil(id, dados) { if (!ehAdmin()) negar(); Object.assign(db.perfis.find(p => p.id === id), dados); },
      async atualizarAcesso(id, situacao) { if (!ehAdmin()) negar(); db.acessos.find(a => a.id === id).situacao = situacao; },
      async excluirCadastro(id) { if (!ehAdmin() || id === usuario.id) negar(); Object.assign(db.perfis.find(p => p.id === id), { situacao: "excluido", excluido_em: new Date().toISOString(), excluido_por: eu().nome }); db.acessos.filter(a => a.uid === id).forEach(a => a.situacao = "recusado"); },
      async reativarCadastro(id) { if (!ehAdmin()) negar(); db.perfis.find(p => p.id === id).situacao = "pendente"; },
      async aprovarCadastro(id) { if (!ehAdmin()) negar(); db.perfis.find(p => p.id === id).situacao = "aprovado"; db.acessos.filter(a => a.uid === id && a.principal).forEach(a => a.situacao = "aprovado"); },
      async enviarRedefinicao() { if (!ehTime()) negar(); await espera(); },
      async pedidos(siglas) {
        const lista = db.pedidos.filter(p => siglas ? siglas.includes(p.sigla) && usa(p.sigla) : ehTime());
        return copia(lista).sort((a, b) => String(b.criada_em).localeCompare(String(a.criada_em)));
      },
      leadsDe: achatar,
      async criarPedido(dados) {
        await espera();
        if (!usa(dados.sigla)) negar();
        const u = db.unidades.find(x => x.sigla === dados.sigla);
        if (u.pedidoAtual && !pedidoLiberado(u.pedidoAtual)) negar();
        const id = dados.sigla + "-" + (db.pedidos.filter(p => p.sigla === dados.sigla).length + 1);
        db.pedidos.push({ id, sigla: dados.sigla, regiao: dados.regiao, cidade_uf: dados.cidade_uf, solicitante: usuario.id, solicitante_nome: eu().nome,
          segmentos: dados.segmentos, cidades: dados.cidades, empresas: dados.empresas || null, situacao: "Nova", previsao: proximaSexta(), responsavel: null,
          observacao_time: null, leads: {}, liberada: false, travando: 0, alterado: null, criada_em: new Date().toISOString(), enviada_em: null, concluida_em: null });
        u.pedidoAtual = id;
        return { id, previsao: proximaSexta() };
      },
      async atualizarPedido(id, dados) {
        if (!ehTime()) negar();
        const d = { ...dados };
        ["enviada_em", "concluida_em"].forEach(k => { if (d[k] === true) d[k] = new Date().toISOString(); });
        Object.assign(db.pedidos.find(p => p.id === id), d);
      },
      async incluirLeads(pedidoId, linhas, extra) {
        await espera();
        if (!ehTime()) negar();
        const p = db.pedidos.find(x => x.id === pedidoId);
        const livres = CHAVES.filter(k => !p.leads[k]);
        if (linhas.length > livres.length) throw new Error(`Cada pedido aceita até ${MAX} leads. Este pedido ainda tem espaço para ${livres.length}.`);
        linhas.forEach((l, i) => {
          const k = livres[i];
          p.leads[k] = { empresa: l.empresa, cnpj: l.cnpj || null, segmento: l.segmento || null, cidade_uf: l.cidade_uf || null, contato: l.contato || null,
            telefone: limparTelefone(l.telefone) || null, email: limparEmail(l.email) || null, status: "Novo", data_contato: null, contato_valido: "", atualizado_em: new Date().toISOString(), ...extrasDoLead(l) };
          reg(pedidoId, k, "recebido", `Lead recebido no pedido ${pedidoId}`);
        });
        p.liberada = liberadaDe(p.leads); p.travando = travandoDe(p.leads);
        const d = { ...(extra || {}) }; if (d.enviada_em === true) d.enviada_em = new Date().toISOString();
        Object.assign(p, d);
      },
      async apagarLeadsDoPedido(pedidoId) { if (!ehAdmin()) negar(); const p = db.pedidos.find(x => x.id === pedidoId); p.leads = {}; p.liberada = false; },
      async atualizarLead(id, dados, tentativa) {
        await espera();
        const [pid, k] = separarId(id);
        const p = db.pedidos.find(x => x.id === pid);
        if (!usa(p.sigla)) negar();
        const antes = p.leads[k];
        const depois = { ...antes, ...dados, atualizado_em: new Date().toISOString() };
        aplicarTentativa(antes, depois, tentativa);
        p.leads[k] = depois;
        p.liberada = liberadaDe(p.leads); p.travando = travandoDe(p.leads); p.alterado = k;
        if (["Enviada", "Concluída"].includes(p.situacao)) { const s = p.liberada ? "Concluída" : "Enviada"; if (s !== p.situacao) p.concluida_em = p.liberada ? new Date().toISOString() : null; p.situacao = s; }
        eventosDoLead(antes, depois, dados, tentativa).forEach(([tipo, texto]) => reg(pid, k, tipo, texto));
        return copia(depois);
      },
      async historico(leadId) {
        const [pid, k] = separarId(leadId);
        return desdeRecebido(copia(db.historico.filter(h => h.pedido === pid && h.lead === k)));
      },
      async registrar(leadId, tipo, texto) { await espera(); const [pid, k] = separarId(leadId); reg(pid, k, tipo, texto); },
      async editarObservacao(leadId, hid, texto) {
        const h = db.historico.find(x => x.id === hid);
        if (h.tipo !== "observacao" || h.autor !== usuario.id || !mesmoDia(h.criado_em)) negar();
        h.texto = texto; h.editado_em = new Date().toISOString();
      },
      async excluirObservacao(leadId, hid) {
        const h = db.historico.find(x => x.id === hid);
        if (h.tipo !== "observacao" || h.autor !== usuario.id || !mesmoDia(h.criado_em)) negar();
        db.historico.splice(db.historico.indexOf(h), 1);
      }
    };
  }

  const usarFirebase = cfg.firebase && cfg.firebase.apiKey && window.firebase;
  window.API = usarFirebase ? criarFirebase() : criarDemo();
})();
