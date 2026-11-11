// Portal de Leads · telas e regras de interface
(function () {
  const cfg = window.PORTAL_CONFIG || {};
  const L = window.LISTAS;
  const API = window.API;
  const STATUS = L.status;
  const NOMES_STATUS = STATUS.map(s => s.nome);
  const TRAVA = new Set(STATUS.filter(s => s.trava).map(s => s.nome));
  const COR = Object.fromEntries(STATUS.map(s => [s.nome, s.cor]));
  const DESC = Object.fromEntries(STATUS.map(s => [s.nome, s.desc]));
  const MAX = L.leadsPorPedido || 10;
  const MAX_UNID = L.unidadesPorPessoa || 5;
  const CARGOS = L.cargos || ["Representante", "Executivo", "Inside Sales"];
  const PRAZO = Number(cfg.prazoRetornoDias) || 7;
  const DIA = 86400000;
  const $app = document.getElementById("app");
  const $janela = document.getElementById("janela");

  const E = {
    perfil: null, perfis: [], acessos: [], unidades: [], pedidos: [], leads: [],
    u: null, tela: null, vista: window.innerWidth < 900 ? "lista" : "kanban",
    f: { busca: "", status: "", regiao: "", loja: "", base: "atual", situacao: "abertos", cadastro: "pendente" }
  };

  // ------------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------------
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const data = (v) => { if (!v) return ""; const d = new Date(String(v).length === 10 ? v + "T12:00:00" : v); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR"); };
  const dataHora = (v) => { if (!v) return ""; const d = new Date(v); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR") + ", " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  const sexta = (v) => v ? `sexta-feira, ${data(v)}` : "";
  const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const mesmoDia = (v) => v && new Date(v).toLocaleDateString("pt-BR") === new Date().toLocaleDateString("pt-BR");
  const dias = (v) => v ? Math.floor((Date.now() - new Date(v).getTime()) / DIA) : 0;
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const urlPortal = () => location.origin + location.pathname;
  const ehTime = () => E.perfil && E.perfil.papel === "time";
  const trava = (l) => TRAVA.has(l.status);
  const final = (l) => !trava(l);
  const parado = (l) => trava(l) && dias(l.atualizado_em) > PRAZO;
  const slug = (s) => norm(s).replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  const segmentosDe = (p) => (p.segmentos || []).join(", ");
  const cidadesDe = (p) => (p.cidades || []).join(", ");
  const primeiroNome = (n) => String(n || "").split(" ")[0];

  function fone(num) { const d = API.limparTelefone(num); return d ? "55" + d : ""; }
  function zap(num, texto) { const f = fone(num); return f ? `https://wa.me/${f}?text=${encodeURIComponent(texto)}` : ""; }
  function foneBonito(num) {
    const d = API.limparTelefone(num); if (!d) return String(num || "");
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
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
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'
  };
  const icone = (n) => `<span class="icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES[n]}</svg></span>`;
  const sobre = () => `${esc(TIME)} | ${esc(EMPRESA)}`;
  const ROTA = `<svg class="rota" viewBox="0 0 600 600" aria-hidden="true"><path d="M-40 520 C 160 420, 260 470, 360 300 S 560 120, 660 60" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/><path d="M-40 600 C 200 520, 330 560, 430 400 S 600 260, 680 210" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 12" stroke-linecap="round" opacity=".6"/><g transform="translate(372 286) rotate(-38) scale(1.6)" fill="currentColor" stroke="none"><path d="M2 13l8-1 5-8h2l-2 8 5 1 2-2h1l-1 3 1 3h-1l-2-2-5 1 2 8h-2l-5-8-8-1z" transform="translate(-12 -12)"/></g></svg>`;

  const chipSituacao = (s) => `<span class="situacao s-${slug(s)}">${esc(s)}</span>`;
  const ponto = (s) => `<span class="ponto" style="background:${COR[s] || "#999"}"></span>`;
  const chipStatus = (s) => `<span class="chip-status" style="--c:${COR[s] || "#999"}">${esc(s)}</span>`;

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

  // Unidade escolhida (representante)
  const minhasUnidades = () => (E.perfil && E.perfil.unidades || []).filter(u => u.acesso === "aprovado");
  const unidade = () => minhasUnidades().find(u => u.sigla === E.u) || minhasUnidades()[0] || null;
  // Executivo não tem loja: usa uma "carteira" própria (unidade com nome).
  function infoUnidade(sigla) { return (E.perfil && E.perfil.unidades || []).find(u => u.sigla === sigla) || E.unidades.find(u => u.sigla === sigla) || { sigla }; }
  const rotulo = (sigla) => infoUnidade(sigla).nome || sigla;
  const rotuloLongo = (sigla) => infoUnidade(sigla).nome || "Unidade " + sigla;
  function escolherUnidade(sigla) { E.u = sigla; try { localStorage.setItem("portal-unidade", sigla); } catch (e) { /* sem armazenamento */ } }

  // ------------------------------------------------------------------
  // Início
  // ------------------------------------------------------------------
  async function iniciar() {
    if (API.demo) document.getElementById("faixa-demo").hidden = false;
    try {
      const u = await API.sessao();
      if (!u) return telaAcesso("entrar");
      if (!u.verificado) return telaConfirmar(u.email, true);
      await API.conferirConfirmacao().catch(() => {});
      E.perfil = await API.meuPerfil();
      if (!E.perfil) return telaSemCadastro(u.email);
      if (E.perfil.situacao !== "aprovado") return telaEspera();
      if (!ehTime() && !minhasUnidades().length) return telaEspera();
      if (!ehTime()) {
        let salva = null; try { salva = localStorage.getItem("portal-unidade"); } catch (e) { /* ignora */ }
        E.u = minhasUnidades().some(x => x.sigla === (E.u || salva)) ? (E.u || salva) : minhasUnidades()[0].sigla;
      }
      E.tela = E.tela || (ehTime() ? "pedidos" : "leads");
      await carregar();
      desenhar();
    } catch (e) {
      $app.innerHTML = `<div class="carregando"><div class="vazio"><h2>Não foi possível abrir o portal</h2><p>${esc(API.traduzir(e))}</p><button class="btn btn-primario" onclick="location.reload()">Tentar de novo</button></div></div>`;
    }
  }

  async function carregar() {
    if (ehTime()) {
      const [pedidos, perfis, acessos, unidades] = await Promise.all([API.pedidos(), API.perfis(), API.acessos(), API.unidades()]);
      Object.assign(E, { pedidos, perfis, acessos, unidades });
    } else {
      E.pedidos = await API.pedidos(minhasUnidades().map(u => u.sigla));
    }
    E.leads = API.leadsDe(E.pedidos);
  }
  async function recarregar() { await carregar(); desenhar(); }

  // ------------------------------------------------------------------
  // Acesso: entrar e criar cadastro
  // ------------------------------------------------------------------
  function telaAcesso(modo, erro, refazer) {
    const dominios = cfg.dominiosPermitidos || ["voeazul.com.br", "azulcargo.com.br"];
    const formEntrar = `
      <h2>Entrar</h2>
      <p class="sub">Use o e-mail e a senha que você criou neste portal.</p>
      ${erro ? `<div class="erro-form">${esc(erro)}</div>` : ""}
      <form id="f-entrar" novalidate>
        <div class="campo"><label for="e-email">E-mail Azul</label><input id="e-email" type="email" autocomplete="username" required placeholder="sigla.nome@${esc(dominios[0])}"></div>
        <div class="campo"><label for="e-senha">Senha</label><input id="e-senha" type="password" autocomplete="current-password" required></div>
        <div class="erro-form" id="e-erro" hidden></div>
        <button class="btn btn-primario btn-largo" type="submit">Entrar</button>
      </form>
      <p class="sub" style="margin-top:18px">Primeiro acesso? <button class="link-btn" data-modo="cadastro">Criar meu acesso</button></p>
      <p class="sub" style="margin-top:-12px;font-size:13px"><button class="link-btn" id="b-esqueci">Esqueci minha senha</button></p>`;

    const formCadastro = `
      <h2>Criar meu acesso</h2>
      <p class="sub">Preencha uma vez. Você confirma o e-mail e o time de ${esc(TIME)} libera o acesso da unidade.</p>
      <form id="f-cadastro" novalidate>
        <div class="campo"><label>Eu sou</label><div class="escolha" role="radiogroup">
          ${CARGOS.map((c, i) => `<label><input type="radio" name="c-cargo" value="${esc(c)}"${i === 0 ? " checked" : ""}> ${esc(c === "Inside Sales" ? "Time de " + TIME : c === "Executivo" ? "Executivo, coordenador ou gerente" : c)}</label>`).join("")}</div></div>
        <div class="campo"><label for="c-nome">Nome completo</label><input id="c-nome" type="text" autocomplete="name" required></div>
        <div class="campo"><label for="c-email">E-mail Azul</label><input id="c-email" type="email" autocomplete="email" required placeholder="qoc04.fernanda@${esc(dominios[0])}">
          <span class="dica so-rep">O e-mail precisa começar com a sigla da unidade. Ex.: <b>qoc04</b>.fernanda@${esc(dominios[0])} para a unidade QOC04. Aceitos: ${esc(dominios.map(d => "@" + d).join(" ou "))}.</span>
          <span class="dica so-exec" hidden>Use o seu e-mail corporativo (${esc(dominios.map(d => "@" + d).join(" ou "))}). Os seus leads ficam numa carteira no seu nome.</span></div>
        <div class="grade-2">
          <div class="campo"><label for="c-cel">Celular com DDD</label><input id="c-cel" type="tel" autocomplete="tel" required placeholder="(11) 90000-0000"></div>
          <div class="campo so-unidade so-rep"><label for="c-sigla">Sigla da unidade</label><input id="c-sigla" type="text" required maxlength="10" placeholder="Ex.: QOC04" style="text-transform:uppercase"></div>
        </div>
        <div class="grade-2 so-unidade">
          <div class="campo"><label for="c-cidade"><span class="so-rep">Cidade/UF da unidade</span><span class="so-exec" hidden>Cidade/UF onde você atua</span></label><input id="c-cidade" type="text" required placeholder="Campinas/SP"></div>
          <div class="campo"><label for="c-regiao">Região</label><select id="c-regiao" required>${opcoes(L.regioes, "", "Escolha")}</select></div>
        </div>
        ${refazer ? "" : `<div class="aviso-senha">${icone("cadeado")}<span>Crie uma senha só para este portal. Não use a senha da sua conta Azul.</span></div>`}
        <div class="grade-2"${refazer ? " hidden" : ""}>
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
        <button class="btn" data-demo="r1">Ver como representante (unidades CPQ e VCP)</button>
        <button class="btn" data-demo="t1">Ver como time de Inside Sales</button>
      </div>` : "";

    $app.innerHTML = `
      <div class="acesso">
        <section class="acesso-lado">
          ${ROTA}
          <div class="marca-topo">${cfg.logoUrl ? `${logo()}<span class="sep-v"></span><span>${esc(TIME)}</span>` : `<span>${esc(TIME)} <span class="sep">|</span> ${esc(EMPRESA)}</span>`}</div>
          <div>
            <p class="sobrelinha">Nova plataforma de leads Leads2b</p>
            <h1>${esc(cfg.nomeDoPortal || "Portal de Leads")}</h1>
            <p>Peça bases de leads para a sua unidade e registre o retorno de cada contato em um só lugar.</p>
          </div>
          <ol class="passos">
            <li><span class="n">1</span><span><b>Crie seu acesso</b>Com o seu e-mail Azul. Representantes usam o e-mail com a sigla da unidade.</span></li>
            <li><span class="n">2</span><span><b>Peça uma base</b>Até 3 segmentos e 3 cidades. São ${MAX} leads por pedido.</span></li>
            <li><span class="n">3</span><span><b>Trabalhe os contatos</b>Tire os leads de Novo e Prospecção para liberar a próxima base.</span></li>
          </ol>
          <p class="rodape-lado">Ferramenta interna do time de ${esc(TIME)}. Este portal tem login próprio e não usa a senha da sua conta Azul.</p>
        </section>
        <section class="acesso-form"><div class="acesso-caixa">${modo === "cadastro" ? formCadastro : formEntrar}${atalhos}</div></section>
      </div>`;

    $app.querySelectorAll("[data-modo]").forEach(b => b.addEventListener("click", () => telaAcesso(b.dataset.modo)));
    $app.querySelectorAll("[data-demo]").forEach(b => b.addEventListener("click", async () => { await API.entrarComo(b.dataset.demo); E.tela = null; iniciar(); }));

    const fe = document.getElementById("f-entrar");
    if (fe) {
      fe.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const erroEl = document.getElementById("e-erro");
        const email = document.getElementById("e-email").value, senha = document.getElementById("e-senha").value;
        if (!email || !senha) { erroEl.textContent = "Informe e-mail e senha."; erroEl.hidden = false; return; }
        try { await ocupado(fe.querySelector("button[type=submit]"), () => API.entrar(email, senha)); E.tela = null; iniciar(); }
        catch (e) { erroEl.textContent = API.traduzir(e); erroEl.hidden = false; }
      });
      document.getElementById("b-esqueci").addEventListener("click", async (ev) => {
        const email = document.getElementById("e-email").value.trim();
        const erroEl = document.getElementById("e-erro");
        if (!email) { erroEl.textContent = "Digite seu e-mail acima e clique de novo em \"Esqueci minha senha\"."; erroEl.hidden = false; return; }
        try { await ocupado(ev.currentTarget, () => API.esqueciSenha(email)); aviso("Se o e-mail tiver cadastro, enviamos um link para criar uma senha nova. Veja também o lixo eletrônico."); }
        catch (e) { erroEl.textContent = API.traduzir(e); erroEl.hidden = false; }
      });
    }

    const fc = document.getElementById("f-cadastro");
    if (fc) {
      const cargo = () => (fc.querySelector("[name=c-cargo]:checked") || {}).value || "Representante";
      if (refazer) { const c = document.getElementById("c-email"); c.value = refazer; c.readOnly = true; }
      const email = document.getElementById("c-email"), sigla = document.getElementById("c-sigla");
      const ajustar = () => {
        const c = cargo();
        fc.querySelectorAll(".so-unidade").forEach(el => el.hidden = c === "Inside Sales");
        fc.querySelectorAll(".so-rep").forEach(el => el.hidden = c !== "Representante");
        fc.querySelectorAll(".so-exec").forEach(el => el.hidden = c !== "Executivo");
        email.placeholder = c === "Representante" ? "qoc04.fernanda@" + dominios[0] : "nome.sobrenome@" + dominios[0];
      };
      fc.querySelectorAll("[name=c-cargo]").forEach(r => r.addEventListener("change", ajustar));
      email.addEventListener("input", () => { if (!sigla.dataset.mexeu) sigla.value = API.siglaDoEmail(email.value).slice(0, 10); });
      sigla.addEventListener("input", () => { sigla.dataset.mexeu = "1"; });
      fc.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const v = (id) => document.getElementById(id).value.trim();
        const erroEl = document.getElementById("c-erro");
        const mostrar = (m) => { erroEl.textContent = m; erroEl.hidden = false; };
        const em = v("c-email").toLowerCase();
        const ehDoTime = cargo() === "Inside Sales";
        const sg = v("c-sigla").toUpperCase();
        const ehExec = cargo() === "Executivo";
        if (!v("c-nome") || !em || !v("c-cel") || (!ehDoTime && ((!ehExec && !sg) || !v("c-cidade") || !v("c-regiao")))) return mostrar("Preencha todos os campos.");
        if (!dominios.includes(em.split("@")[1])) return mostrar(`Use seu e-mail corporativo (${dominios.map(d => "@" + d).join(" ou ")}).`);
        if (!ehDoTime && !ehExec && API.siglaDoEmail(em) !== sg) return mostrar(`O e-mail precisa começar com a sigla da unidade: ${sg.toLowerCase()}.seunome@${em.split("@")[1]}.`);
        if (!/^[A-Z0-9]{2,10}$/.test(sg) && !ehDoTime && !ehExec) return mostrar("A sigla deve ter de 2 a 10 letras ou números.");
        if (fone(v("c-cel")).length < 12) return mostrar("Informe o celular com DDD.");
        if (!refazer && v("c-senha").length < 8) return mostrar("A senha precisa ter pelo menos 8 caracteres.");
        if (!refazer && v("c-senha") !== v("c-senha2")) return mostrar("As senhas não são iguais.");
        try {
          const r = await ocupado(fc.querySelector("button[type=submit]"), () => API.cadastrar(em, v("c-senha"), {
            nome: v("c-nome"), celular: v("c-cel"), sigla: sg, cidade_uf: v("c-cidade"), regiao: v("c-regiao"), time: ehDoTime, cargo: cargo()
          }));
          if (r && r.confirmar === false) { E.tela = null; iniciar(); } else telaConfirmar(em);
        } catch (e) { mostrar(API.traduzir(e)); }
      });
    }
  }

  // Confirmação de e-mail: logo depois do cadastro ou quando a pessoa entra sem ter confirmado.
  function telaConfirmar(email, veioDoLogin) {
    $app.innerHTML = `
      <div class="carregando"><div class="vazio confirmar" style="max-width:560px">
        <span class="icone icone-grande" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.email}</svg></span>
        <h2>${veioDoLogin ? "Falta confirmar seu e-mail" : "Confirme seu e-mail"}</h2>
        <p>${veioDoLogin ? "Antes de continuar, confirme o e-mail" : "Enviamos um link de confirmação para"} <b>${esc(email)}</b>.</p>
        <ol class="passos-confirmar">
          <li>Abra a mensagem do <b>${esc(cfg.nomeDoPortal || "Portal de Leads")}</b> na sua caixa de entrada. Se não achar, veja o lixo eletrônico.</li>
          <li>Clique no link da mensagem.</li>
          <li>Volte aqui e clique em <b>Já confirmei</b>. Depois o time de ${esc(TIME)} confere seus dados e libera a unidade.</li>
        </ol>
        <div class="acoes" style="justify-content:center">
          <button class="btn btn-primario" id="b-confirmei">Já confirmei</button>
          <button class="btn" id="b-reenviar">Reenviar e-mail</button>
          <button class="btn" id="b-sair">Sair</button>
        </div>
        ${API.demo ? `<p class="sub" style="margin-top:18px"><button class="btn" id="b-simular">Simular clique no link do e-mail</button></p>` : ""}
      </div></div>`;
    document.getElementById("b-sair").onclick = sair;
    document.getElementById("b-reenviar").onclick = async (ev) => {
      try { await ocupado(ev.currentTarget, () => API.reenviarConfirmacao()); aviso("Enviamos um novo link. Confira a caixa de entrada e o lixo eletrônico."); }
      catch (e) { aviso(API.traduzir(e), true); }
    };
    document.getElementById("b-confirmei").onclick = async (ev) => {
      try {
        const ok = await ocupado(ev.currentTarget, () => API.conferirConfirmacao());
        if (ok) { E.tela = null; iniciar(); } else aviso("Ainda não recebemos a confirmação. Clique no link do e-mail e tente de novo.", true);
      } catch (e) { aviso(API.traduzir(e), true); }
    };
    const s = document.getElementById("b-simular");
    if (s) s.onclick = async () => { await API.simularConfirmacao(); E.tela = null; iniciar(); };
  }

  // Login existe, mas o cadastro foi excluído pelo time: permite refazer com o mesmo e-mail.
  function telaSemCadastro(email) {
    $app.innerHTML = `
      <div class="carregando"><div class="vazio" style="max-width:520px">
        <h2>Não encontramos seu cadastro</h2>
        <p>O cadastro de <b>${esc(email)}</b> foi excluído ou não terminou. Você pode refazer agora com o mesmo e-mail. Depois, o time de ${esc(TIME)} confere e libera de novo.</p>
        <div class="acoes" style="justify-content:center">
          <button class="btn btn-primario" id="b-refazer">Refazer meu cadastro</button>
          <button class="btn" id="b-sair">Sair</button>
        </div>
      </div></div>`;
    document.getElementById("b-refazer").onclick = () => telaAcesso("cadastro", null, email);
    document.getElementById("b-sair").onclick = sair;
  }

  function telaEspera() {
    const p = E.perfil;
    const recusado = p.situacao === "recusado";
    const unid = (p.unidades || []).map(u => u.nome ? "da sua carteira" : "da unidade " + u.sigla).join(", ");
    $app.innerHTML = `
      <div class="carregando"><div class="vazio" style="max-width:520px">
        ${!recusado ? `<p class="selo selo-ok" style="margin:0 auto 10px">E-mail confirmado</p>` : ""}
        <h2>${recusado ? "Seu acesso não foi aprovado" : "Cadastro enviado"}</h2>
        <p>${recusado
          ? `Fale com o time de ${esc(TIME)} para revisar o seu cadastro.`
          : `O time de ${esc(TIME)} vai conferir seus dados e liberar o acesso${unid ? " " + esc(unid) : ""}. Você recebe um aviso pelo WhatsApp quando estiver pronto.`}</p>
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
    const pendentes = E.perfis.filter(p => p.situacao === "pendente").length + E.acessos.filter(a => a.situacao === "pendente" && !a.principal).length;
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
    const n = minhasUnidades().length;

    $app.innerHTML = `
      <div class="app">
        <aside class="lateral">
          <div class="marca">${logo("logo logo-menu")}<span>${esc(cfg.nomeDoPortal || "Portal de Leads")}<small>${cfg.logoUrl ? esc(TIME) : `${esc(TIME)} | ${esc(EMPRESA)}`}</small></span></div>
          <nav class="nav" aria-label="Menu">
            ${itens.map(([id, nome, c]) => `<button data-tela="${id}"${E.tela === id ? ' aria-current="page"' : ""}><span>${nome}</span>${c ? `<span class="contador">${c}</span>` : ""}</button>`).join("")}
          </nav>
          <div class="quem">
            <div><div class="nome">${esc(E.perfil.nome)}</div><div class="papel">${time ? "Time de " + esc(TIME) : `${E.perfil.cargo === "Executivo" ? "Executivo · " : ""}${n > 1 ? `${n} unidades` : esc(unidade() ? rotuloLongo(unidade().sigla) : "")}`}</div></div>
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
    m.querySelectorAll("[data-unidade]").forEach(b => b.addEventListener("click", () => { escolherUnidade(b.dataset.unidade); desenhar(); }));
    m.querySelectorAll("[data-lead]").forEach(el => el.addEventListener("click", (ev) => {
      if (ev.target.closest("select, a, button.nao-abre")) return;
      janelaLead(el.dataset.lead);
    }));
    m.querySelectorAll(".cartao[data-lead]").forEach(el => el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); janelaLead(el.dataset.lead); }
    }));
    m.querySelectorAll("select[data-status-rapido]").forEach(sel => sel.addEventListener("change", () => salvarStatus(sel.dataset.statusRapido, sel.value)));
    m.querySelectorAll("[data-pedido]").forEach(el => el.addEventListener("click", () => ehTime() ? janelaPedidoTime(el.dataset.pedido) : null));
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
    aprovar: (b) => mudar(() => API.aprovarCadastro(b.dataset.id), "Cadastro aprovado."),
    recusar: (b) => mudar(() => API.atualizarPerfil(b.dataset.id, { situacao: "recusado" }), "Cadastro recusado."),
    tornarTime: (b) => { if (confirm("Dar acesso de time a esta pessoa? Ela passa a ver e alterar tudo.")) mudar(() => API.atualizarPerfil(b.dataset.id, { papel: "time" }), "Acesso de time liberado."); },
    tornarRep: (b) => mudar(() => API.atualizarPerfil(b.dataset.id, { papel: "representante" }), "Acesso alterado para representante."),
    aprovarUnidade: (b) => mudar(() => API.atualizarAcesso(b.dataset.id, "aprovado"), "Unidade liberada."),
    recusarUnidade: (b) => mudar(() => API.atualizarAcesso(b.dataset.id, "recusado"), "Unidade recusada."),
    senha: async (b) => {
      const p = E.perfis.find(x => x.id === b.dataset.id);
      if (!confirm(`Enviar para ${p.email} um e-mail com o link para criar uma senha nova?`)) return;
      try { await ocupado(b, () => API.enviarRedefinicao(p.email)); aviso("E-mail de redefinição enviado."); } catch (e) { aviso(API.traduzir(e), true); }
    },
    pedirUnidade: () => janelaPedirUnidade(),
    excluir: (b) => janelaExcluir(b.dataset.id)
  };
  async function mudar(fn, msg) {
    try { await fn(); await recarregar(); aviso(msg); } catch (e) { aviso(API.traduzir(e), true); }
  }

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
      <div class="cartao" role="button" tabindex="0" data-lead="${esc(l.id)}" draggable="true" aria-label="${esc(l.empresa)}, ${esc(l.status)}">
        <span class="titulo">${esc(l.empresa)}</span>
        <span class="meta">
          ${l.cnpj ? esc(l.cnpj) + "<br>" : ""}
          ${l.contato ? esc(l.contato) + "<br>" : ""}
          ${esc([l.cidade_uf, ehTime() ? "Unidade " + l.sigla : l.segmento].filter(Boolean).join(" · "))}
        </span>
        <span class="rodape">
          ${l.data_contato ? `<span class="etiqueta">Contato ${data(l.data_contato)}</span>` : ""}
          ${l.contato_valido === "Não" ? `<span class="etiqueta alerta">Sem contato válido</span>` : ""}
          ${parado(l) ? `<span class="etiqueta alerta">Parado há ${dias(l.atualizado_em)} dias</span>` : ""}
          ${ehTime() && p.id ? `<span class="etiqueta">${esc(p.id)}</span>` : ""}
        </span>
      </div>`;
  }

  function quadro(lista) {
    return `<div class="quadro">${STATUS.map(s => {
      const itens = lista.filter(l => l.status === s.nome);
      return `<section class="coluna" data-coluna="${esc(s.nome)}" aria-label="${esc(s.nome)}">
        <div class="coluna-topo" title="${esc(s.desc)}"><span>${ponto(s.nome)}${esc(s.nome)}</span><span class="qtd">${itens.length}</span></div>
        <p class="coluna-desc">${esc(s.desc)}</p>
        ${itens.length ? itens.map(cartao).join("") : `<div class="coluna-vazia">Nenhum lead aqui</div>`}
      </section>`;
    }).join("")}</div>`;
  }

  function tabelaLeads(lista) {
    if (!lista.length) return `<div class="vazio"><h2>Nenhum lead encontrado</h2><p>Mude os filtros para ver outros leads.</p></div>`;
    return `<div class="tabela-wrap"><table class="lista-leads">
      <thead><tr><th>Empresa</th>${ehTime() ? "<th>Unidade</th>" : ""}<th>Contato</th><th>Cidade</th><th>Status</th><th>Último contato</th><th>Contato válido?</th></tr></thead>
      <tbody>${lista.map(l => `
        <tr class="clicavel" data-lead="${esc(l.id)}">
          <td><b>${esc(l.empresa)}</b><div class="sec">${esc(l.cnpj)}</div></td>
          ${ehTime() ? `<td data-rotulo="Unidade">${esc(rotulo(l.sigla))}</td>` : ""}
          <td>${esc(l.contato)}<div class="sec">${esc(foneBonito(l.telefone))}</div></td>
          <td>${esc(l.cidade_uf)}</td>
          <td><select data-status-rapido="${esc(l.id)}" aria-label="Status de ${esc(l.empresa)}">${opcoes(NOMES_STATUS, l.status)}</select>
            ${parado(l) ? `<div class="sec" style="color:var(--danger)">Parado há ${dias(l.atualizado_em)} dias</div>` : ""}</td>
          <td data-rotulo="Último contato">${data(l.data_contato)}</td>
          <td data-rotulo="Contato válido?">${esc(l.contato_valido || "–")}</td>
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
      c.addEventListener("dragstart", (e) => { arrastando = c.dataset.lead; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", arrastando); });
      c.addEventListener("dragend", () => { arrastando = null; raiz.querySelectorAll(".alvo").forEach(x => x.classList.remove("alvo")); });
    });
    raiz.querySelectorAll("[data-coluna]").forEach(col => {
      col.addEventListener("dragover", (e) => { if (arrastando) { e.preventDefault(); col.classList.add("alvo"); } });
      col.addEventListener("dragleave", () => col.classList.remove("alvo"));
      col.addEventListener("drop", (e) => {
        e.preventDefault(); col.classList.remove("alvo");
        const id = e.dataTransfer.getData("text/plain");
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
    await carregar();
    desenhar();
    if (!ehTime() && !antes && podePedir()) aviso("Base liberada: nenhum lead em Novo ou Prospecção. Você já pode pedir uma nova base.");
    else aviso(msg);
  }

  // ------------------------------------------------------------------
  // Ficha do lead: contatos com mensagem pronta e histórico
  // ------------------------------------------------------------------
  function preencher(modelo, l) {
    const u = E.perfil.unidades && E.perfil.unidades.find(x => x.sigla === l.sigla) || {};
    const contato = l.contato && !/fict/i.test(l.contato) ? ", " + primeiroNome(l.contato) : "";
    return modelo.replace(/\{contato\}/g, contato).replace(/\{empresa\}/g, l.empresa || "").replace(/\{nome\}/g, primeiroNome(E.perfil.nome))
      .replace(/\{sigla\}/g, l.sigla || "").replace(/\{cidade\}/g, u.cidade_uf || l.cidade_uf || "").replace(/\{celular\}/g, foneBonito(E.perfil.celular));
  }
  const ROTULO_HIST = { recebido: "⬇", status: "↻", contato_valido: "✓", whatsapp: "✆", email: "✉", ligacao: "☎", observacao: "✎" };

  function janelaLead(id) {
    const l = E.leads.find(x => x.id === id);
    if (!l) return;
    const p = pedidoDe(l);
    const email = API.limparEmail(l.email);
    const tel = API.limparTelefone(l.telefone);
    let pendente = null; // ação aberta que espera a confirmação "Você enviou?"

    abrir(`
      <div class="janela-topo"><div><h2>${esc(l.empresa)}</h2><p>${esc(rotuloLongo(l.sigla))}${p.id ? `, pedido ${esc(p.id)} de ${data(p.criada_em)}` : ""}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <dl class="dados">
          ${[["CNPJ", l.cnpj], ["Segmento", l.segmento], ["Cidade/UF", l.cidade_uf], ["Contato", l.contato], ["Telefone", tel ? foneBonito(tel) : l.telefone], ["E-mail", email || l.email]]
            .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}
        </dl>
        <div class="contatos">
          ${tel ? `<button class="btn btn-zap btn-p" data-canal="whatsapp">WhatsApp com mensagem pronta</button><button class="btn btn-p" data-canal="ligacao">Ligar</button>` : ""}
          ${email ? `<button class="btn btn-p" data-canal="email">E-mail com mensagem pronta</button>` : ""}
        </div>
        <div id="l-compor"></div>
        <div class="confirma" id="l-confirma" hidden></div>
        <form id="f-lead">
          <div class="grade-2">
            <div class="campo"><label for="l-status">Status</label><select id="l-status">${opcoes(NOMES_STATUS, l.status)}</select><span class="dica" id="l-desc">${esc(DESC[l.status] || "")}</span></div>
            <div class="campo"><label for="l-data">Data do contato</label><input id="l-data" type="date" value="${esc(l.data_contato || "")}"></div>
          </div>
          <div class="campo"><label for="l-valido">Tem contato válido?</label><select id="l-valido">${opcoes(["Sim", "Não"], l.contato_valido, "Selecione")}</select></div>
        </form>
        <div class="hist"><h3>Histórico</h3><div id="l-hist"><p class="sub">Carregando…</p></div>
          <div class="campo" style="margin-top:12px"><textarea id="l-obs" rows="2" placeholder="Adicionar observação…"></textarea></div>
          <button class="btn btn-p" id="l-add-obs">+ Adicionar observação</button>
        </div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button><button class="btn btn-primario" id="l-salvar">Salvar</button></div>`,
    (j) => {
      const st = j.querySelector("#l-status"), dt = j.querySelector("#l-data"), vd = j.querySelector("#l-valido");
      st.addEventListener("change", () => { j.querySelector("#l-desc").textContent = DESC[st.value] || ""; if (!dt.value && st.value !== "Novo") dt.value = hojeISO(); });
      vd.addEventListener("change", () => {
        if (vd.value === "Não" && st.value !== "Contato inválido" && confirm("Sem contato válido. Mudar o status para \"Contato inválido\"?")) {
          st.value = "Contato inválido"; st.dispatchEvent(new Event("change"));
        }
      });

      const lista = j.querySelector("#l-hist");
      const carregarHist = async () => {
        try {
          const hs = await API.historico(id);
          lista.innerHTML = hs.length ? hs.map(h => {
            const minha = h.tipo === "observacao" && h.autor === E.perfil.id && mesmoDia(h.criado_em);
            return `<div class="evento" data-h="${esc(h.id)}"><span class="ic ic-${esc(h.tipo)}">${ROTULO_HIST[h.tipo] || "•"}</span><div>
              <div class="t">${esc(h.texto)}</div>
              <div class="m">${esc(h.autor_nome)} · ${dataHora(h.criado_em)}${h.editado_em ? " · editado" : ""}${h.tipo !== "observacao" ? '<span class="trava">· registro automático</span>' : ""}
                ${minha ? `<a href="#" data-editar="${esc(h.id)}">Editar</a><a href="#" class="x" data-excluir="${esc(h.id)}">Excluir</a>` : ""}</div></div></div>`;
          }).join("") : `<p class="sub">Nenhum registro ainda.</p>`;
          lista.querySelectorAll("[data-editar]").forEach(a => a.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const h = hs.find(x => x.id === a.dataset.editar);
            const novo = prompt("Editar observação:", h.texto);
            if (novo === null || !novo.trim() || novo.trim() === h.texto) return;
            try { await API.editarObservacao(id, h.id, novo.trim()); carregarHist(); } catch (e) { aviso(API.traduzir(e), true); }
          }));
          lista.querySelectorAll("[data-excluir]").forEach(a => a.addEventListener("click", async (ev) => {
            ev.preventDefault();
            if (!confirm("Excluir esta observação?")) return;
            try { await API.excluirObservacao(id, a.dataset.excluir); carregarHist(); } catch (e) { aviso(API.traduzir(e), true); }
          }));
        } catch (e) { lista.innerHTML = `<p class="sub">${esc(API.traduzir(e))}</p>`; }
      };
      carregarHist();

      j.querySelector("#l-add-obs").addEventListener("click", async (ev) => {
        const t = j.querySelector("#l-obs").value.trim();
        if (!t) return;
        try { await ocupado(ev.currentTarget, () => API.registrar(id, "observacao", t)); j.querySelector("#l-obs").value = ""; carregarHist(); }
        catch (e) { aviso(API.traduzir(e), true); }
      });

      // Pergunta "Você enviou?" quando a pessoa volta para o portal.
      const confirma = j.querySelector("#l-confirma");
      const perguntar = (canal) => {
        const pergunta = { whatsapp: "Você enviou a mensagem pelo <b>WhatsApp</b>?", email: "Você enviou o <b>e-mail</b>?", ligacao: "Você conseguiu <b>falar</b> com a empresa?" }[canal];
        const sim = { whatsapp: "Sim, enviei", email: "Sim, enviei", ligacao: "Sim, falei" }[canal];
        const nao = { whatsapp: "Não", email: "Não", ligacao: "Não atendeu" }[canal];
        confirma.innerHTML = `<span>${pergunta}</span><button class="btn btn-p btn-primario" data-r="sim">${sim}</button><button class="btn btn-p" data-r="nao">${nao}</button>`;
        confirma.hidden = false;
        confirma.querySelectorAll("[data-r]").forEach(b => b.addEventListener("click", async () => {
          const ok = b.dataset.r === "sim";
          const texto = {
            whatsapp: ok ? "WhatsApp: mensagem enviada" : null,
            email: ok ? "E-mail: proposta enviada" : null,
            ligacao: ok ? "Ligação: conseguiu falar" : "Ligação: não atendeu"
          }[canal];
          confirma.hidden = true; pendente = null;
          try {
            if (texto) await API.registrar(id, canal, texto);
            if ((ok || canal === "ligacao") && l.status === "Novo") {
              st.value = "Prospecção"; st.dispatchEvent(new Event("change"));
              const novo = await API.atualizarLead(id, { status: "Prospecção", data_contato: dt.value || hojeISO() });
              Object.assign(l, novo);
            }
            carregarHist();
          } catch (e) { aviso(API.traduzir(e), true); }
        }));
      };
      const aoVoltar = () => { if (pendente && document.visibilityState === "visible" && $janela.open) perguntar(pendente); };
      document.addEventListener("visibilitychange", aoVoltar);
      window.addEventListener("focus", aoVoltar);
      $janela.addEventListener("close", () => { document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); }, { once: true });

      const compor = j.querySelector("#l-compor");
      j.querySelectorAll("[data-canal]").forEach(b => b.addEventListener("click", () => {
        const canal = b.dataset.canal;
        if (canal === "ligacao") { pendente = "ligacao"; location.href = `tel:+55${tel}`; setTimeout(() => perguntar("ligacao"), 1500); return; }
        const assunto = preencher(L.mensagens.emailAssunto, l);
        const corpo = preencher(canal === "email" ? L.mensagens.email : L.mensagens.whatsapp, l);
        compor.innerHTML = `<div class="msg-prev">
            <div class="cab">${canal === "email" ? `<b>Para</b>${esc(email)}<br><b>Assunto</b><input id="m-assunto" value="${esc(assunto)}">` : `<b>Para</b>WhatsApp ${esc(foneBonito(tel))}`}</div>
            <textarea id="m-texto" rows="8">${esc(corpo)}</textarea></div>
          <div class="acoes" style="margin:8px 0 16px"><span class="sub" style="flex:1">Você pode ajustar o texto antes de abrir.</span>
            <button class="btn btn-p" id="m-cancelar">Cancelar</button><button class="btn btn-p btn-primario" id="m-abrir">${canal === "email" ? "Abrir no e-mail" : "Abrir no WhatsApp"}</button></div>`;
        compor.querySelector("#m-cancelar").onclick = () => { compor.innerHTML = ""; };
        compor.querySelector("#m-abrir").onclick = () => {
          const texto = compor.querySelector("#m-texto").value;
          const url = canal === "email"
            ? `mailto:${email}?subject=${encodeURIComponent(compor.querySelector("#m-assunto").value)}&body=${encodeURIComponent(texto)}`
            : `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`;
          pendente = canal; compor.innerHTML = "";
          if (canal === "email") location.href = url; else window.open(url, "_blank", "noopener");
          setTimeout(() => { if (pendente) perguntar(canal); }, 1500);
        };
      }));

      j.querySelector("#l-salvar").addEventListener("click", async (ev) => {
        try {
          const novo = await ocupado(ev.currentTarget, () => API.atualizarLead(id, { status: st.value, data_contato: dt.value || null, contato_valido: vd.value || "" }));
          Object.assign(l, novo); fechar();
          await aposMudarLead("Lead salvo.");
        } catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }

  // ------------------------------------------------------------------
  // Representante: unidades, meus leads e pedidos
  // ------------------------------------------------------------------
  const pedidosU = () => E.pedidos.filter(p => unidade() && p.sigla === unidade().sigla);
  const leadsU = () => E.leads.filter(l => unidade() && l.sigla === unidade().sigla);
  const pedidoAtualU = () => pedidosU()[0] || null;
  const emAndamento = () => { const p = pedidoAtualU(); return p && ["Nova", "Em extração"].includes(p.situacao) ? p : null; };
  const leadsBase = () => { const p = pedidoAtualU(); return p ? leadsU().filter(l => l.solicitacao_id === p.id) : []; };
  const abertosBase = () => leadsBase().filter(trava);
  const podePedir = () => !emAndamento() && abertosBase().length === 0;

  function resumoUnidade(sigla) {
    const ps = E.pedidos.filter(p => p.sigla === sigla);
    const atual = ps[0];
    if (!atual) return ["Pode pedir a primeira base", "ok"];
    if (["Nova", "Em extração"].includes(atual.situacao)) return ["Pedido em preparo", ""];
    const ls = E.leads.filter(l => l.solicitacao_id === atual.id);
    const ab = ls.filter(trava).length;
    return ab ? [`${ls.length - ab} de ${ls.length} trabalhados`, ""] : ["Base liberada", "ok"];
  }

  function barraUnidades() {
    const todas = E.perfil.unidades || [];
    if (todas.length <= 1) return "";
    return `<div class="unidades">${todas.map(u => {
      if (u.acesso !== "aprovado") return `<div class="unidade inativa"><b>${esc(rotulo(u.sigla))}</b><small>${esc(u.cidade_uf || "")}</small><br><span class="mini">${u.acesso === "recusado" ? "Não liberada" : "Aguardando o time"}</span></div>`;
      const [txt, cls] = resumoUnidade(u.sigla);
      return `<button class="unidade${unidade() && unidade().sigla === u.sigla ? " ativa" : ""}" data-unidade="${esc(u.sigla)}"><b>${esc(rotulo(u.sigla))}</b><small>${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}</small><br><span class="mini ${cls}">${esc(txt)}</span></button>`;
    }).join("")}</div>`;
  }

  function faixaBase() {
    const andamento = emAndamento();
    const base = pedidoAtualU();
    const doBase = leadsBase();
    const abertos = abertosBase().length;
    const trabalhados = doBase.length - abertos;

    if (!base) {
      return `<div class="vazio"><h2>Esta unidade ainda não tem leads</h2><p>Peça a primeira base escolhendo até 3 segmentos fortes e até 3 cidades. São ${MAX} leads por pedido.</p><button class="btn btn-primario" data-acao="novoPedido">Pedir leads</button></div>`;
    }
    let titulo, texto, acao = "";
    if (andamento) {
      titulo = "Seu pedido está com o time";
      texto = `Pedido de ${data(andamento.criada_em)} (${esc(segmentosDe(andamento))}): ${andamento.situacao === "Nova" ? "aguardando o time" : "em extração"}. Previsão de entrega: ${esc(sexta(andamento.previsao))}, conforme a disponibilidade do time.`;
    } else if (!doBase.length) {
      titulo = `Pedido ${esc(base.id)}: ${esc(base.situacao)}`;
      texto = base.observacao_time ? esc(base.observacao_time) : "Você já pode pedir uma nova base.";
      acao = `<button class="btn btn-primario" data-acao="novoPedido">Pedir nova base</button>`;
    } else if (abertos) {
      titulo = `Base atual: ${trabalhados} de ${doBase.length} leads trabalhados`;
      texto = `Faltam ${abertos} lead${abertos > 1 ? "s" : ""} em Novo ou Prospecção para liberar uma nova base.`;
      acao = `<button class="btn" disabled title="Tire todos os leads de Novo e Prospecção para pedir uma nova base">Pedir nova base</button>`;
    } else {
      titulo = `Base atual: ${trabalhados} de ${doBase.length} leads trabalhados`;
      texto = `<span class="liberado">Base liberada.</span> Nenhum lead em Novo ou Prospecção. Você já pode pedir uma nova base.`;
      acao = `<button class="btn btn-primario" data-acao="novoPedido">Pedir nova base</button>`;
    }
    const trilha = doBase.length ? `<div class="trilha" aria-hidden="true">${doBase.slice().sort((a, b) => final(b) - final(a)).map(l =>
      final(l) ? `<span class="fim" style="background:${COR[l.status]}" title="${esc(l.status)}"></span>` : `<span title="${esc(l.status)}" style="border-color:${COR[l.status]}"></span>`).join("")}</div>` : "";
    return `<section class="base">${icone("aviao")}<div><h2>${titulo}</h2><p>${texto}</p>${trilha}</div><div>${acao}</div></section>`;
  }

  function telaLeadsRep() {
    const u = unidade();
    const base = pedidoAtualU();
    let lista = leadsU();
    if (E.f.base === "atual" && base) lista = lista.filter(l => l.solicitacao_id === base.id);
    lista = filtrarLeads(lista);
    const temLeads = leadsU().length > 0;
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Meus leads</h1><p>${minhasUnidades().length > 1 ? "Escolha a unidade para ver os leads e pedir bases." : `${esc(rotuloLongo(u.sigla))}${u.cidade_uf ? ", " + esc(u.cidade_uf) : ""}`}</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      ${barraUnidades()}
      ${faixaBase()}
      ${temLeads ? `
        <div class="filtros">
          <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Empresa, CNPJ, contato ou telefone"></div>
          <div class="campo"><label for="f-base">Base</label><select id="f-base" data-filtro="base"><option value="atual"${E.f.base === "atual" ? " selected" : ""}>Base atual</option><option value="todas"${E.f.base === "todas" ? " selected" : ""}>Todas as bases</option></select></div>
          <div class="campo"><label for="f-status">Status</label><select id="f-status" data-filtro="status">${opcoes(NOMES_STATUS, E.f.status, "Todos")}</select></div>
          ${seletorVista()}
        </div>
        ${E.vista === "kanban" ? quadro(lista) : tabelaLeads(lista)}` : ""}`;
  }

  function contagem(p) {
    const ls = E.leads.filter(l => l.solicitacao_id === p.id);
    return ls.length ? `${ls.filter(final).length} de ${ls.length}` : "–";
  }

  function telaPedidosRep() {
    const pode = podePedir();
    const motivo = emAndamento() ? "Esta unidade já tem um pedido em andamento." : abertosBase().length ? `Tire os ${abertosBase().length} leads de Novo e Prospecção para pedir uma nova base.` : "";
    const ps = pedidosU();
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Meus pedidos</h1><p>${pode ? "Você pode pedir uma nova base agora." : esc(motivo)}</p></div>
        <div class="acoes"><button class="btn btn-primario" data-acao="novoPedido"${pode ? "" : " disabled"}>Pedir nova base</button></div></div>
      ${barraUnidades()}
      ${ps.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Pedido</th><th>Data</th><th>Previsão</th><th>Segmentos</th><th>Cidades</th><th>Empresas indicadas</th><th>Situação</th><th>Leads trabalhados</th></tr></thead>
        <tbody>${ps.map(p => `<tr>
          <td>${esc(p.id)}</td><td>${data(p.criada_em)}</td><td>${data(p.previsao)}</td><td>${esc(segmentosDe(p))}</td><td>${esc(cidadesDe(p) || "–")}</td><td class="sec" style="white-space:pre-line">${esc(p.empresas || "")}</td>
          <td>${chipSituacao(p.situacao)}${p.observacao_time ? `<div class="sec">${esc(p.observacao_time)}</div>` : ""}</td><td>${contagem(p)}</td></tr>`).join("")}</tbody>
      </table></div>` : `<div class="vazio"><h2>Nenhum pedido ainda</h2><p>O primeiro pedido desta unidade aparece aqui com a situação de cada etapa.</p></div>`}`;
  }

  // Campo de segmentos com busca (até 3).
  function campoSegmentos(raiz, escolhidos) {
    const entrada = raiz.querySelector("#p-busca"), lista = raiz.querySelector("#p-lista"), chips = raiz.querySelector("#p-chips");
    const desenharChips = () => {
      chips.innerHTML = escolhidos.map((s, i) => `<span class="chip">${esc(s)}<button type="button" aria-label="Tirar ${esc(s)}" data-tirar="${i}">×</button></span>`).join("");
      chips.querySelectorAll("[data-tirar]").forEach(b => b.onclick = () => { escolhidos.splice(Number(b.dataset.tirar), 1); desenharChips(); filtrar(); });
      entrada.disabled = escolhidos.length >= 3;
      entrada.placeholder = escolhidos.length >= 3 ? "Limite de 3 segmentos" : "Digite para buscar, ex.: comércio";
    };
    const filtrar = () => {
      const q = norm(entrada.value);
      if (!q) { lista.hidden = true; lista.innerHTML = ""; return; }
      const achados = L.segmentos.filter(s => norm(s).includes(q) && !escolhidos.includes(s)).slice(0, 8);
      lista.innerHTML = achados.length ? achados.map((s, i) => `<button type="button" class="${i === 0 ? "ativo" : ""}" data-seg="${esc(s)}">${esc(s)}</button>`).join("") : `<div class="nada">Nenhum segmento encontrado</div>`;
      lista.hidden = false;
      lista.querySelectorAll("[data-seg]").forEach(b => b.onclick = () => { escolhidos.push(b.dataset.seg); entrada.value = ""; desenharChips(); filtrar(); entrada.focus(); });
    };
    entrada.addEventListener("input", filtrar);
    entrada.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const p = lista.querySelector("[data-seg]"); if (p) p.click(); } });
    desenharChips();
  }

  function janelaNovoPedido() {
    const opcoesU = minhasUnidades();
    const atual = unidade();
    if (!podePedir()) { aviso(emAndamento() ? "Esta unidade já tem um pedido em andamento." : "Tire todos os leads de Novo e Prospecção para pedir uma nova base.", true); return; }
    const escolhidos = [];
    abrir(`
      <div class="janela-topo"><div><h2>Pedir nova base de leads</h2><p>Cada pedido traz até ${MAX} leads</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="p-unid">Unidade</label><select id="p-unid"${opcoesU.length < 2 ? " disabled" : ""}>${opcoesU.map(u => `<option value="${esc(u.sigla)}"${u.sigla === atual.sigla ? " selected" : ""}>${esc(rotulo(u.sigla))} · ${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}</option>`).join("")}</select></div>
        <div class="campo busca-seg"><label for="p-busca">Segmentos (até 3)</label><input id="p-busca" type="text" autocomplete="off"><div class="lista-seg" id="p-lista" hidden></div><div class="chips" id="p-chips"></div></div>
        <div class="campo"><label>Cidades de interesse (até 3, opcional)</label><div class="grade-3"><input type="text" id="p-c1" placeholder="Cidade/UF"><input type="text" id="p-c2" placeholder="Cidade/UF"><input type="text" id="p-c3" placeholder="Cidade/UF"></div></div>
        <div class="campo"><label for="p-emp">Empresas específicas (opcional)</label><textarea id="p-emp" rows="3" placeholder="Razão social, CNPJ ou CNAE, um por linha"></textarea></div>
        <div class="info-pedido">ℹ️ <span>Cada pedido traz <b>até ${MAX} leads</b>. A base chega na <b>sexta-feira</b> seguinte ao pedido, conforme a disponibilidade do time.</span></div>
        <div class="erro-form" id="p-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="p-enviar">Enviar pedido</button></div>`,
    (j) => {
      campoSegmentos(j, escolhidos);
      j.querySelector("#p-unid").addEventListener("change", (e) => { escolherUnidade(e.target.value); if (!podePedir()) { fechar(); desenhar(); aviso(`A unidade ${e.target.value} ainda não pode pedir uma nova base.`, true); } });
      j.querySelector("#p-enviar").addEventListener("click", async (ev) => {
        const erro = j.querySelector("#p-erro");
        const u = unidade();
        if (!escolhidos.length) { erro.textContent = "Escolha pelo menos um segmento."; erro.hidden = false; return; }
        const cidades = ["#p-c1", "#p-c2", "#p-c3"].map(x => j.querySelector(x).value.trim()).filter(Boolean);
        const empresas = j.querySelector("#p-emp").value.trim();
        try {
          const r = await ocupado(ev.currentTarget, () => API.criarPedido({ sigla: u.sigla, regiao: u.regiao, cidade_uf: u.cidade_uf, segmentos: escolhidos.slice(), cidades, empresas: empresas || null }));
          await recarregar();
          const nEmp = empresas ? empresas.split("\n").filter(x => x.trim()).length : 0;
          abrir(`
            <div class="janela-corpo" style="text-align:center;padding-top:28px">
              <div class="ok-grande">✓</div>
              <h2 style="margin:0 0 8px;font-size:21px">Sua solicitação foi recebida</h2>
              <p style="margin:0;color:var(--muted);font-size:15px">Previsão de entrega da base: <b class="forte">próxima ${esc(sexta(r.previsao))}</b>, conforme a disponibilidade do time de ${esc(TIME)}.<br>São <b class="forte">até ${MAX} leads</b> por pedido.</p>
              <dl class="resumo"><dt>Unidade</dt><dd>${esc(rotulo(u.sigla))} · ${esc(u.cidade_uf || "")}</dd><dt>Segmentos</dt><dd>${esc(escolhidos.join(", "))}</dd>
                <dt>Cidades</dt><dd>${esc(cidades.join(", ") || "–")}</dd><dt>Empresas</dt><dd>${nEmp ? nEmp + " indicada(s)" : "–"}</dd></dl>
            </div>
            <div class="janela-rodape"><button class="btn" id="ok-pedidos">Ver meus pedidos</button><button class="btn btn-primario" data-fechar>Ok</button></div>`,
          (j2) => { j2.querySelector("#ok-pedidos").onclick = () => { fechar(); E.tela = "pedidos"; desenhar(); }; });
        } catch (e) { erro.textContent = API.traduzir(e); erro.hidden = false; }
      });
    });
  }

  function janelaPedirUnidade() {
    if ((E.perfil.unidades || []).length >= MAX_UNID) { aviso(`Cada pessoa pode ter até ${MAX_UNID} unidades.`, true); return; }
    abrir(`
      <div class="janela-topo"><div><h2>Pedir acesso a outra unidade</h2><p>O time de ${esc(TIME)} confere e libera.</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="u-sigla">Sigla da unidade</label><input id="u-sigla" type="text" maxlength="10" style="text-transform:uppercase" placeholder="Ex.: QOC05"></div>
        <div class="grade-2"><div class="campo"><label for="u-cidade">Cidade/UF</label><input id="u-cidade" type="text" placeholder="Campinas/SP"></div>
          <div class="campo"><label for="u-regiao">Região</label><select id="u-regiao">${opcoes(L.regioes, "", "Escolha")}</select></div></div>
        <div class="erro-form" id="u-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="u-enviar">Pedir acesso</button></div>`,
    (j) => {
      j.querySelector("#u-enviar").addEventListener("click", async (ev) => {
        const erro = j.querySelector("#u-erro");
        const sigla = j.querySelector("#u-sigla").value.trim().toUpperCase();
        const cidade = j.querySelector("#u-cidade").value.trim(), regiao = j.querySelector("#u-regiao").value;
        if (!/^[A-Z0-9]{2,10}$/.test(sigla) || !cidade || !regiao) { erro.textContent = "Preencha a sigla (2 a 10 letras ou números), a cidade e a região."; erro.hidden = false; return; }
        if ((E.perfil.unidades || []).some(u => u.sigla === sigla)) { erro.textContent = "Você já tem essa unidade no seu cadastro."; erro.hidden = false; return; }
        try { await ocupado(ev.currentTarget, () => API.pedirUnidade({ sigla, cidade_uf: cidade, regiao })); fechar(); E.perfil = await API.meuPerfil(); desenhar(); aviso("Pedido de acesso enviado ao time."); }
        catch (e) { erro.textContent = API.traduzir(e); erro.hidden = false; }
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
      if (b && !norm([p.id, p.sigla, p.solicitante_nome, p.cidade_uf, segmentosDe(p), cidadesDe(p), p.empresas, p.responsavel].join(" ")).includes(b)) return false;
      return true;
    });
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Pedidos</h1><p>Pedidos de leads feitos pelas unidades.</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      <div class="filtros">
        <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Unidade, representante, segmento, cidade ou responsável"></div>
        <div class="campo"><label for="f-sit">Situação</label><select id="f-sit" data-filtro="situacao"><option value="abertos"${E.f.situacao === "abertos" ? " selected" : ""}>Aguardando o time</option><option value=""${!E.f.situacao ? " selected" : ""}>Todas</option>${opcoes(L.situacoesPedido, E.f.situacao)}</select></div>
        <div class="campo"><label for="f-reg">Região</label><select id="f-reg" data-filtro="regiao">${opcoes(L.regioes, E.f.regiao, "Todas")}</select></div>
      </div>
      ${lista.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Pedido</th><th>Data</th><th>Previsão</th><th>Unidade</th><th>Representante</th><th>Segmentos e cidades</th><th>Situação</th><th>Responsável</th><th>Leads</th></tr></thead>
        <tbody>${lista.map(p => {
          const atraso = ["Nova", "Em extração"].includes(p.situacao) && p.previsao && p.previsao < new Date().toISOString().slice(0, 10);
          return `<tr class="clicavel" data-pedido="${esc(p.id)}">
          <td>${esc(p.id)}</td><td>${data(p.criada_em)}<div class="sec">${dias(p.criada_em) ? "há " + dias(p.criada_em) + " dia(s)" : "hoje"}</div></td>
          <td${atraso ? ' style="color:var(--danger);font-weight:600"' : ""}>${data(p.previsao)}${atraso ? '<div class="sec">atrasado</div>' : ""}</td>
          <td><b>${esc(rotulo(p.sigla))}</b><div class="sec">${esc(p.cidade_uf)} · ${esc(p.regiao)}</div></td>
          <td>${esc(p.solicitante_nome)}<div class="sec">${esc(foneBonito(perfilDe(p.solicitante).celular || ""))}</div></td>
          <td>${esc(segmentosDe(p))}${cidadesDe(p) ? `<div class="sec">Cidades: ${esc(cidadesDe(p))}</div>` : ""}${p.empresas ? `<div class="sec">Empresas: ${esc(p.empresas.slice(0, 60))}</div>` : ""}</td>
          <td>${chipSituacao(p.situacao)}</td><td>${esc(p.responsavel || "–")}</td><td>${contagem(p)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>` : `<div class="vazio"><h2>Nenhum pedido aguardando</h2><p>Quando uma unidade pedir leads, o pedido aparece aqui. Mude a situação para ver os anteriores.</p></div>`}`;
  }

  function mensagemPedido(p, tipo) {
    const nome = primeiroNome(p.solicitante_nome);
    const ls = E.leads.filter(l => l.solicitacao_id === p.id);
    const abertos = ls.filter(trava).length;
    if (tipo === "enviada") return `Olá, ${nome}! Os leads de ${segmentosDe(p)} da unidade ${p.sigla} já estão no Portal de Leads: ${urlPortal()}\nAtualize o status de cada contato por lá. Quando nenhum lead estiver em Novo ou Prospecção, você pode pedir uma nova base.`;
    if (tipo === "cobrar") return `Olá, ${nome}! A unidade ${p.sigla} tem ${abertos} lead(s) em Novo ou Prospecção no Portal de Leads: ${urlPortal()}\nAtualize os contatos para liberar uma nova base.`;
    if (tipo === "sem") return `Olá, ${nome}! Não encontramos leads de ${segmentosDe(p)} para a unidade ${p.sigla}. Faça um novo pedido no portal com outros segmentos, cidades ou com o CNPJ/CNAE das empresas: ${urlPortal()}`;
    return `Olá, ${nome}! Recebemos o pedido de leads da unidade ${p.sigla} (${segmentosDe(p)}). A previsão de entrega é ${sexta(p.previsao)}.`;
  }

  function janelaPedidoTime(id) {
    const p = E.pedidos.find(x => x.id === id);
    if (!p) return;
    const rep = perfilDe(p.solicitante);
    const ls = E.leads.filter(l => l.solicitacao_id === p.id);
    const tipoMsg = ["Enviada", "Concluída"].includes(p.situacao) ? (ls.some(trava) ? "cobrar" : "enviada") : p.situacao === "Sem leads" ? "sem" : "recebido";
    const linkZap = zap(rep.celular, mensagemPedido(p, tipoMsg));
    const rotuloZap = { cobrar: "Cobrar retorno no WhatsApp", enviada: "Avisar no WhatsApp", sem: "Avisar no WhatsApp", recebido: "Avisar que recebemos" }[tipoMsg];
    abrir(`
      <div class="janela-topo"><div><h2>Pedido ${esc(p.id)} · ${esc(rotulo(p.sigla))}</h2><p>${data(p.criada_em)}, ${esc(p.solicitante_nome || "")}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <dl class="dados">
          <dt>Situação</dt><dd>${chipSituacao(p.situacao)}</dd>
          <dt>Segmentos</dt><dd>${esc(segmentosDe(p))}</dd>
          <dt>Cidades de interesse</dt><dd>${esc(cidadesDe(p) || "–")}</dd>
          ${p.empresas ? `<dt>Empresas indicadas</dt><dd style="white-space:pre-line">${esc(p.empresas)}</dd>` : ""}
          <dt>Unidade</dt><dd>${esc(p.cidade_uf)}, ${esc(p.regiao)}</dd>
          <dt>Representante</dt><dd>${esc(p.solicitante_nome)}<br><span class="sec">${esc(rep.email || "")} ${esc(foneBonito(rep.celular || ""))}</span></dd>
          <dt>Leads</dt><dd>${ls.length ? `${ls.length} de ${MAX} enviados, ${ls.filter(final).length} trabalhados` : "Nenhum lead enviado"}${p.enviada_em ? ` (enviados em ${data(p.enviada_em)})` : ""}</dd>
        </dl>
        <div class="contatos">
          ${linkZap ? `<a class="btn btn-zap btn-p" href="${esc(linkZap)}" target="_blank" rel="noopener">${rotuloZap}</a>` : ""}
          <button class="btn btn-p btn-primario" id="pt-importar"${ls.length >= MAX ? ` disabled title="Este pedido já tem ${MAX} leads"` : ""}>${ls.length ? "Importar mais leads" : "Importar leads"}</button>
          ${p.situacao === "Nova" ? `<button class="btn btn-p" id="pt-assumir">Assumir pedido</button>` : ""}
        </div>
        <div class="grade-2">
          <div class="campo"><label for="pt-sit">Situação</label><select id="pt-sit">${opcoes(L.situacoesPedido, p.situacao)}</select></div>
          <div class="campo"><label for="pt-prev">Previsão de entrega</label><input id="pt-prev" type="date" value="${esc(p.previsao || "")}"></div>
        </div>
        <div class="campo"><label for="pt-resp">Responsável</label><input id="pt-resp" type="text" value="${esc(p.responsavel || "")}" placeholder="${esc(E.perfil.nome)}"></div>
        <div class="campo"><label for="pt-obs">Observação para a unidade</label><textarea id="pt-obs" placeholder="Aparece para o representante em Meus pedidos">${esc(p.observacao_time || "")}</textarea></div>
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
        const dados = { situacao: sit, previsao: j.querySelector("#pt-prev").value || p.previsao, responsavel: j.querySelector("#pt-resp").value.trim() || null, observacao_time: j.querySelector("#pt-obs").value.trim() || null };
        if (sit === "Enviada" && !p.enviada_em) dados.enviada_em = true;
        if (["Enviada", "Concluída"].includes(sit) && !ls.length) { aviso("Importe os leads antes de marcar como Enviada.", true); return; }
        if (sit === "Concluída" && ls.some(trava)) { aviso("Ainda há leads em Novo ou Prospecção. A situação muda sozinha quando a unidade atualizar todos.", true); return; }
        salvar(dados, "Pedido salvo.", ev.currentTarget);
      });
      const assumir = j.querySelector("#pt-assumir");
      if (assumir) assumir.addEventListener("click", (ev) => salvar({ situacao: "Em extração", responsavel: p.responsavel || E.perfil.nome }, "Pedido assumido.", ev.currentTarget));
      j.querySelector("#pt-importar").addEventListener("click", () => janelaImportar(p.id));
      const apagar = j.querySelector("#pt-apagar");
      if (apagar) apagar.addEventListener("click", async (ev) => {
        if (!confirm(`Apagar os ${ls.length} leads do pedido ${p.id}? Os status preenchidos pela unidade também serão apagados.`)) return;
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
    const espaco = MAX - E.leads.filter(l => l.solicitacao_id === p.id).length;
    let linhas = [], cab = [], mapa = {};
    const desenharImport = (j) => {
      const corpo = j.querySelector("#imp-mapa");
      if (!cab.length) { corpo.innerHTML = ""; return; }
      const montar = () => linhas.map(r => {
        const v = (c) => mapa[c] >= 0 ? String(r[mapa[c]] == null ? "" : r[mapa[c]]).trim() : "";
        const cidade = v("cidade"), uf = v("uf");
        return { empresa: v("empresa"), cnpj: v("cnpj") || null, segmento: v("segmento") || null,
          cidade_uf: [cidade, uf && !cidade.includes("/") ? uf : ""].filter(Boolean).join("/") || null,
          contato: v("contato") || null, telefone: v("telefone") || null, email: v("email") || null };
      }).filter(x => x.empresa);
      const todos = montar();
      const prontos = todos.slice(0, espaco);
      corpo.innerHTML = `
        <p class="sub" style="margin:0 0 10px">Confira qual coluna da planilha vai para cada campo.</p>
        <div class="mapa">${CAMPOS.map(([c, rot]) => `<div class="campo"><label for="m-${c}">${rot}${c === "empresa" ? " (obrigatório)" : ""}</label>
          <select id="m-${c}" data-mapa="${c}"><option value="-1">Não usar</option>${cab.map((h, i) => `<option value="${i}"${mapa[c] === i ? " selected" : ""}>${esc(h || "Coluna " + (i + 1))}</option>`).join("")}</select></div>`).join("")}</div>
        <p style="margin:6px 0 8px"><b>${prontos.length}</b> leads prontos para enviar a ${esc(rotuloLongo(p.sigla))}${linhas.length - todos.length ? ` (${linhas.length - todos.length} linhas sem nome de empresa serão ignoradas)` : ""}.</p>
        ${todos.length > espaco ? `<div class="erro-form">A planilha tem ${todos.length} empresas, mas cada pedido aceita até ${MAX} leads${espaco < MAX ? ` (ainda cabem ${espaco})` : ""}. Só as ${espaco} primeiras serão enviadas.</div>` : ""}
        <div class="tabela-wrap"><table class="previa"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Cidade/UF</th><th>Telefone</th><th>E-mail</th></tr></thead>
          <tbody>${prontos.slice(0, 10).map(x => `<tr><td>${esc(x.empresa)}</td><td>${esc(x.cnpj)}</td><td>${esc(x.cidade_uf)}</td><td>${esc(foneBonito(x.telefone))}</td><td>${esc(API.limparEmail(x.email))}</td></tr>`).join("")}</tbody></table></div>`;
      corpo.querySelectorAll("[data-mapa]").forEach(s => s.addEventListener("change", () => { mapa[s.dataset.mapa] = Number(s.value); desenharImport(j); }));
      const enviar = j.querySelector("#imp-enviar");
      enviar.disabled = !prontos.length;
      enviar.textContent = prontos.length ? `Enviar ${prontos.length} leads para ${rotulo(p.sigla)}` : "Enviar leads";
      enviar.onclick = async (ev) => {
        try {
          await ocupado(ev.currentTarget, () => API.incluirLeads(p.id, prontos, { situacao: "Enviada", responsavel: p.responsavel || E.perfil.nome, ...(p.enviada_em ? {} : { enviada_em: true }) }));
          await recarregar();
          const atualizado = E.pedidos.find(x => x.id === p.id);
          const link = zap(perfilDe(p.solicitante).celular, mensagemPedido(atualizado, "enviada"));
          abrir(`<div class="janela-topo"><div><h2>Leads enviados</h2><p>${prontos.length} leads já aparecem para ${esc(rotuloLongo(p.sigla))}.</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
            <div class="janela-corpo"><p>Avise o representante para ele começar os contatos.</p></div>
            <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button>${link ? `<a class="btn btn-zap" href="${esc(link)}" target="_blank" rel="noopener">Avisar no WhatsApp</a>` : ""}</div>`);
        } catch (e) { aviso(API.traduzir(e), true); }
      };
    };

    abrir(`
      <div class="janela-topo"><div><h2>Importar leads · pedido ${esc(p.id)}</h2><p>${esc(rotuloLongo(p.sigla))}, ${esc(segmentosDe(p))}${cidadesDe(p) ? " · " + esc(cidadesDe(p)) : ""}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="imp-arq">Planilha exportada da Leads2b</label><input id="imp-arq" type="file" accept=".xlsx,.xls,.csv"><span class="dica">Excel ou CSV. A primeira linha precisa ter os nomes das colunas. Cabem ${espaco} lead(s) neste pedido.</span></div>
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
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Leads</h1><p>${E.leads.length} leads enviados para ${lojas.length} unidade(s).</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button><button class="btn" data-acao="exportar">Exportar Excel</button></div></div>
      <div class="filtros">
        <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Empresa, CNPJ, contato ou telefone"></div>
        <div class="campo"><label for="f-reg">Região</label><select id="f-reg" data-filtro="regiao">${opcoes(L.regioes, E.f.regiao, "Todas")}</select></div>
        <div class="campo"><label for="f-loja">Unidade</label><select id="f-loja" data-filtro="loja">${opcoes(lojas, E.f.loja, "Todas")}</select></div>
        <div class="campo"><label for="f-status">Status</label><select id="f-status" data-filtro="status">${opcoes(NOMES_STATUS, E.f.status, "Todos")}</select></div>
        ${seletorVista()}
      </div>
      ${E.leads.length ? (E.vista === "kanban" ? quadro(lista) : tabelaLeads(lista)) : `<div class="vazio"><h2>Nenhum lead enviado ainda</h2><p>Abra um pedido e importe a planilha da Leads2b para enviar os leads à unidade.</p><button class="btn btn-primario" data-acao="irPedidos">Ver pedidos</button></div>`}`;
  }

  function exportarLeads() {
    if (!window.XLSX) { aviso("A exportação não carregou. Recarregue a página e tente de novo.", true); return; }
    const linhas = filtrarLeads(E.leads).map(l => {
      const p = pedidoDe(l);
      return { "Pedido": l.solicitacao_id, "Unidade": l.sigla, "Região": p.regiao || "", "Representante": p.solicitante_nome || "", "Empresa": l.empresa, "CNPJ": l.cnpj || "",
        "Segmento": l.segmento || "", "Cidade/UF": l.cidade_uf || "", "Contato": l.contato || "", "Telefone": foneBonito(l.telefone), "E-mail": API.limparEmail(l.email),
        "Status": l.status, "Tem contato válido?": l.contato_valido || "", "Data do contato": data(l.data_contato), "Atualizado em": data(l.atualizado_em) };
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-${hojeISO()}.xlsx`);
  }

  // ------------------------------------------------------------------
  // Time: cadastros e unidades
  // ------------------------------------------------------------------
  function telaCadastros() {
    const b = norm(E.f.busca);
    const unidadesDe = (id) => E.acessos.filter(a => a.uid === id);
    const unidadeInfo = (sigla) => E.unidades.find(u => u.sigla === sigla) || {};
    const contar = (s) => E.perfis.filter(p => p.situacao === s).length;
    const lista = E.perfis.filter(p => p.situacao === E.f.cadastro && (!b || norm([p.nome, p.email, unidadesDe(p.id).map(a => a.sigla).join(" ")].join(" ")).includes(b)));
    const extras = E.acessos.filter(a => a.situacao === "pendente" && !a.principal && perfilDe(a.uid).situacao === "aprovado");
    const msg = (p) => p.situacao === "aprovado"
      ? `Olá, ${primeiroNome(p.nome)}! Seu acesso ao Portal de Leads foi liberado. Entre em ${urlPortal()} com seu e-mail e a senha que você criou.`
      : !p.emailVerificado
        ? `Olá, ${primeiroNome(p.nome)}! Recebemos seu cadastro no Portal de Leads. Falta confirmar seu e-mail: abra a mensagem do Portal de Leads (veja também o lixo eletrônico) e clique no link.`
        : `Olá, ${primeiroNome(p.nome)}! Recebemos seu cadastro no Portal de Leads e já estamos conferindo.`;
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Cadastros</h1><p>Confira se a sigla no começo do e-mail é da unidade da pessoa antes de aprovar.</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      ${extras.length ? `<section class="bloco" style="margin-bottom:18px"><h2>Pedidos de acesso a outras unidades</h2>
        <div class="tabela-wrap" style="border:0"><table><thead><tr><th>Pessoa</th><th>Unidade pedida</th><th>Unidades que já tem</th><th>Ações</th></tr></thead><tbody>
        ${extras.map(a => { const u = unidadeInfo(a.sigla); return `<tr><td><b>${esc(a.nome)}</b><div class="sec">${esc(a.email)}</div></td>
          <td><b>${esc(rotulo(a.sigla))}</b><div class="sec">${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}</div></td>
          <td>${esc(unidadesDe(a.uid).filter(x => x.situacao === "aprovado").map(x => x.sigla).join(", "))}</td>
          <td><div class="acoes"><button class="btn btn-p btn-primario" data-acao="aprovarUnidade" data-id="${esc(a.id)}">Liberar</button><button class="btn btn-p btn-perigo" data-acao="recusarUnidade" data-id="${esc(a.id)}">Recusar</button></div></td></tr>`; }).join("")}
        </tbody></table></div></section>` : ""}
      <div class="filtros">
        <div class="pilulas" role="group" aria-label="Situação do cadastro">
          ${[["pendente", "Aguardando"], ["aprovado", "Aprovados"], ["recusado", "Recusados"]].map(([v, r]) => `<button data-pilula="cadastro" data-valor="${v}" aria-pressed="${E.f.cadastro === v}">${r} (${contar(v)})</button>`).join("")}
        </div>
        <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Nome, e-mail ou unidade"></div>
      </div>
      ${lista.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Nome</th><th>Unidades</th><th>Celular</th><th>Acesso</th><th>Cadastro</th><th>Ações</th></tr></thead>
        <tbody>${lista.map(p => {
          const eu = p.id === E.perfil.id;
          const link = zap(p.celular, msg(p));
          const us = unidadesDe(p.id);
          const siglaOk = p.cargo !== "Representante" || API.siglaDoEmail(p.email) === p.siglaPrincipal;
          return `<tr>
            <td><b>${esc(p.nome)}</b> <span class="etiqueta">${esc(p.cargo || "Representante")}</span><div class="sec">${esc(p.email)}</div>${p.situacao === "pendente" ? (p.emailVerificado ? `<span class="selo selo-ok">E-mail confirmado</span>` : `<span class="selo selo-alerta">E-mail não confirmado</span>`) : ""}</td>
            <td>${us.length ? us.map(a => { const u = unidadeInfo(a.sigla); return `<div><b>${esc(u.nome || a.sigla)}</b>${a.principal ? "" : " (extra)"} <span class="sec">${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}${a.situacao !== "aprovado" ? " · " + esc(a.situacao) : ""}</span></div>`; }).join("") : `<span class="sec">${p.papel === "time" || !p.siglaPrincipal ? "Time (sem unidade)" : "–"}</span>`}
              ${!siglaOk ? `<div class="sec" style="color:var(--danger)">A sigla não bate com o e-mail</div>` : ""}</td>
            <td>${esc(foneBonito(p.celular || ""))}</td>
            <td>${p.papel === "time" ? "Time (vê tudo)" : "Só as próprias unidades"}</td><td>${data(p.criadoEm)}</td>
            <td><div class="acoes">
              ${p.situacao !== "aprovado" ? `<button class="btn btn-p btn-primario" data-acao="aprovar" data-id="${esc(p.id)}"${!p.emailVerificado ? ' disabled title="Aprove depois que a pessoa confirmar o e-mail"' : ""}>Aprovar</button>` : ""}
              ${p.situacao !== "recusado" && !eu ? `<button class="btn btn-p btn-perigo" data-acao="recusar" data-id="${esc(p.id)}">${p.situacao === "aprovado" ? "Bloquear" : "Recusar"}</button>` : ""}
              ${p.situacao === "aprovado" && !eu ? (p.papel === "time" ? `<button class="btn btn-p" data-acao="tornarRep" data-id="${esc(p.id)}">Tornar representante</button>` : `<button class="btn btn-p" data-acao="tornarTime" data-id="${esc(p.id)}">Tornar time</button>`) : ""}
              ${p.situacao === "aprovado" && !eu ? `<button class="btn btn-p" data-acao="senha" data-id="${esc(p.id)}">Enviar nova senha</button>` : ""}
              ${link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
              ${!eu ? `<button class="btn btn-p btn-perigo-leve" data-acao="excluir" data-id="${esc(p.id)}">Excluir cadastro</button>` : ""}
            </div></td></tr>`;
        }).join("")}</tbody></table></div>`
      : `<div class="vazio"><h2>${E.f.cadastro === "pendente" ? "Nenhum cadastro aguardando" : "Nenhum cadastro aqui"}</h2><p>${E.f.cadastro === "pendente" ? "Quando um representante criar o acesso, ele aparece aqui para aprovação." : "Mude a aba para ver os outros cadastros."}</p></div>`}`;
  }

  function janelaExcluir(id) {
    const p = E.perfis.find(x => x.id === id);
    const us = E.acessos.filter(a => a.uid === id).map(a => rotulo(a.sigla));
    const qtd = E.pedidos.filter(x => E.acessos.some(a => a.uid === id && a.sigla === x.sigla)).length;
    abrir(`
      <div class="janela-topo"><div><h2>Excluir cadastro</h2><p>${esc(p.nome)} · ${esc(p.email)}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <p><b>Sai do portal:</b> o cadastro da pessoa e o acesso ${us.length ? "a " + esc(us.join(", ")) : "às unidades"}. Ela não consegue mais ver nem mexer em nada.</p>
        <p><b>Continua salvo:</b> ${qtd === 1 ? "o pedido dessas unidades, com" : qtd ? `os ${qtd} pedidos dessas unidades, com` : "os pedidos,"} os leads e todo o histórico. Outra pessoa da mesma unidade continua vendo tudo.</p>
        <p class="sub">Se a pessoa voltar, ela refaz o cadastro com o mesmo e-mail e o time aprova de novo.</p>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-perigo" id="x-ok">Excluir cadastro</button></div>`,
    (j) => {
      j.querySelector("#x-ok").addEventListener("click", async (ev) => {
        try { await ocupado(ev.currentTarget, () => API.excluirCadastro(id)); fechar(); await recarregar(); aviso("Cadastro excluído. Os pedidos e leads continuam salvos."); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }

  // ------------------------------------------------------------------
  // Time: painel
  // ------------------------------------------------------------------
  function barras(itens) {
    const max = Math.max(1, ...itens.map(i => i[1]));
    return itens.map(([rot, n, cor]) => `<div class="barra-linha"><span>${esc(rot)}</span><span class="trilho"><i style="width:${(n / max) * 100}%;background:${cor || "var(--blue)"}"></i></span><span class="num">${n}</span></div>`).join("");
  }

  function telaPainel() {
    const reg = E.f.regiao;
    const pedidos = E.pedidos.filter(p => !reg || p.regiao === reg);
    const ids = new Set(pedidos.map(p => p.id));
    const leads = E.leads.filter(l => ids.has(l.solicitacao_id));
    const aguardando = pedidos.filter(p => ["Nova", "Em extração"].includes(p.situacao)).length;
    const comRetorno = leads.filter(l => l.status !== "Novo").length;
    const parados = leads.filter(parado).length;
    const embarques = leads.filter(l => l.status === "Embarque iniciado").length;
    const pct = leads.length ? Math.round((comRetorno / leads.length) * 100) : 0;

    const porLoja = {};
    leads.forEach(l => {
      const k = l.sigla, p = pedidoDe(l);
      porLoja[k] = porLoja[k] || { sigla: k, regiao: p.regiao, rep: p.solicitante_nome, total: 0, trab: 0, par: 0, emb: 0, ret: 0 };
      const o = porLoja[k]; o.total++; if (final(l)) o.trab++; if (parado(l)) o.par++; if (l.status === "Embarque iniciado") o.emb++; if (l.status !== "Novo") o.ret++;
    });
    const lojas = Object.values(porLoja).sort((a, b) => b.par - a.par || (b.total - b.trab) - (a.total - a.trab) || b.total - a.total);

    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Painel</h1><p>Retorno das unidades sobre os leads enviados.</p></div>
        <div class="acoes"><div class="campo" style="margin:0;min-width:180px"><select aria-label="Região" data-filtro="regiao">${opcoes(L.regioes, reg, "Todas as regiões")}</select></div><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      <div class="indicadores">
        <div class="indicador">${icone("pedido")}<div class="valor">${aguardando}</div><div class="rotulo">Pedidos aguardando o time</div></div>
        <div class="indicador">${icone("leads")}<div class="valor">${leads.length}</div><div class="rotulo">Leads enviados</div></div>
        <div class="indicador">${icone("retorno")}<div class="valor">${pct}%</div><div class="rotulo">Leads com retorno da unidade</div></div>
        <div class="indicador${parados ? " atencao" : ""}">${icone("alerta")}<div class="valor">${parados}</div><div class="rotulo">Leads parados em Novo ou Prospecção há mais de ${PRAZO} dias</div></div>
        <div class="indicador">${icone("fechado")}<div class="valor">${embarques}</div><div class="rotulo">Embarques iniciados</div></div>
      </div>
      <div class="paineis">
        <section class="bloco"><h2>Leads por status</h2>${barras(STATUS.map(s => [s.nome, leads.filter(l => l.status === s.nome).length, s.cor]))}</section>
        <section class="bloco"><h2>Pedidos por região</h2>${barras(L.regioes.map(r => [r, E.pedidos.filter(p => p.regiao === r && (!reg || r === reg)).length]))}</section>
      </div>
      <section class="bloco" style="padding:0;overflow:hidden">
        <h2 style="padding:18px 20px 0">Por unidade</h2>
        ${lojas.length ? `<div class="tabela-wrap" style="border:0;border-radius:0"><table>
          <thead><tr><th>Unidade</th><th>Região</th><th>Representante</th><th>Leads</th><th>Trabalhados</th><th>Parados</th><th>Embarques</th><th>Com retorno</th></tr></thead>
          <tbody>${lojas.map(o => `<tr><td><b>${esc(rotulo(o.sigla))}</b></td><td>${esc(o.regiao || "")}</td><td>${esc(o.rep || "")}</td><td>${o.total}</td><td>${o.trab}</td>
            <td${o.par ? ' style="color:var(--danger);font-weight:600"' : ""}>${o.par}</td><td>${o.emb}</td><td>${Math.round((o.ret / o.total) * 100)}%</td></tr>`).join("")}</tbody></table></div>`
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
    const us = p.unidades || [];
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Minha conta</h1><p>Para corrigir nome ou celular, fale com o time de ${esc(TIME)}.</p></div></div>
      <div class="paineis">
        <section class="bloco"><h2>Meus dados</h2>
          <dl class="dados">
            <dt>Nome</dt><dd>${esc(p.nome)}</dd><dt>E-mail</dt><dd>${esc(p.email)}</dd><dt>Celular</dt><dd>${esc(foneBonito(p.celular || ""))}</dd>
            <dt>Cargo</dt><dd>${esc(p.cargo || "Representante")}</dd>
            <dt>Acesso</dt><dd>${p.papel === "time" ? "Time de " + esc(TIME) : "Unidades"}</dd>
          </dl>
          ${!ehTime() ? `<h2 style="margin-top:18px">Minhas unidades</h2>
            <div class="tabela-wrap"><table><thead><tr><th>Unidade</th><th>Cidade/UF</th><th>Região</th><th>Situação</th></tr></thead><tbody>
            ${us.map(u => `<tr><td><b>${esc(rotulo(u.sigla))}</b>${u.principal ? "" : " (extra)"}</td><td>${esc(u.cidade_uf || "")}</td><td>${esc(u.regiao || "")}</td><td>${u.acesso === "aprovado" ? "Liberada" : u.acesso === "recusado" ? "Não liberada" : "Aguardando o time"}</td></tr>`).join("")}
            </tbody></table></div>
            ${us.length < MAX_UNID ? `<button class="btn" style="margin-top:12px" data-acao="pedirUnidade">+ Pedir acesso a outra unidade</button>` : ""}` : ""}
        </section>
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
