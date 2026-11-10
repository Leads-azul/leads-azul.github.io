// Portal de Leads · telas e regras de interface
(function () {
  const cfg = window.PORTAL_CONFIG || {};
  const L = window.LISTAS;
  const API = window.API;
  const STATUS = L.status;
  const FINAIS = new Set(STATUS.filter(s => s.final).map(s => s.nome));
  const COR = Object.fromEntries(STATUS.map(s => [s.nome, s.cor]));
  const PRAZO = Number(cfg.prazoRetornoDias) || 7;
  const DIA = 86400000;
  const $app = document.getElementById("app");
  const $janela = document.getElementById("janela");

  const E = {
    perfil: null, perfis: [], pedidos: [], leads: [],
    tela: null, vista: window.innerWidth < 900 ? "lista" : "kanban",
    f: { busca: "", status: "", regiao: "", loja: "", base: "atual", situacao: "abertos", cadastro: "pendente" }
  };

  // ------------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------------
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const data = (v) => { if (!v) return ""; const d = new Date(String(v).length === 10 ? v + "T12:00:00" : v); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR"); };
  const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const dias = (v) => v ? Math.floor((Date.now() - new Date(v).getTime()) / DIA) : 0;
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const urlPortal = () => location.origin + location.pathname;
  const ehTime = () => E.perfil && E.perfil.papel === "time";
  const final = (l) => FINAIS.has(l.status);
  const parado = (l) => !final(l) && dias(l.atualizado_em) > PRAZO;
  const slug = (s) => norm(s).replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  const segmentosDe = (p) => [p.segmento_1, p.segmento_2, p.segmento_3].filter(Boolean).join(", ");

  function fone(num) {
    let d = String(num || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length <= 11) d = "55" + d.replace(/^0+/, "");
    return d;
  }
  function zap(num, texto) {
    const f = fone(num);
    return f ? `https://wa.me/${f}?text=${encodeURIComponent(texto)}` : "";
  }

  let toastTimer;
  function aviso(msg, erro) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.className = "toast ver" + (erro ? " erro" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = "toast", erro ? 6000 : 3200);
  }

  function opcoes(lista, atual, vazio) {
    return (vazio !== undefined ? `<option value="">${esc(vazio)}</option>` : "") +
      lista.map(v => `<option value="${esc(v)}"${v === atual ? " selected" : ""}>${esc(v)}</option>`).join("");
  }
  const CONFIRMA = cfg.confirmacaoEmail === true;
  const EMPRESA = cfg.empresa || "Azul Logística";
  const TIME = cfg.nomeDoTime || "Inside Sales";
  const logo = (cls) => cfg.logoUrl ? `<img class="${cls || "logo"}" src="${esc(cfg.logoUrl)}" alt="${esc(EMPRESA)}">` : "";
  const ICONES = {
    pedido: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
    leads: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
    retorno: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    fechado: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    aviao: '<path d="M2 13l8-1 5-8h2l-2 8 5 1 2-2h1l-1 3 1 3h-1l-2-2-5 1 2 8h-2l-5-8-8-1z"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  const icone = (n) => `<span class="icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES[n]}</svg></span>`;
  const sobre = () => `${esc(TIME)} | ${esc(EMPRESA)}`;
  const ROTA = `<svg class="rota" viewBox="0 0 600 600" aria-hidden="true"><path d="M-40 520 C 160 420, 260 470, 360 300 S 560 120, 660 60" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/><path d="M-40 600 C 200 520, 330 560, 430 400 S 600 260, 680 210" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 12" stroke-linecap="round" opacity=".6"/><g transform="translate(372 286) rotate(-38) scale(1.6)" fill="currentColor" stroke="none"><path d="M2 13l8-1 5-8h2l-2 8 5 1 2-2h1l-1 3 1 3h-1l-2-2-5 1 2 8h-2l-5-8-8-1z" transform="translate(-12 -12)"/></g></svg>`;

  const chipSituacao = (s) => `<span class="situacao s-${slug(s)}">${esc(s)}</span>`;
  const ponto = (s) => `<span class="ponto" style="background:${COR[s] || "#999"}"></span>`;

  function abrir(html, ligar) {
    $janela.innerHTML = html;
    if (!$janela.open) $janela.showModal();
    $janela.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", fechar));
    if (ligar) ligar($janela);
  }
  function fechar() { if ($janela.open) $janela.close(); }
  $janela.addEventListener("click", (e) => { if (e.target === $janela) fechar(); });

  async function ocupado(botao, fn) {
    const texto = botao.textContent;
    botao.disabled = true; botao.textContent = "Aguarde…";
    try { return await fn(); }
    finally { botao.disabled = false; botao.textContent = texto; }
  }

  // ------------------------------------------------------------------
  // Início
  // ------------------------------------------------------------------
  async function iniciar() {
    if (API.demo) document.getElementById("faixa-demo").hidden = false;
    try {
      const erroLink = erroDoLink();
      const u = await API.sessao();
      if (!u) return telaAcesso("entrar", erroLink || undefined);
      E.perfil = await API.meuPerfil();
      if (!E.perfil) { await API.sair(); return telaAcesso("entrar", "Não encontramos seu cadastro. Crie seu acesso de novo."); }
      if (E.perfil.situacao !== "aprovado") return telaEspera();
      E.tela = E.tela || (ehTime() ? "pedidos" : "leads");
      await carregar();
      desenhar();
    } catch (e) {
      $app.innerHTML = `<div class="carregando"><div class="vazio"><h2>Não foi possível abrir o portal</h2><p>${esc(API.traduzir(e))}</p><button class="btn btn-primario" onclick="location.reload()">Tentar de novo</button></div></div>`;
    }
  }

  async function carregar() {
    const [pedidos, leads, perfis] = await Promise.all([API.pedidos(), API.leads(), ehTime() ? API.perfis() : Promise.resolve([])]);
    E.pedidos = pedidos; E.leads = leads; E.perfis = perfis;
  }
  async function recarregar() { await carregar(); desenhar(); }

  // ------------------------------------------------------------------
  // Acesso: entrar e criar cadastro
  // ------------------------------------------------------------------
  function telaAcesso(modo, erro) {
    const dominios = cfg.dominiosPermitidos || ["voeazul.com.br"];
    const dominio = dominios[0];
    const formEntrar = `
      <h2>Entrar</h2>
      <p class="sub">Use o e-mail e a senha que você criou neste portal.</p>
      ${erro ? `<div class="erro-form">${esc(erro)}</div>` : ""}
      <form id="f-entrar" novalidate>
        <div class="campo"><label for="e-email">E-mail Azul</label><input id="e-email" type="email" autocomplete="username" required placeholder="nome.sobrenome@${esc(dominio)}"></div>
        <div class="campo"><label for="e-senha">Senha</label><input id="e-senha" type="password" autocomplete="current-password" required></div>
        <div class="erro-form" id="e-erro" hidden></div>
        <button class="btn btn-primario btn-largo" type="submit">Entrar</button>
      </form>
      <p class="sub" style="margin-top:18px">Primeiro acesso? <button class="link-btn" data-modo="cadastro">Criar meu acesso</button></p>
      <p class="sub" style="margin-top:-12px;font-size:13px">Esqueceu a senha? Fale com o time de ${esc(cfg.nomeDoTime || "Inside Sales")} pelo WhatsApp.</p>`;

    const formCadastro = `
      <h2>Criar meu acesso</h2>
      <p class="sub">Preencha uma vez. O time de ${esc(cfg.nomeDoTime || "Inside Sales")} aprova seu acesso e avisa você pelo WhatsApp.</p>
      <form id="f-cadastro" novalidate>
        <div class="campo"><label for="c-nome">Nome completo</label><input id="c-nome" type="text" autocomplete="name" required></div>
        <div class="campo"><label for="c-email">E-mail Azul</label><input id="c-email" type="email" autocomplete="email" required placeholder="nome.sobrenome@${esc(dominio)}"><span class="dica">Aceitos: ${esc(dominios.map(d => "@" + d).join(" ou "))}.${CONFIRMA ? " Vamos mandar um link de confirmação para ele." : ""}</span></div>
        <div class="grade-2">
          <div class="campo"><label for="c-cel">Celular com DDD</label><input id="c-cel" type="tel" autocomplete="tel" required placeholder="(11) 90000-0000"></div>
          <div class="campo"><label for="c-sigla">Sigla da unidade</label><input id="c-sigla" type="text" required maxlength="10" placeholder="Ex.: AZV" style="text-transform:uppercase"></div>
        </div>
        <div class="grade-2">
          <div class="campo"><label for="c-cidade">Cidade/UF</label><input id="c-cidade" type="text" required placeholder="Campinas/SP"></div>
          <div class="campo"><label for="c-regiao">Região</label><select id="c-regiao" required>${opcoes(L.regioes, "", "Escolha")}</select></div>
        </div>
        <div class="aviso-senha">${icone("cadeado")}<span>Crie uma senha só para este portal. Não use a senha da sua conta Azul.</span></div>
        <div class="grade-2">
          <div class="campo"><label for="c-senha">Senha</label><input id="c-senha" type="password" autocomplete="new-password" required minlength="8"><span class="dica">Mínimo de 8 caracteres</span></div>
          <div class="campo"><label for="c-senha2">Repita a senha</label><input id="c-senha2" type="password" autocomplete="new-password" required></div>
        </div>
        <div class="erro-form" id="c-erro" hidden></div>
        <button class="btn btn-primario btn-largo" type="submit">Criar acesso</button>
      </form>
      <p class="sub" style="margin-top:18px">Já tem acesso? <button class="link-btn" data-modo="entrar">Entrar</button></p>`;

    const atalhos = API.demo ? `
      <div class="demo-atalhos">
        <p>Para conhecer o portal sem cadastro:</p>
        <button class="btn" data-demo="r1">Ver como representante (loja CPQ)</button>
        <button class="btn" data-demo="t1">Ver como time de Inside Sales</button>
      </div>` : "";

    $app.innerHTML = `
      <div class="acesso">
        <section class="acesso-lado">
          ${ROTA}
          <div class="marca-topo">${logo()}<span>${esc(TIME)} <span class="sep">|</span> ${esc(EMPRESA)}</span></div>
          <div>
            <p class="sobrelinha">Nova plataforma de leads Leads2b</p>
            <h1>${esc(cfg.nomeDoPortal || "Portal de Leads")}</h1>
            <p>Peça bases de leads para a sua loja e registre o retorno de cada contato em um só lugar.</p>
          </div>
          <ol class="passos">
            <li><span class="n">1</span><span><b>Crie seu acesso</b>Com o e-mail Azul e a sigla da sua loja.</span></li>
            <li><span class="n">2</span><span><b>Peça uma base</b>Escolha até 3 segmentos fortes na sua região.</span></li>
            <li><span class="n">3</span><span><b>Atualize os contatos</b>Finalize todos os leads para liberar a próxima base.</span></li>
          </ol>
          <p class="rodape-lado">Ferramenta interna do time de ${esc(TIME)}. Este portal tem login próprio e não usa a senha da sua conta Azul.</p>
        </section>
        <section class="acesso-form"><div class="acesso-caixa">${modo === "cadastro" ? formCadastro : formEntrar}${atalhos}</div></section>
      </div>`;

    $app.querySelectorAll("[data-modo]").forEach(b => b.addEventListener("click", () => telaAcesso(b.dataset.modo)));
    $app.querySelectorAll("[data-demo]").forEach(b => b.addEventListener("click", async () => { await API.entrarComo(b.dataset.demo); E.tela = null; iniciar(); }));

    const fe = document.getElementById("f-entrar");
    if (fe) fe.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const erro = document.getElementById("e-erro");
      const email = document.getElementById("e-email").value, senha = document.getElementById("e-senha").value;
      if (!email || !senha) { erro.textContent = "Informe e-mail e senha."; erro.hidden = false; return; }
      try { await ocupado(fe.querySelector("button[type=submit]"), () => API.entrar(email, senha)); E.tela = null; iniciar(); }
      catch (e) {
        const m = API.traduzir(e);
        if (/não confirmado/i.test(m)) return telaConfirmar(email, true);
        erro.textContent = m; erro.hidden = false;
      }
    });

    const fc = document.getElementById("f-cadastro");
    if (fc) fc.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const v = (id) => document.getElementById(id).value.trim();
      const erro = document.getElementById("c-erro");
      const mostrar = (m) => { erro.textContent = m; erro.hidden = false; };
      const email = v("c-email").toLowerCase();
      const doms = cfg.dominiosPermitidos || [];
      if (!v("c-nome") || !email || !v("c-cel") || !v("c-sigla") || !v("c-cidade") || !v("c-regiao")) return mostrar("Preencha todos os campos.");
      if (doms.length && !doms.includes(email.split("@")[1])) return mostrar(`Use seu e-mail corporativo (@${doms.join(" ou @")}).`);
      if (fone(v("c-cel")).length < 12) return mostrar("Informe o celular com DDD.");
      if (v("c-senha").length < 8) return mostrar("A senha precisa ter pelo menos 8 caracteres.");
      if (v("c-senha") !== v("c-senha2")) return mostrar("As senhas não são iguais.");
      try {
        const r = await ocupado(fc.querySelector("button[type=submit]"), () => API.cadastrar(email, v("c-senha"), {
          nome: v("c-nome"), celular: v("c-cel"), sigla: v("c-sigla").toUpperCase(), cidade_uf: v("c-cidade"), regiao: v("c-regiao")
        }));
        if (r && r.confirmar) return telaConfirmar(email);
        E.tela = null; iniciar();
      } catch (e) { mostrar(API.traduzir(e)); }
    });
  }

  // Confirmação de e-mail: aparece logo depois do cadastro ou quando a pessoa
  // tenta entrar sem ter clicado no link.
  function telaConfirmar(email, veioDoLogin) {
    $app.innerHTML = `
      <div class="carregando"><div class="vazio confirmar" style="max-width:560px">
        <span class="icone icone-grande" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span>
        <h2>${veioDoLogin ? "Falta confirmar seu e-mail" : "Confirme seu e-mail"}</h2>
        <p>${veioDoLogin ? "Antes de entrar, confirme o e-mail" : "Enviamos um link de confirmação para"} <b>${esc(email)}</b>.</p>
        <ol class="passos-confirmar">
          <li>Abra a mensagem do <b>${esc(cfg.nomeDoPortal || "Portal de Leads")}</b> na sua caixa de entrada. Se não achar, veja o lixo eletrônico.</li>
          <li>Clique em <b>Confirmar meu e-mail</b>.</li>
          <li>Depois disso, o time de ${esc(TIME)} confere seus dados e libera o acesso da loja.</li>
        </ol>
        <div class="acoes" style="justify-content:center">
          <button class="btn" id="b-reenviar">Reenviar e-mail</button>
          <button class="btn" id="b-voltar">Voltar para entrar</button>
        </div>
        ${API.demo ? `<p class="sub" style="margin-top:18px"><button class="btn btn-primario" id="b-simular">Simular clique no link do e-mail</button></p>` : ""}
      </div></div>`;
    document.getElementById("b-voltar").onclick = () => telaAcesso("entrar");
    document.getElementById("b-reenviar").onclick = async (ev) => {
      try { await ocupado(ev.currentTarget, () => API.reenviarConfirmacao(email)); aviso("Enviamos um novo link. Confira a caixa de entrada e o lixo eletrônico."); }
      catch (e) { aviso(API.traduzir(e), true); }
    };
    const s = document.getElementById("b-simular");
    if (s) s.onclick = async () => { await API.simularConfirmacao(email); E.tela = null; iniciar(); };
  }

  // Link de confirmação vencido ou já usado: o Supabase devolve o erro no endereço.
  function erroDoLink() {
    const h = new URLSearchParams(location.hash.replace(/^#/, "")), q = new URLSearchParams(location.search);
    const cod = h.get("error_code") || q.get("error_code") || h.get("error") || q.get("error");
    if (!cod) return "";
    history.replaceState(null, "", location.pathname);
    return /expired|otp/i.test(cod)
      ? "O link de confirmação venceu ou já foi usado. Entre com seu e-mail e senha: se ainda faltar confirmar, você pode pedir um novo link."
      : "Não foi possível confirmar pelo link. Entre com seu e-mail e senha para tentar de novo.";
  }

  function telaEspera() {
    const p = E.perfil;
    const recusado = p.situacao === "recusado";
    $app.innerHTML = `
      <div class="carregando"><div class="vazio" style="max-width:520px">
        ${CONFIRMA && !recusado && p.email_confirmado !== false ? `<p class="selo selo-ok" style="margin:0 auto 10px">E-mail confirmado</p>` : ""}
        <h2>${recusado ? "Seu acesso não foi aprovado" : "Cadastro enviado"}</h2>
        <p>${recusado
          ? `Fale com o time de ${esc(cfg.nomeDoTime || "Inside Sales")} para revisar o cadastro da loja ${esc(p.sigla)}.`
          : `O time de ${esc(cfg.nomeDoTime || "Inside Sales")} vai conferir seus dados e liberar o acesso da loja ${esc(p.sigla)}. Você recebe um aviso pelo WhatsApp quando estiver pronto.`}</p>
        <div class="acoes" style="justify-content:center">
          <button class="btn" id="b-atualizar">Já fui aprovado</button>
          <button class="btn" id="b-sair">Sair</button>
        </div>
      </div></div>`;
    document.getElementById("b-atualizar").onclick = () => iniciar();
    document.getElementById("b-sair").onclick = sair;
  }

  async function sair() { await API.sair(); E.perfil = null; E.tela = null; telaAcesso("entrar"); }

  // ------------------------------------------------------------------
  // Estrutura com menu lateral
  // ------------------------------------------------------------------
  function desenhar() {
    const time = ehTime();
    const pendentes = E.perfis.filter(p => p.situacao === "pendente").length;
    const novos = E.pedidos.filter(p => p.situacao === "Nova").length;
    const itens = time
      ? [["pedidos", "Pedidos", novos], ["leads", "Leads"], ["cadastros", "Cadastros", pendentes], ["painel", "Painel"], ["conta", "Minha conta"]]
      : [["leads", "Meus leads"], ["pedidos", "Meus pedidos"], ["conta", "Minha conta"]];

    const conteudo = {
      leads: time ? telaLeadsTime : telaLeadsRep,
      pedidos: time ? telaPedidosTime : telaPedidosRep,
      cadastros: telaCadastros,
      painel: telaPainel,
      conta: telaConta
    }[E.tela] || (() => "");

    $app.innerHTML = `
      <div class="app">
        <aside class="lateral">
          <div class="marca">${logo("logo logo-menu")}<span>${esc(cfg.nomeDoPortal || "Portal de Leads")}<small>${esc(TIME)} | ${esc(EMPRESA)}</small></span></div>
          <nav class="nav" aria-label="Menu">
            ${itens.map(([id, nome, n]) => `<button data-tela="${id}"${E.tela === id ? ' aria-current="page"' : ""}><span>${nome}</span>${n ? `<span class="contador">${n}</span>` : ""}</button>`).join("")}
          </nav>
          <div class="quem">
            <div><div class="nome">${esc(E.perfil.nome)}</div><div class="papel">${time ? "Time de " + esc(cfg.nomeDoTime || "Inside Sales") : "Loja " + esc(E.perfil.sigla)}</div></div>
            <button class="link-btn" id="b-sair">Sair da conta</button>
          </div>
        </aside>
        <main class="principal" id="principal">${conteudo()}<p class="rodape">${esc(cfg.nomeDoPortal || "Portal de Leads")}, ferramenta do time de ${esc(TIME)} | ${esc(EMPRESA)}</p></main>
      </div>`;

    $app.querySelectorAll("[data-tela]").forEach(b => b.addEventListener("click", () => { E.tela = b.dataset.tela; E.f.busca = ""; desenhar(); window.scrollTo(0, 0); }));
    document.getElementById("b-sair").onclick = sair;
    ligarTela();
  }

  // Liga eventos comuns da área principal.
  function ligarTela() {
    const m = document.getElementById("principal");
    m.querySelectorAll("[data-filtro]").forEach(el => {
      const ev = el.tagName === "INPUT" ? "input" : "change";
      el.addEventListener(ev, () => {
        E.f[el.dataset.filtro] = el.value;
        if (el.tagName === "INPUT") { clearTimeout(el._t); el._t = setTimeout(() => { desenhar(); focarBusca(); }, 250); }
        else desenhar();
      });
    });
    m.querySelectorAll("[data-pilula]").forEach(b => b.addEventListener("click", () => { E.f[b.dataset.pilula] = b.dataset.valor; desenhar(); }));
    m.querySelectorAll("[data-vista]").forEach(b => b.addEventListener("click", () => { E.vista = b.dataset.vista; desenhar(); }));
    m.querySelectorAll("[data-lead]").forEach(el => el.addEventListener("click", (ev) => {
      if (ev.target.closest("select, a, button.nao-abre")) return;
      janelaLead(Number(el.dataset.lead));
    }));
    m.querySelectorAll(".cartao[data-lead]").forEach(el => el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); janelaLead(Number(el.dataset.lead)); }
    }));
    m.querySelectorAll("select[data-status-rapido]").forEach(sel => sel.addEventListener("change", () => salvarStatus(Number(sel.dataset.statusRapido), sel.value)));
    m.querySelectorAll("[data-pedido]").forEach(el => el.addEventListener("click", () => ehTime() ? janelaPedidoTime(Number(el.dataset.pedido)) : null));
    m.querySelectorAll("[data-acao]").forEach(b => b.addEventListener("click", (ev) => { ev.stopPropagation(); acoes[b.dataset.acao](b); }));
    ligarKanban(m);
  }
  function focarBusca() {
    const b = document.querySelector("[data-filtro=busca]");
    if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  }

  const acoes = {
    novoPedido: () => janelaNovoPedido(),
    atualizar: async (b) => { await ocupado(b, recarregar); aviso("Dados atualizados."); },
    exportar: () => exportarLeads(),
    irPedidos: () => { E.tela = "pedidos"; desenhar(); },
    irLeads: () => { E.tela = "leads"; desenhar(); },
    aprovar: (b) => mudarCadastro(b.dataset.id, { situacao: "aprovado" }, "Cadastro aprovado."),
    recusar: (b) => mudarCadastro(b.dataset.id, { situacao: "recusado" }, "Cadastro recusado."),
    tornarTime: (b) => { if (confirm("Dar acesso de time a esta pessoa? Ela passa a ver e alterar tudo.")) mudarCadastro(b.dataset.id, { papel: "time" }, "Acesso de time liberado."); },
    tornarRep: (b) => mudarCadastro(b.dataset.id, { papel: "representante" }, "Acesso alterado para representante."),
    senha: (b) => janelaSenha(b.dataset.id)
  };

  // ------------------------------------------------------------------
  // Leads: filtros, Kanban e lista
  // ------------------------------------------------------------------
  function pedidoDe(l) { return E.pedidos.find(p => p.id === l.solicitacao_id) || {}; }

  function filtrarLeads(lista) {
    const b = norm(E.f.busca);
    return lista.filter(l => {
      if (E.f.status && l.status !== E.f.status) return false;
      if (ehTime()) {
        if (E.f.loja && l.sigla !== E.f.loja) return false;
        if (E.f.regiao && pedidoDe(l).regiao !== E.f.regiao) return false;
      }
      if (b && !norm([l.empresa, l.cnpj, l.contato, l.telefone, l.email, l.cidade_uf, l.sigla].join(" ")).includes(b)) return false;
      return true;
    });
  }

  function cartao(l) {
    const p = pedidoDe(l);
    return `
      <div class="cartao" role="button" tabindex="0" data-lead="${l.id}" draggable="true" aria-label="${esc(l.empresa)}, ${esc(l.status)}">
        <span class="titulo">${esc(l.empresa)}</span>
        <span class="meta">
          ${l.cnpj ? esc(l.cnpj) + "<br>" : ""}
          ${l.contato ? esc(l.contato) + "<br>" : ""}
          ${esc([l.cidade_uf, ehTime() ? "Loja " + l.sigla : l.segmento].filter(Boolean).join(" · "))}
        </span>
        <span class="rodape">
          ${l.data_contato ? `<span class="etiqueta">Contato ${data(l.data_contato)}</span>` : ""}
          ${parado(l) ? `<span class="etiqueta alerta">Parado há ${dias(l.atualizado_em)} dias</span>` : ""}
          ${ehTime() && p.id ? `<span class="etiqueta">Pedido ${p.id}</span>` : ""}
        </span>
      </div>`;
  }

  function quadro(lista) {
    return `<div class="quadro">${STATUS.map(s => {
      const itens = lista.filter(l => l.status === s.nome);
      return `<section class="coluna" data-coluna="${esc(s.nome)}" aria-label="${esc(s.nome)}">
        <div class="coluna-topo"><span>${ponto(s.nome)}${esc(s.nome)}</span><span class="qtd">${itens.length}</span></div>
        ${itens.length ? itens.map(cartao).join("") : `<div class="coluna-vazia">Nenhum lead aqui</div>`}
      </section>`;
    }).join("")}</div>`;
  }

  function tabelaLeads(lista) {
    if (!lista.length) return `<div class="vazio"><h2>Nenhum lead encontrado</h2><p>Mude os filtros para ver outros leads.</p></div>`;
    return `<div class="tabela-wrap"><table class="lista-leads">
      <thead><tr><th>Empresa</th>${ehTime() ? "<th>Loja</th>" : ""}<th>Contato</th><th>Cidade</th><th>Status</th><th>Último contato</th><th>Observação</th></tr></thead>
      <tbody>${lista.map(l => `
        <tr class="clicavel" data-lead="${l.id}">
          <td><b>${esc(l.empresa)}</b><div class="sec">${esc(l.cnpj)}</div></td>
          ${ehTime() ? `<td data-rotulo="Loja">${esc(l.sigla)}</td>` : ""}
          <td>${esc(l.contato)}<div class="sec">${esc(l.telefone)}</div></td>
          <td>${esc(l.cidade_uf)}</td>
          <td><select data-status-rapido="${l.id}" aria-label="Status de ${esc(l.empresa)}">${opcoes(STATUS.map(s => s.nome), l.status)}</select>
            ${parado(l) ? `<div class="sec" style="color:var(--danger)">Parado há ${dias(l.atualizado_em)} dias</div>` : ""}</td>
          <td data-rotulo="Último contato">${data(l.data_contato)}</td>
          <td class="sec">${esc((l.observacao || "").slice(0, 80))}${(l.observacao || "").length > 80 ? "…" : ""}</td>
        </tr>`).join("")}</tbody></table></div>`;
  }

  function seletorVista() {
    return `<div class="pilulas" role="group" aria-label="Forma de ver">
      <button data-vista="kanban" aria-pressed="${E.vista === "kanban"}">Kanban</button>
      <button data-vista="lista" aria-pressed="${E.vista === "lista"}">Lista</button></div>`;
  }

  function ligarKanban(raiz) {
    let arrastando = null;
    raiz.querySelectorAll(".cartao[draggable]").forEach(c => {
      c.addEventListener("dragstart", (e) => { arrastando = Number(c.dataset.lead); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(arrastando)); });
      c.addEventListener("dragend", () => { arrastando = null; raiz.querySelectorAll(".alvo").forEach(x => x.classList.remove("alvo")); });
    });
    raiz.querySelectorAll("[data-coluna]").forEach(col => {
      col.addEventListener("dragover", (e) => { if (arrastando) { e.preventDefault(); col.classList.add("alvo"); } });
      col.addEventListener("dragleave", () => col.classList.remove("alvo"));
      col.addEventListener("drop", (e) => {
        e.preventDefault(); col.classList.remove("alvo");
        const id = Number(e.dataTransfer.getData("text/plain"));
        const l = E.leads.find(x => x.id === id);
        if (l && l.status !== col.dataset.coluna) salvarStatus(id, col.dataset.coluna);
      });
    });
  }

  async function salvarStatus(id, status) {
    const l = E.leads.find(x => x.id === id);
    try {
      const novo = await API.atualizarLead(id, { status, data_contato: l.data_contato || (status !== "Novo" ? hojeISO() : null) });
      Object.assign(l, novo);
      await aposMudarLead(`${l.empresa}: ${status}.`);
    } catch (e) { aviso(API.traduzir(e), true); desenhar(); }
  }

  async function aposMudarLead(msg) {
    const antes = !ehTime() && podePedir();
    E.pedidos = await API.pedidos();
    desenhar();
    if (!ehTime() && !antes && podePedir()) aviso("Todos os leads finalizados. Você já pode pedir uma nova base.");
    else aviso(msg);
  }

  function janelaLead(id) {
    const l = E.leads.find(x => x.id === id);
    if (!l) return;
    const p = pedidoDe(l);
    const telZap = zap(l.telefone, `Olá! Aqui é ${E.perfil.nome}, da Azul Logística (loja ${l.sigla}).`);
    abrir(`
      <div class="janela-topo"><div><h2>${esc(l.empresa)}</h2><p>Loja ${esc(l.sigla)}${p.id ? `, pedido ${p.id} de ${data(p.criada_em)}` : ""}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <dl class="dados">
          ${[["CNPJ", l.cnpj], ["Segmento", l.segmento], ["Cidade/UF", l.cidade_uf], ["Contato", l.contato], ["Telefone", l.telefone], ["E-mail", l.email]]
            .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}
        </dl>
        <div class="contatos">
          ${telZap ? `<a class="btn btn-zap btn-p" href="${esc(telZap)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${l.telefone ? `<a class="btn btn-p" href="tel:+${fone(l.telefone)}">Ligar</a>` : ""}
          ${l.email ? `<a class="btn btn-p" href="mailto:${esc(l.email)}">Enviar e-mail</a>` : ""}
        </div>
        <form id="f-lead">
          <div class="grade-2">
            <div class="campo"><label for="l-status">Status</label><select id="l-status">${opcoes(STATUS.map(s => s.nome), l.status)}</select></div>
            <div class="campo"><label for="l-data">Data do contato</label><input id="l-data" type="date" value="${esc(l.data_contato || "")}"></div>
          </div>
          <div class="campo"><label for="l-obs">Observação</label><textarea id="l-obs" placeholder="Ex.: pediu proposta, retornar na sexta">${esc(l.observacao || "")}</textarea></div>
        </form>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="l-salvar">Salvar</button></div>`,
    (j) => {
      const st = j.querySelector("#l-status"), dt = j.querySelector("#l-data");
      st.addEventListener("change", () => { if (!dt.value && st.value !== "Novo") dt.value = hojeISO(); });
      j.querySelector("#l-salvar").addEventListener("click", async (ev) => {
        try {
          const novo = await ocupado(ev.currentTarget, () => API.atualizarLead(id, { status: st.value, data_contato: dt.value || null, observacao: j.querySelector("#l-obs").value.trim() || null }));
          Object.assign(l, novo); fechar();
          await aposMudarLead("Lead salvo.");
        } catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }

  // ------------------------------------------------------------------
  // Representante: meus leads
  // ------------------------------------------------------------------
  const emAndamento = () => E.pedidos.find(p => ["Nova", "Em extração"].includes(p.situacao));
  const abertosLoja = () => E.leads.filter(l => !final(l));
  const podePedir = () => !emAndamento() && abertosLoja().length === 0;
  function ultimaBase() {
    const comLeads = E.pedidos.filter(p => E.leads.some(l => l.solicitacao_id === p.id));
    return comLeads.sort((a, b) => b.id - a.id)[0];
  }

  function faixaBase() {
    const andamento = emAndamento();
    const base = ultimaBase();
    const doBase = base ? E.leads.filter(l => l.solicitacao_id === base.id) : [];
    const finalizados = doBase.filter(final).length;
    const abertos = abertosLoja().length;

    if (!base && !andamento) {
      return `<div class="vazio"><h2>Você ainda não tem leads</h2><p>Peça sua primeira base escolhendo os segmentos fortes na região da sua loja.</p><button class="btn btn-primario" data-acao="novoPedido">Pedir leads</button></div>`;
    }
    let titulo, texto, acao = "";
    if (andamento && !abertos) {
      titulo = "Seu pedido está com o time";
      texto = `Pedido de ${data(andamento.criada_em)} (${esc(segmentosDe(andamento))}): ${andamento.situacao === "Nova" ? "aguardando o time" : "em extração"}. Os leads aparecem aqui quando forem enviados.`;
    } else if (abertos) {
      titulo = `Base atual: ${finalizados} de ${doBase.length} leads finalizados`;
      texto = `Faltam ${abertos} lead${abertos > 1 ? "s" : ""} com status final (Fechou, Sem interesse ou Contato inválido) para liberar uma nova base.`;
      acao = `<button class="btn" disabled title="Finalize todos os leads para pedir uma nova base">Pedir nova base</button>`;
    } else {
      titulo = `Base atual: ${finalizados} de ${doBase.length} leads finalizados`;
      texto = `<span class="liberado">Todos os leads finalizados.</span> Você já pode pedir uma nova base.`;
      acao = `<button class="btn btn-primario" data-acao="novoPedido">Pedir nova base</button>`;
    }
    const trilha = doBase.length ? `<div class="trilha" aria-hidden="true">${doBase.slice().sort((a, b) => final(b) - final(a)).map(l =>
      final(l) ? `<span class="fim" style="background:${COR[l.status]}" title="${esc(l.status)}"></span>` : `<span title="${esc(l.status)}" style="border-color:${COR[l.status]}"></span>`).join("")}</div>` : "";
    return `<section class="base">${icone("aviao")}<div><h2>${titulo}</h2><p>${texto}</p>${trilha}</div><div>${acao}</div></section>`;
  }

  function telaLeadsRep() {
    const base = ultimaBase();
    let lista = E.leads;
    if (E.f.base === "atual" && base) lista = lista.filter(l => l.solicitacao_id === base.id);
    lista = filtrarLeads(lista);
    const temLeads = E.leads.length > 0;
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Meus leads</h1><p>Loja ${esc(E.perfil.sigla)}${E.perfil.cidade_uf ? ", " + esc(E.perfil.cidade_uf) : ""}</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      ${faixaBase()}
      ${temLeads ? `
        <div class="filtros">
          <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Empresa, CNPJ, contato ou telefone"></div>
          <div class="campo"><label for="f-base">Base</label><select id="f-base" data-filtro="base"><option value="atual"${E.f.base === "atual" ? " selected" : ""}>Base atual</option><option value="todas"${E.f.base === "todas" ? " selected" : ""}>Todas as bases</option></select></div>
          <div class="campo"><label for="f-status">Status</label><select id="f-status" data-filtro="status">${opcoes(STATUS.map(s => s.nome), E.f.status, "Todos")}</select></div>
          ${seletorVista()}
        </div>
        ${E.vista === "kanban" ? quadro(lista) : tabelaLeads(lista)}` : ""}`;
  }

  // ------------------------------------------------------------------
  // Representante: pedidos
  // ------------------------------------------------------------------
  function contagem(p) {
    const ls = E.leads.filter(l => l.solicitacao_id === p.id);
    return ls.length ? `${ls.filter(final).length} de ${ls.length}` : "–";
  }

  function telaPedidosRep() {
    const pode = podePedir();
    const motivo = emAndamento() ? "Você já tem um pedido em andamento." : abertosLoja().length ? `Finalize os ${abertosLoja().length} leads em aberto para pedir uma nova base.` : "";
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Meus pedidos</h1><p>${pode ? "Você pode pedir uma nova base agora." : esc(motivo)}</p></div>
        <div class="acoes"><button class="btn btn-primario" data-acao="novoPedido"${pode ? "" : " disabled"}>Pedir nova base</button></div></div>
      ${E.pedidos.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Pedido</th><th>Data</th><th>Segmentos</th><th>Empresas indicadas</th><th>Situação</th><th>Leads finalizados</th></tr></thead>
        <tbody>${E.pedidos.map(p => `<tr>
          <td>${p.id}</td><td>${data(p.criada_em)}</td><td>${esc(segmentosDe(p))}</td><td class="sec">${esc(p.empresas || "")}</td>
          <td>${chipSituacao(p.situacao)}${p.observacao_time ? `<div class="sec">${esc(p.observacao_time)}</div>` : ""}</td><td>${contagem(p)}</td></tr>`).join("")}</tbody>
      </table></div>` : `<div class="vazio"><h2>Nenhum pedido ainda</h2><p>Seu primeiro pedido aparece aqui com a situação de cada etapa.</p></div>`}`;
  }

  function janelaNovoPedido() {
    if (!podePedir()) { aviso(emAndamento() ? "Você já tem um pedido em andamento." : "Finalize todos os leads para pedir uma nova base.", true); return; }
    const p = E.perfil;
    abrir(`
      <div class="janela-topo"><div><h2>Pedir nova base de leads</h2><p>Loja ${esc(p.sigla)}, ${esc(p.cidade_uf || "")}, ${esc(p.regiao || "")}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="p-s1">Segmento principal</label><select id="p-s1" required>${opcoes(L.segmentos, "", "Escolha o segmento mais forte na sua região")}</select></div>
        <div class="campo"><label for="p-s2">Segundo segmento (opcional)</label><select id="p-s2">${opcoes(L.segmentos, "", "Nenhum")}</select></div>
        <div class="campo"><label for="p-s3">Terceiro segmento (opcional)</label><select id="p-s3">${opcoes(L.segmentos, "", "Nenhum")}</select></div>
        <div class="campo"><label for="p-emp">Empresas específicas (opcional)</label><textarea id="p-emp" placeholder="Informe o CNPJ ou o CNAE das empresas, um por linha"></textarea></div>
        <div class="erro-form" id="p-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="p-enviar">Enviar pedido</button></div>`,
    (j) => {
      j.querySelector("#p-enviar").addEventListener("click", async (ev) => {
        const s = ["#p-s1", "#p-s2", "#p-s3"].map(x => j.querySelector(x).value).filter(Boolean);
        const erro = j.querySelector("#p-erro");
        if (!j.querySelector("#p-s1").value) { erro.textContent = "Escolha o segmento principal."; erro.hidden = false; return; }
        if (new Set(s).size !== s.length) { erro.textContent = "Escolha segmentos diferentes."; erro.hidden = false; return; }
        try {
          await ocupado(ev.currentTarget, () => API.criarPedido({ sigla: p.sigla, segmento_1: s[0], segmento_2: s[1] || null, segmento_3: s[2] || null, empresas: j.querySelector("#p-emp").value.trim() || null }));
          fechar(); await recarregar();
          aviso("Pedido enviado. O time de Inside Sales vai preparar sua base.");
        } catch (e) { erro.textContent = API.traduzir(e); erro.hidden = false; }
      });
    });
  }

  // ------------------------------------------------------------------
  // Time: pedidos
  // ------------------------------------------------------------------
  const perfilDe = (id) => E.perfis.find(p => p.id === id) || {};

  function telaPedidosTime() {
    const b = norm(E.f.busca);
    const lista = E.pedidos.filter(p => {
      if (E.f.situacao === "abertos" && !["Nova", "Em extração"].includes(p.situacao)) return false;
      if (E.f.situacao && E.f.situacao !== "abertos" && p.situacao !== E.f.situacao) return false;
      if (E.f.regiao && p.regiao !== E.f.regiao) return false;
      if (b && !norm([p.sigla, p.solicitante_nome, p.cidade_uf, segmentosDe(p), p.empresas, p.responsavel].join(" ")).includes(b)) return false;
      return true;
    });
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Pedidos</h1><p>Pedidos de leads feitos pelas lojas.</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      <div class="filtros">
        <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Loja, representante, segmento ou responsável"></div>
        <div class="campo"><label for="f-sit">Situação</label><select id="f-sit" data-filtro="situacao"><option value="abertos"${E.f.situacao === "abertos" ? " selected" : ""}>Aguardando o time</option><option value=""${!E.f.situacao ? " selected" : ""}>Todas</option>${opcoes(L.situacoesPedido, E.f.situacao)}</select></div>
        <div class="campo"><label for="f-reg">Região</label><select id="f-reg" data-filtro="regiao">${opcoes(L.regioes, E.f.regiao, "Todas")}</select></div>
      </div>
      ${lista.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Pedido</th><th>Data</th><th>Loja</th><th>Representante</th><th>Região</th><th>Segmentos</th><th>Situação</th><th>Responsável</th><th>Leads finalizados</th></tr></thead>
        <tbody>${lista.map(p => `<tr class="clicavel" data-pedido="${p.id}">
          <td>${p.id}</td><td>${data(p.criada_em)}<div class="sec">${dias(p.criada_em) ? "há " + dias(p.criada_em) + " dia(s)" : "hoje"}</div></td>
          <td><b>${esc(p.sigla)}</b><div class="sec">${esc(p.cidade_uf)}</div></td>
          <td>${esc(p.solicitante_nome)}<div class="sec">${esc(perfilDe(p.solicitante).celular || "")}</div></td>
          <td>${esc(p.regiao)}</td><td>${esc(segmentosDe(p))}${p.empresas ? `<div class="sec">Empresas: ${esc(p.empresas.slice(0, 60))}</div>` : ""}</td>
          <td>${chipSituacao(p.situacao)}</td><td>${esc(p.responsavel || "–")}</td><td>${contagem(p)}</td></tr>`).join("")}</tbody>
      </table></div>` : `<div class="vazio"><h2>Nenhum pedido aguardando</h2><p>Quando uma loja pedir leads, o pedido aparece aqui. Mude a situação para ver os anteriores.</p></div>`}`;
  }

  function mensagemPedido(p, tipo) {
    const nome = (p.solicitante_nome || "").split(" ")[0];
    const ls = E.leads.filter(l => l.solicitacao_id === p.id);
    const abertos = ls.filter(l => !final(l)).length;
    if (tipo === "enviada") return `Olá, ${nome}! Os leads de ${segmentosDe(p)} da loja ${p.sigla} já estão no Portal de Leads: ${urlPortal()}\nAtualize o status de cada contato por lá. Quando todos estiverem finalizados, você pode pedir uma nova base.`;
    if (tipo === "cobrar") return `Olá, ${nome}! A loja ${p.sigla} tem ${abertos} lead(s) sem status final no Portal de Leads: ${urlPortal()}\nAtualize os contatos para liberar uma nova base.`;
    if (tipo === "sem") return `Olá, ${nome}! Não encontramos leads de ${segmentosDe(p)} para ${p.cidade_uf}. Faça um novo pedido no portal com outros segmentos ou com o CNPJ/CNAE das empresas: ${urlPortal()}`;
    return `Olá, ${nome}! Recebemos o pedido de leads da loja ${p.sigla} (${segmentosDe(p)}) e já estamos preparando a base.`;
  }

  function janelaPedidoTime(id) {
    const p = E.pedidos.find(x => x.id === id);
    if (!p) return;
    const rep = perfilDe(p.solicitante);
    const ls = E.leads.filter(l => l.solicitacao_id === p.id);
    const tipoMsg = p.situacao === "Enviada" ? (ls.some(l => !final(l)) ? "cobrar" : "enviada") : p.situacao === "Sem leads" ? "sem" : "recebido";
    const linkZap = zap(rep.celular, mensagemPedido(p, tipoMsg));
    const rotuloZap = { cobrar: "Cobrar retorno no WhatsApp", enviada: "Avisar no WhatsApp", sem: "Avisar no WhatsApp", recebido: "Avisar que recebemos" }[tipoMsg];
    abrir(`
      <div class="janela-topo"><div><h2>Pedido ${p.id} · loja ${esc(p.sigla)}</h2><p>${data(p.criada_em)}, ${esc(p.solicitante_nome || "")}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <dl class="dados">
          <dt>Situação</dt><dd>${chipSituacao(p.situacao)}</dd>
          <dt>Segmentos</dt><dd>${esc(segmentosDe(p))}</dd>
          ${p.empresas ? `<dt>Empresas (CNPJ/CNAE)</dt><dd style="white-space:pre-line">${esc(p.empresas)}</dd>` : ""}
          <dt>Cidade e região</dt><dd>${esc(p.cidade_uf)}, ${esc(p.regiao)}</dd>
          <dt>Representante</dt><dd>${esc(p.solicitante_nome)}<br><span class="sec">${esc(rep.email || "")} ${esc(rep.celular || "")}</span></dd>
          <dt>Leads</dt><dd>${ls.length ? `${ls.length} enviados, ${ls.filter(final).length} finalizados` : "Nenhum lead enviado"}${p.enviada_em ? ` (enviados em ${data(p.enviada_em)})` : ""}</dd>
        </dl>
        <div class="contatos">
          ${linkZap ? `<a class="btn btn-zap btn-p" href="${esc(linkZap)}" target="_blank" rel="noopener">${rotuloZap}</a>` : ""}
          <button class="btn btn-p btn-primario" id="pt-importar">${ls.length ? "Importar mais leads" : "Importar leads"}</button>
          ${p.situacao === "Nova" ? `<button class="btn btn-p" id="pt-assumir">Assumir pedido</button>` : ""}
        </div>
        <div class="grade-2">
          <div class="campo"><label for="pt-sit">Situação</label><select id="pt-sit">${opcoes(L.situacoesPedido, p.situacao)}</select></div>
          <div class="campo"><label for="pt-resp">Responsável</label><input id="pt-resp" type="text" value="${esc(p.responsavel || "")}" placeholder="${esc(E.perfil.nome)}"></div>
        </div>
        <div class="campo"><label for="pt-obs">Observação para a loja</label><textarea id="pt-obs" placeholder="Aparece para o representante em Meus pedidos">${esc(p.observacao_time || "")}</textarea></div>
        ${ls.length ? `<button class="btn btn-p btn-perigo" id="pt-apagar">Apagar os ${ls.length} leads deste pedido</button>` : ""}
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button><button class="btn btn-primario" id="pt-salvar">Salvar</button></div>`,
    (j) => {
      const salvar = async (dados, msg, botao) => {
        try { await ocupado(botao, () => API.atualizarPedido(p.id, dados)); await recarregar(); aviso(msg); janelaPedidoTime(p.id); }
        catch (e) { aviso(API.traduzir(e), true); }
      };
      j.querySelector("#pt-salvar").addEventListener("click", (ev) => {
        const sit = j.querySelector("#pt-sit").value;
        const dados = { situacao: sit, responsavel: j.querySelector("#pt-resp").value.trim() || null, observacao_time: j.querySelector("#pt-obs").value.trim() || null };
        if (sit === "Enviada" && !p.enviada_em) dados.enviada_em = new Date().toISOString();
        if (sit === "Enviada" && !ls.length) { aviso("Importe os leads antes de marcar como Enviada.", true); return; }
        salvar(dados, "Pedido salvo.", ev.currentTarget);
      });
      const assumir = j.querySelector("#pt-assumir");
      if (assumir) assumir.addEventListener("click", (ev) => salvar({ situacao: "Em extração", responsavel: p.responsavel || E.perfil.nome }, "Pedido assumido.", ev.currentTarget));
      j.querySelector("#pt-importar").addEventListener("click", () => janelaImportar(p.id));
      const apagar = j.querySelector("#pt-apagar");
      if (apagar) apagar.addEventListener("click", async (ev) => {
        if (!confirm(`Apagar os ${ls.length} leads do pedido ${p.id}? Os status preenchidos pela loja também serão apagados.`)) return;
        try { await ocupado(ev.currentTarget, () => API.apagarLeadsDoPedido(p.id)); await recarregar(); aviso("Leads apagados."); janelaPedidoTime(p.id); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }

  // ------------------------------------------------------------------
  // Time: importar a planilha da Leads2b
  // ------------------------------------------------------------------
  const CAMPOS = [
    ["empresa", "Empresa", ["razao social", "empresa", "nome fantasia", "nome da empresa", "nome"]],
    ["cnpj", "CNPJ", ["cnpj", "cpf/cnpj", "documento"]],
    ["segmento", "Segmento", ["segmento", "descricao cnae", "atividade", "ramo", "cnae"]],
    ["cidade", "Cidade", ["cidade/uf", "cidade", "municipio"]],
    ["uf", "UF", ["uf", "estado"]],
    ["contato", "Contato", ["contato", "nome do contato", "decisor", "socio", "responsavel"]],
    ["telefone", "Telefone", ["telefone", "celular", "whatsapp", "fone", "telefone 1"]],
    ["email", "E-mail", ["e-mail", "email"]]
  ];

  function adivinhar(cabecalho) {
    const h = cabecalho.map(norm);
    const usado = new Set(), mapa = {};
    CAMPOS.forEach(([campo, , nomes]) => {
      let i = -1;
      for (const n of nomes) { i = h.findIndex((x, k) => !usado.has(k) && x === n); if (i >= 0) break; }
      if (i < 0) for (const n of nomes) { i = h.findIndex((x, k) => !usado.has(k) && x.includes(n)); if (i >= 0) break; }
      if (i >= 0) { usado.add(i); mapa[campo] = i; }
    });
    return mapa;
  }

  function janelaImportar(pedidoId) {
    const p = E.pedidos.find(x => x.id === pedidoId);
    let linhas = [], cab = [], mapa = {};
    const desenharImport = (j) => {
      const corpo = j.querySelector("#imp-mapa");
      if (!cab.length) { corpo.innerHTML = ""; return; }
      const montar = () => linhas.map(r => {
        const v = (c) => mapa[c] >= 0 ? String(r[mapa[c]] == null ? "" : r[mapa[c]]).trim() : "";
        const cidade = v("cidade"), uf = v("uf");
        return { solicitacao_id: p.id, empresa: v("empresa"), cnpj: v("cnpj") || null, segmento: v("segmento") || null,
          cidade_uf: [cidade, uf && !cidade.includes("/") ? uf : ""].filter(Boolean).join("/") || null,
          contato: v("contato") || null, telefone: v("telefone") || null, email: v("email") || null };
      }).filter(x => x.empresa);
      const prontos = montar();
      corpo.innerHTML = `
        <p class="sub" style="margin:0 0 10px">Confira qual coluna da planilha vai para cada campo.</p>
        <div class="mapa">${CAMPOS.map(([c, rot]) => `<div class="campo"><label for="m-${c}">${rot}${c === "empresa" ? " (obrigatório)" : ""}</label>
          <select id="m-${c}" data-mapa="${c}"><option value="-1">Não usar</option>${cab.map((h, i) => `<option value="${i}"${mapa[c] === i ? " selected" : ""}>${esc(h || "Coluna " + (i + 1))}</option>`).join("")}</select></div>`).join("")}</div>
        <p style="margin:6px 0 8px"><b>${prontos.length}</b> leads prontos para enviar à loja ${esc(p.sigla)}${linhas.length - prontos.length ? ` (${linhas.length - prontos.length} linhas sem nome de empresa serão ignoradas)` : ""}.</p>
        <div class="tabela-wrap"><table class="previa"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Cidade/UF</th><th>Telefone</th></tr></thead>
          <tbody>${prontos.slice(0, 5).map(x => `<tr><td>${esc(x.empresa)}</td><td>${esc(x.cnpj)}</td><td>${esc(x.cidade_uf)}</td><td>${esc(x.telefone)}</td></tr>`).join("")}</tbody></table></div>`;
      corpo.querySelectorAll("[data-mapa]").forEach(s => s.addEventListener("change", () => { mapa[s.dataset.mapa] = Number(s.value); desenharImport(j); }));
      const enviar = j.querySelector("#imp-enviar");
      enviar.disabled = !prontos.length;
      enviar.textContent = prontos.length ? `Enviar ${prontos.length} leads para a loja ${p.sigla}` : "Enviar leads";
      enviar.onclick = async (ev) => {
        try {
          await ocupado(ev.currentTarget, async () => {
            await API.incluirLeads(prontos);
            await API.atualizarPedido(p.id, { situacao: "Enviada", enviada_em: p.enviada_em || new Date().toISOString(), responsavel: p.responsavel || E.perfil.nome });
          });
          await recarregar();
          const atualizado = E.pedidos.find(x => x.id === p.id);
          const link = zap(perfilDe(p.solicitante).celular, mensagemPedido(atualizado, "enviada"));
          abrir(`<div class="janela-topo"><div><h2>Leads enviados</h2><p>${prontos.length} leads já aparecem para a loja ${esc(p.sigla)}.</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
            <div class="janela-corpo"><p>Avise o representante para ele começar os contatos.</p></div>
            <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button>${link ? `<a class="btn btn-zap" href="${esc(link)}" target="_blank" rel="noopener">Avisar no WhatsApp</a>` : ""}</div>`);
        } catch (e) { aviso(API.traduzir(e), true); }
      };
    };

    abrir(`
      <div class="janela-topo"><div><h2>Importar leads · pedido ${p.id}</h2><p>Loja ${esc(p.sigla)}, ${esc(segmentosDe(p))}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="imp-arq">Planilha exportada da Leads2b</label><input id="imp-arq" type="file" accept=".xlsx,.xls,.csv"><span class="dica">Excel ou CSV. A primeira linha precisa ter os nomes das colunas.</span></div>
        <div id="imp-mapa"></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="imp-enviar" disabled>Enviar leads</button></div>`,
    (j) => {
      j.querySelector("#imp-arq").addEventListener("change", async (ev) => {
        const arq = ev.target.files[0];
        if (!arq) return;
        if (!window.XLSX) { aviso("A leitura de planilhas não carregou. Recarregue a página e tente de novo.", true); return; }
        try {
          const wb = XLSX.read(await arq.arrayBuffer(), { type: "array" });
          const matriz = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
          const inicio = matriz.findIndex(r => r.some(c => String(c).trim()));
          if (inicio < 0) throw new Error("A planilha está vazia.");
          cab = matriz[inicio].map(c => String(c).trim());
          linhas = matriz.slice(inicio + 1).filter(r => r.some(c => String(c).trim()));
          mapa = adivinhar(cab);
          desenharImport(j);
        } catch (e) { aviso("Não foi possível ler a planilha: " + API.traduzir(e), true); }
      });
    });
  }

  // ------------------------------------------------------------------
  // Time: todos os leads
  // ------------------------------------------------------------------
  function telaLeadsTime() {
    const lista = filtrarLeads(E.leads);
    const lojas = [...new Set(E.leads.map(l => l.sigla))].sort();
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Leads</h1><p>${E.leads.length} leads enviados para ${lojas.length} loja(s).</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button><button class="btn" data-acao="exportar">Exportar Excel</button></div></div>
      <div class="filtros">
        <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Empresa, CNPJ, contato ou telefone"></div>
        <div class="campo"><label for="f-reg">Região</label><select id="f-reg" data-filtro="regiao">${opcoes(L.regioes, E.f.regiao, "Todas")}</select></div>
        <div class="campo"><label for="f-loja">Loja</label><select id="f-loja" data-filtro="loja">${opcoes(lojas, E.f.loja, "Todas")}</select></div>
        <div class="campo"><label for="f-status">Status</label><select id="f-status" data-filtro="status">${opcoes(STATUS.map(s => s.nome), E.f.status, "Todos")}</select></div>
        ${seletorVista()}
      </div>
      ${E.leads.length ? (E.vista === "kanban" ? quadro(lista) : tabelaLeads(lista)) : `<div class="vazio"><h2>Nenhum lead enviado ainda</h2><p>Abra um pedido e importe a planilha da Leads2b para enviar os leads à loja.</p><button class="btn btn-primario" data-acao="irPedidos">Ver pedidos</button></div>`}`;
  }

  function exportarLeads() {
    if (!window.XLSX) { aviso("A exportação não carregou. Recarregue a página e tente de novo.", true); return; }
    const linhas = filtrarLeads(E.leads).map(l => {
      const p = pedidoDe(l);
      return { "Pedido": l.solicitacao_id, "Loja": l.sigla, "Região": p.regiao || "", "Representante": p.solicitante_nome || "", "Empresa": l.empresa, "CNPJ": l.cnpj || "",
        "Segmento": l.segmento || "", "Cidade/UF": l.cidade_uf || "", "Contato": l.contato || "", "Telefone": l.telefone || "", "E-mail": l.email || "",
        "Status": l.status, "Data do contato": data(l.data_contato), "Observação": l.observacao || "", "Atualizado em": data(l.atualizado_em) };
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-${hojeISO()}.xlsx`);
  }

  // ------------------------------------------------------------------
  // Time: cadastros
  // ------------------------------------------------------------------
  function telaCadastros() {
    const b = norm(E.f.busca);
    const contar = (s) => E.perfis.filter(p => p.situacao === s).length;
    const lista = E.perfis.filter(p => p.situacao === E.f.cadastro && (!b || norm([p.nome, p.email, p.sigla, p.cidade_uf].join(" ")).includes(b)));
    const msg = (p) => p.situacao === "aprovado"
      ? `Olá, ${p.nome.split(" ")[0]}! Seu acesso ao Portal de Leads foi liberado. Entre em ${urlPortal()} com seu e-mail e a senha que você criou.`
      : CONFIRMA && p.email_confirmado === false
        ? `Olá, ${p.nome.split(" ")[0]}! Recebemos seu cadastro no Portal de Leads. Falta confirmar seu e-mail: abra a mensagem do Portal de Leads (veja também o lixo eletrônico) e clique em "Confirmar meu e-mail".`
        : `Olá, ${p.nome.split(" ")[0]}! Recebemos seu cadastro no Portal de Leads.`;
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Cadastros</h1><p>Confira se o e-mail e a sigla batem com a loja antes de aprovar.</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      <div class="filtros">
        <div class="pilulas" role="group" aria-label="Situação do cadastro">
          ${[["pendente", "Aguardando"], ["aprovado", "Aprovados"], ["recusado", "Recusados"]].map(([v, r]) => `<button data-pilula="cadastro" data-valor="${v}" aria-pressed="${E.f.cadastro === v}">${r} (${contar(v)})</button>`).join("")}
        </div>
        <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Nome, e-mail ou loja"></div>
      </div>
      ${lista.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Nome</th><th>Loja</th><th>Região</th><th>Celular</th><th>Acesso</th><th>Cadastro</th><th>Ações</th></tr></thead>
        <tbody>${lista.map(p => {
          const eu = p.id === E.perfil.id;
          const link = zap(p.celular, msg(p));
          return `<tr>
            <td><b>${esc(p.nome)}</b><div class="sec">${esc(p.email)}</div>${CONFIRMA && p.situacao === "pendente" ? (p.email_confirmado === false ? `<span class="selo selo-alerta">E-mail não confirmado</span>` : `<span class="selo selo-ok">E-mail confirmado</span>`) : ""}</td>
            <td>${esc(p.sigla)}<div class="sec">${esc(p.cidade_uf || "")}</div></td>
            <td>${esc(p.regiao || "")}</td><td>${esc(p.celular || "")}</td>
            <td>${p.papel === "time" ? "Time" : "Representante"}</td><td>${data(p.criado_em)}</td>
            <td><div class="acoes">
              ${p.situacao !== "aprovado" ? `<button class="btn btn-p btn-primario" data-acao="aprovar" data-id="${p.id}"${CONFIRMA && p.email_confirmado === false ? ' disabled title="Aprove depois que a pessoa confirmar o e-mail"' : ""}>Aprovar</button>` : ""}
              ${p.situacao !== "recusado" && !eu ? `<button class="btn btn-p btn-perigo" data-acao="recusar" data-id="${p.id}">${p.situacao === "aprovado" ? "Bloquear" : "Recusar"}</button>` : ""}
              ${p.situacao === "aprovado" && !eu ? (p.papel === "time" ? `<button class="btn btn-p" data-acao="tornarRep" data-id="${p.id}">Tornar representante</button>` : `<button class="btn btn-p" data-acao="tornarTime" data-id="${p.id}">Tornar time</button>`) : ""}
              ${p.situacao === "aprovado" && !eu ? `<button class="btn btn-p" data-acao="senha" data-id="${p.id}">Redefinir senha</button>` : ""}
              ${link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            </div></td></tr>`;
        }).join("")}</tbody></table></div>`
      : `<div class="vazio"><h2>${E.f.cadastro === "pendente" ? "Nenhum cadastro aguardando" : "Nenhum cadastro aqui"}</h2><p>${E.f.cadastro === "pendente" ? "Quando um representante criar o acesso, ele aparece aqui para aprovação." : "Mude a aba para ver os outros cadastros."}</p></div>`}`;
  }

  async function mudarCadastro(id, dados, msg) {
    try { await API.atualizarPerfil(id, dados); E.perfis = await API.perfis(); desenhar(); aviso(msg); }
    catch (e) { aviso(API.traduzir(e), true); }
  }

  function janelaSenha(id) {
    const p = E.perfis.find(x => x.id === id);
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const senha = "Leads-" + Math.floor(1000 + Math.random() * 9000) + letras[Math.floor(Math.random() * letras.length)] + letras[Math.floor(Math.random() * letras.length)];
    abrir(`
      <div class="janela-topo"><div><h2>Redefinir senha</h2><p>${esc(p.nome)}, loja ${esc(p.sigla)}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo"><p>A senha atual deixa de funcionar. A pessoa entra com a senha temporária abaixo e troca em Minha conta.</p><div class="senha-temp">${esc(senha)}</div></div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="s-ok">Definir senha temporária</button></div>`,
    (j) => {
      j.querySelector("#s-ok").addEventListener("click", async (ev) => {
        try {
          await ocupado(ev.currentTarget, () => API.redefinirSenha(id, senha));
          const link = zap(p.celular, `Olá, ${p.nome.split(" ")[0]}! Sua senha temporária do Portal de Leads é ${senha}\nEntre em ${urlPortal()} e troque a senha em Minha conta.`);
          j.querySelector(".janela-rodape").innerHTML = `<button class="btn" data-fechar>Fechar</button>${link ? `<a class="btn btn-zap" href="${esc(link)}" target="_blank" rel="noopener">Enviar no WhatsApp</a>` : ""}`;
          j.querySelector(".janela-rodape [data-fechar]").addEventListener("click", fechar);
          aviso("Senha temporária definida.");
        } catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }

  // ------------------------------------------------------------------
  // Time: painel
  // ------------------------------------------------------------------
  function barras(itens, total) {
    const max = Math.max(1, ...itens.map(i => i[1]));
    return itens.map(([rot, n, cor]) => `<div class="barra-linha"><span>${esc(rot)}</span><span class="trilho"><i style="width:${(n / max) * 100}%;background:${cor || "var(--blue)"}"></i></span><span class="num">${n}</span></div>`).join("")
      + (total !== undefined ? "" : "");
  }

  function telaPainel() {
    const reg = E.f.regiao;
    const pedidos = E.pedidos.filter(p => !reg || p.regiao === reg);
    const ids = new Set(pedidos.map(p => p.id));
    const leads = E.leads.filter(l => ids.has(l.solicitacao_id));
    const aguardando = pedidos.filter(p => ["Nova", "Em extração"].includes(p.situacao)).length;
    const comRetorno = leads.filter(l => l.status !== "Novo").length;
    const parados = leads.filter(parado).length;
    const fechados = leads.filter(l => l.status === "Fechou").length;
    const pct = leads.length ? Math.round((comRetorno / leads.length) * 100) : 0;

    const porLoja = {};
    leads.forEach(l => {
      const k = l.sigla, p = pedidoDe(l);
      porLoja[k] = porLoja[k] || { sigla: k, regiao: p.regiao, rep: p.solicitante_nome, total: 0, fin: 0, par: 0, fech: 0, ret: 0 };
      const o = porLoja[k]; o.total++; if (final(l)) o.fin++; if (parado(l)) o.par++; if (l.status === "Fechou") o.fech++; if (l.status !== "Novo") o.ret++;
    });
    const lojas = Object.values(porLoja).sort((a, b) => b.par - a.par || (b.total - b.fin) - (a.total - a.fin) || b.total - a.total);

    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Painel</h1><p>Retorno das lojas sobre os leads enviados.</p></div>
        <div class="acoes"><div class="campo" style="margin:0;min-width:180px"><select aria-label="Região" data-filtro="regiao">${opcoes(L.regioes, reg, "Todas as regiões")}</select></div><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      <div class="indicadores">
        <div class="indicador">${icone("pedido")}<div class="valor">${aguardando}</div><div class="rotulo">Pedidos aguardando o time</div></div>
        <div class="indicador">${icone("leads")}<div class="valor">${leads.length}</div><div class="rotulo">Leads enviados</div></div>
        <div class="indicador">${icone("retorno")}<div class="valor">${pct}%</div><div class="rotulo">Leads com retorno da loja</div></div>
        <div class="indicador${parados ? " atencao" : ""}">${icone("alerta")}<div class="valor">${parados}</div><div class="rotulo">Leads parados há mais de ${PRAZO} dias</div></div>
        <div class="indicador">${icone("fechado")}<div class="valor">${fechados}</div><div class="rotulo">Clientes fechados</div></div>
      </div>
      <div class="paineis">
        <section class="bloco"><h2>Leads por status</h2>${barras(STATUS.map(s => [s.nome, leads.filter(l => l.status === s.nome).length, s.cor]))}</section>
        <section class="bloco"><h2>Pedidos por região</h2>${barras(L.regioes.map(r => [r, E.pedidos.filter(p => p.regiao === r && (!reg || r === reg)).length]))}</section>
      </div>
      <section class="bloco" style="padding:0;overflow:hidden">
        <h2 style="padding:18px 20px 0">Por loja</h2>
        ${lojas.length ? `<div class="tabela-wrap" style="border:0;border-radius:0"><table>
          <thead><tr><th>Loja</th><th>Região</th><th>Representante</th><th>Leads</th><th>Finalizados</th><th>Parados</th><th>Fechados</th><th>Com retorno</th></tr></thead>
          <tbody>${lojas.map(o => `<tr><td><b>${esc(o.sigla)}</b></td><td>${esc(o.regiao || "")}</td><td>${esc(o.rep || "")}</td><td>${o.total}</td><td>${o.fin}</td>
            <td${o.par ? ' style="color:var(--danger);font-weight:600"' : ""}>${o.par}</td><td>${o.fech}</td><td>${Math.round((o.ret / o.total) * 100)}%</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="sub" style="padding:0 20px 18px;color:var(--muted)">Nenhum lead enviado ainda.</p>`}
      </section>`;
  }

  // ------------------------------------------------------------------
  // Minha conta
  // ------------------------------------------------------------------
  function telaConta() {
    const p = E.perfil;
    setTimeout(() => {
      const f = document.getElementById("f-senha");
      if (!f) return;
      f.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const a = document.getElementById("n-senha").value, b = document.getElementById("n-senha2").value;
        if (a.length < 8) return aviso("A senha precisa ter pelo menos 8 caracteres.", true);
        if (a !== b) return aviso("As senhas não são iguais.", true);
        try { await ocupado(f.querySelector("button"), () => API.trocarSenha(a)); f.reset(); aviso("Senha alterada."); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Minha conta</h1><p>Para corrigir nome, loja ou celular, fale com o time de ${esc(cfg.nomeDoTime || "Inside Sales")}.</p></div></div>
      <div class="paineis">
        <section class="bloco"><h2>Meus dados</h2>
          <dl class="dados">
            <dt>Nome</dt><dd>${esc(p.nome)}</dd><dt>E-mail</dt><dd>${esc(p.email)}</dd><dt>Celular</dt><dd>${esc(p.celular || "")}</dd>
            <dt>Loja</dt><dd>${esc(p.sigla)}</dd><dt>Cidade/UF</dt><dd>${esc(p.cidade_uf || "")}</dd><dt>Região</dt><dd>${esc(p.regiao || "")}</dd>
            <dt>Acesso</dt><dd>${p.papel === "time" ? "Time de " + esc(cfg.nomeDoTime || "Inside Sales") : "Representante"}</dd>
          </dl></section>
        <section class="bloco"><h2>Trocar senha</h2>
          <form id="f-senha">
            <div class="campo"><label for="n-senha">Nova senha</label><input id="n-senha" type="password" autocomplete="new-password" minlength="8" required><span class="dica">Mínimo de 8 caracteres. Não use a senha da sua conta Azul.</span></div>
            <div class="campo"><label for="n-senha2">Repita a nova senha</label><input id="n-senha2" type="password" autocomplete="new-password" required></div>
            <button class="btn btn-primario" type="submit">Trocar senha</button>
          </form></section>
      </div>`;
  }

  iniciar();
})();
