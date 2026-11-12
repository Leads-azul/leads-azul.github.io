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
  // Time de Inside Sales trabalha pedidos e leads; administrador também aprova cadastros, muda acessos e apaga.
  const ehTime = () => E.perfil && ["time", "admin"].includes(E.perfil.papel);
  const ehAdmin = () => E.perfil && E.perfil.papel === "admin";
  const PAPEL = { admin: "Administrador", time: "Time", representante: "Representante" };
  const trava = (l) => TRAVA.has(l.status);
  const final = (l) => !trava(l);
  // Lead com próximo contato marcado (hoje ou depois) não conta como parado.
  const parado = (l) => trava(l) && dias(l.atualizado_em) > PRAZO && !(l.retorno && l.retorno >= hojeISO());
  const MOTIVOS = L.motivosPerda || [];
  const QUALI = new Set(L.statusQualificacao || []);
  const N_DECIDIR = L.tentativasParaDecidir || 3;
  const somaDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const proximaSegunda = () => { const hoje = new Date().getDay(); return somaDias(((8 - hoje) % 7) || 7); };
  const motivoDe = (l) => l.motivo === "Outro motivo" ? (l.motivo_outro || "Outro motivo") : (l.motivo || "");
  const tentativasDe = (l) => Number(l.tentativas) || 0;
  const retornoDevido = (l) => !!l.retorno && l.retorno <= hojeISO();
  const tentarDevido = (l) => l.status === "Sem interesse" && !!l.tentar_em && l.tentar_em <= hojeISO();
  const paraHoje = (l) => retornoDevido(l) || tentarDevido(l);
  const decidir = (l) => trava(l) && tentativasDe(l) >= N_DECIDIR;
  const haDias = (v) => { const d = dias(v); return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`; };
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

  // ---- Contatos completos (Leads2b): telefones, e-mails, redes, endereço ----
  const foneTxt = (n) => API.foneTexto(API.normalizarTelefone(n) ? API.normalizarTelefone(n).n : n);
  const listaCel = (v) => String(v || "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o"]);
  const SIGLAS = new Set(["ltda", "me", "epp", "eireli", "s/a", "sa", "s.a.", "ss", "cia", "ltda.", "s/s"]);
  // "COMPACTA PRINT LIMITADA" -> "Compacta Print Limitada". Só mexe em texto todo em maiúsculas.
  function titulo(v) {
    v = String(v || "").trim();
    if (!v || v !== v.toUpperCase()) return v;
    return v.toLowerCase().split(/(\s+)/).map((p, i) => SIGLAS.has(p) ? p.toUpperCase() : (i && MINUSCULAS.has(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join("");
  }
  const cnpjBonito = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : String(v || "").trim(); };
  const cepBonito = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
  const cnaeBonito = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 7 ? `${d.slice(0, 4)}-${d[4]}/${d.slice(5)}` : d; };
  const limparLink = (v) => { const u = String(v || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, ""); return u || null; };
  const linkDe = (v) => v ? "https://" + String(v).replace(/^https?:\/\//i, "") : "";
  // DDD mais comum entre os telefones = a cidade da empresa (os outros costumam ser filiais).
  function dddBase(tels) {
    const c = {};
    tels.filter(t => t.t !== "0800").forEach(t => { const d = t.n.slice(0, 2); c[d] = (c[d] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "";
  }
  const ordemTel = (t, base) => (t.errado ? 10 : 0) + (t.t === "cel" ? (t.n.startsWith(base) ? 0 : 1) : t.t === "fixo" ? (t.n.startsWith(base) ? 2 : 3) : 4);
  // Lista de telefones do lead (leads antigos só têm "telefone"), na ordem do mais provável para o menos provável.
  function telefonesDe(l) {
    let ts = Array.isArray(l.telefones) && l.telefones.length ? l.telefones : [API.normalizarTelefone(l.telefone)].filter(Boolean);
    if (!ts.length && API.limparTelefone(l.telefone)) ts = [{ n: API.limparTelefone(l.telefone), t: "fixo" }];
    const err = new Set(l.tel_errados || []), base = dddBase(ts);
    return ts.map(t => ({ ...t, errado: err.has(t.n), local: t.t !== "0800" && t.n.startsWith(base), base })).sort((a, b) => ordemTel(a, base) - ordemTel(b, base));
  }
  const emailsDe = (l) => Array.isArray(l.emails) && l.emails.length ? l.emails : [API.limparEmail(l.email)].filter(Boolean);
  const DDD_UF = { 11: "SP", 12: "SP", 13: "SP", 14: "SP", 15: "SP", 16: "SP", 17: "SP", 18: "SP", 19: "SP", 21: "RJ", 22: "RJ", 24: "RJ", 27: "ES", 28: "ES",
    31: "MG", 32: "MG", 33: "MG", 34: "MG", 35: "MG", 37: "MG", 38: "MG", 41: "PR", 42: "PR", 43: "PR", 44: "PR", 45: "PR", 46: "PR", 47: "SC", 48: "SC", 49: "SC",
    51: "RS", 53: "RS", 54: "RS", 55: "RS", 61: "DF", 62: "GO", 63: "TO", 64: "GO", 65: "MT", 66: "MT", 67: "MS", 68: "AC", 69: "RO", 71: "BA", 73: "BA", 74: "BA", 75: "BA", 77: "BA",
    79: "SE", 81: "PE", 82: "AL", 83: "PB", 84: "RN", 85: "CE", 86: "PI", 87: "PE", 88: "CE", 89: "PI", 91: "PA", 92: "AM", 93: "PA", 94: "PA", 95: "RR", 96: "AP", 97: "AM", 98: "MA", 99: "MA" };
  function porteTexto(l) {
    const UN = { M: " mi", K: " mil", B: " bi", "": "" };
    // "10M-30M" -> "10 a 30 mi"; "51-200" -> "51 a 200"
    const faixa = (v) => {
      const m = String(v).trim().match(/^(\d+(?:[.,]\d+)?)\s*([MKB]?)\s*-\s*(\d+(?:[.,]\d+)?)\s*([MKB]?)$/i);
      if (!m) return String(v).replace(/(\d)\s*([MKB])\b/gi, (x, d, u) => d + UN[u.toUpperCase()]).replace(/\+$/, " ou mais");
      const u1 = m[2].toUpperCase(), u2 = m[4].toUpperCase();
      return `${m[1]}${u1 !== u2 ? UN[u1] : ""} a ${m[3]}${UN[u2]}`;
    };
    const nf = Number(l.filiais) || 0;
    return [
      l.funcionarios && String(l.funcionarios).trim() !== "0" && (String(l.funcionarios).trim() === "1" ? "1 funcionário" : `${faixa(l.funcionarios)} funcionários`),
      l.faturamento && `faturamento presumido R$ ${faixa(l.faturamento)}`,
      ({ ME: "Microempresa", EPP: "Empresa de pequeno porte" })[String(l.porte || "").toUpperCase()],
      l.tipo_unidade && `${titulo(l.tipo_unidade)}${nf ? ` com ${nf} filia${nf > 1 ? "is" : "l"}` : ""}`
    ].filter(Boolean).join(" · ");
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
      <p class="sub">Preencha uma vez. Depois o time de ${esc(TIME)} confere seus dados e libera o acesso.</p>
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
        <button class="btn" data-demo="t1">Ver como administrador</button>
        <button class="btn" data-demo="t2">Ver como time de Inside Sales</button>
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
        try { await ocupado(ev.currentTarget, () => API.esqueciSenha(email)); aviso(`Se o e-mail tiver cadastro, enviamos um link para criar uma senha nova. Se não chegar em alguns minutos (veja também o lixo eletrônico), fale com o time de ${TIME}.`); }
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
          E.tela = null; E.cadastroNovo = true; iniciar();
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
    const recusado = ["recusado", "excluido"].includes(p.situacao);
    const faltaAcesso = p.situacao === "aprovado"; // aprovado, mas sem unidade liberada ou sem acesso de time
    const unid = (p.unidades || []).map(u => u.nome ? "da sua carteira" : "da unidade " + u.sigla).join(", ");
    $app.innerHTML = `
      <div class="carregando"><div class="vazio" style="max-width:520px">
        ${!recusado && E.cadastroNovo ? `<p class="selo selo-ok" style="margin:0 auto 10px">Cadastro realizado</p>` : ""}
        <h2>${recusado ? "Seu acesso não foi aprovado" : faltaAcesso ? "Cadastro aprovado, falta liberar o acesso" : E.cadastroNovo ? "Recebemos seu cadastro" : "Cadastro aguardando aprovação"}</h2>
        <p>${recusado
          ? `Fale com o time de ${esc(TIME)} para revisar o seu cadastro.`
          : faltaAcesso ? `Seu cadastro foi aprovado, mas o time de ${esc(TIME)} ainda precisa liberar ${p.cargo === "Inside Sales" ? "o seu acesso de time" : "a sua unidade"}. Assim que liberar, clique em “Já fui aprovado”.`
          : `O time de ${esc(TIME)} vai conferir seus dados e liberar o acesso${unid ? " " + esc(unid) : ""}. Você recebe um aviso pelo WhatsApp quando estiver pronto.`}</p>
        <div class="acoes" style="justify-content:center">
          <button class="btn" id="b-atualizar">Já fui aprovado</button>
          <button class="btn" id="b-celular">Alterar meu celular</button>
          <button class="btn" id="b-sair">Sair</button>
        </div>
        <p class="sub" style="margin-top:12px">Seu celular: ${esc(foneBonito(p.celular || "") || "não informado")}</p>
      </div></div>`;
    document.getElementById("b-atualizar").onclick = () => iniciar();
    document.getElementById("b-celular").onclick = () => janelaCelular();
    document.getElementById("b-sair").onclick = sair;
  }

  async function sair() { await API.sair(); E.perfil = null; E.tela = null; telaAcesso("entrar"); }

  // ------------------------------------------------------------------
  // Estrutura com menu lateral
  // ------------------------------------------------------------------
  function desenhar() {
    const time = ehTime();
    const pendentes = ehAdmin() ? E.perfis.filter(p => p.situacao === "pendente").length + E.acessos.filter(a => a.situacao === "pendente" && !a.principal && perfilDe(a.uid).situacao === "aprovado").length : 0;
    const novos = E.pedidos.filter(p => p.situacao === "Nova").length;
    const itens = time
      ? [["pedidos", "Pedidos", novos], ["leads", "Leads"], ["cadastros", "Cadastros", pendentes], ["painel", "Painel"], ["conta", "Minha conta"]]
      : [["leads", "Meus leads", E.leads.filter(paraHoje).length], ["pedidos", "Meus pedidos"], ["conta", "Minha conta"]];

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
            <div><div class="nome">${esc(E.perfil.nome)}</div><div class="papel">${time ? (ehAdmin() ? "Administrador · " : "Time de ") + esc(TIME) : `${E.perfil.cargo === "Executivo" ? "Executivo · " : ""}${n > 1 ? `${n} unidades` : esc(unidade() ? rotuloLongo(unidade().sigla) : "")}`}</div></div>
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
    m.querySelectorAll(".cartao[data-lead], .hoje-item[data-lead]").forEach(el => el.addEventListener("keydown", (ev) => {
      if (ev.target !== el) return;
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); janelaLead(el.dataset.lead); }
    }));
    m.querySelectorAll("[data-hoje]").forEach(b => b.addEventListener("click", () => janelaLead(b.dataset.id, { canal: b.dataset.hoje })));
    m.querySelectorAll("[data-adiar]").forEach(b => b.addEventListener("click", () => {
      const caixa = b.closest(".hoje-acoes");
      caixa.innerHTML = `<span class="sub">Adiar para:</span>${[["Amanhã", somaDias(1)], ["Em 3 dias", somaDias(3)], ["Próxima semana", proximaSegunda()]]
        .map(([t, d]) => `<button class="btn btn-p nao-abre" data-adiar-para="${d}" data-id="${esc(b.dataset.id)}">${t}</button>`).join("")}`;
      caixa.querySelectorAll("[data-adiar-para]").forEach(x => x.addEventListener("click", () => adiar(x.dataset.id, x.dataset.adiarPara)));
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
    aprovar: (b) => mudar(() => API.aprovarCadastro(b.dataset.id, b.dataset.papel), b.dataset.papel === "admin" ? "Aprovado como administrador." : b.dataset.papel === "time" ? "Aprovado como time." : "Cadastro aprovado."),
    editarPessoa: (b) => janelaEditarPessoa(b.dataset.id),
    meuCelular: () => janelaCelular(),
    recusar: (b) => mudar(() => API.atualizarPerfil(b.dataset.id, { situacao: "recusado" }), "Cadastro recusado."),
    papel: (b) => {
      const x = b.dataset.papel;
      const aviso1 = { admin: "Tornar administrador? A pessoa passa a aprovar cadastros, mudar acessos e excluir.", time: "Dar acesso de time? A pessoa passa a ver e trabalhar todos os pedidos e leads, sem gerenciar cadastros.", representante: "Voltar para representante? A pessoa passa a ver só as próprias unidades." }[x];
      if (confirm(aviso1)) mudar(() => API.atualizarPerfil(b.dataset.id, { papel: x }), `Acesso alterado para ${PAPEL[x].toLowerCase()}.`);
    },
    reativar: (b) => mudar(() => API.reativarCadastro(b.dataset.id), "Cadastro reativado. Ele está em Aguardando para aprovar."),
    aprovarUnidade: (b) => mudar(() => API.atualizarAcesso(b.dataset.id, "aprovado"), "Unidade liberada."),
    recusarUnidade: (b) => mudar(() => API.atualizarAcesso(b.dataset.id, "recusado"), "Unidade recusada."),
    senha: (b) => janelaSenha(b.dataset.id),
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
      if (b && !norm([l.empresa, l.fantasia, l.cnpj, l.contato, l.telefone, l.email, l.cidade_uf, l.sigla, (l.telefones || []).map(t => t.n).join(" "), (l.emails || []).join(" "), (l.socios || []).join(" ")].join(" ")).includes(b)
        && !(soDigitos(b).length >= 4 && soDigitos([l.cnpj, l.telefone, (l.telefones || []).map(t => t.n).join(" ")].join(" ")).includes(soDigitos(b)))) return false;
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
          ${etiquetasAgenda(l)}
          ${etiquetaTentativas(l)}
          ${l.data_contato && !tentativasDe(l) ? `<span class="etiqueta">Contato ${data(l.data_contato)}</span>` : ""}
          ${l.contato_valido === "Não" ? `<span class="etiqueta alerta">Sem contato válido</span>` : ""}
          ${parado(l) ? `<span class="etiqueta alerta">Parado há ${dias(l.atualizado_em)} dias</span>` : ""}
          ${l.status === "Sem interesse" && l.motivo ? `<span class="etiqueta">${esc(motivoDe(l))}</span>` : ""}
          ${l.volume && QUALI.has(l.status) ? `<span class="etiqueta">${esc(l.volume)}</span>` : ""}
          ${ehTime() && p.id ? `<span class="etiqueta">${esc(p.id)}</span>` : ""}
        </span>
      </div>`;
  }

  const dataCurta = (v) => v ? String(v).slice(0, 10).split("-").reverse().slice(0, 2).join("/") : "";
  function etiquetasAgenda(l) {
    const hoje = hojeISO();
    let t = "";
    if (l.retorno) {
      if (l.retorno < hoje) t += `<span class="etiqueta alerta">Retorno atrasado · ${dataCurta(l.retorno)}</span>`;
      else if (l.retorno === hoje) t += `<span class="etiqueta info">Retornar hoje${l.retorno_hora ? ", " + esc(l.retorno_hora) : ""}</span>`;
      else t += `<span class="etiqueta info-leve">Retornar ${dataCurta(l.retorno)}${l.retorno_hora ? ", " + esc(l.retorno_hora) : ""}</span>`;
    }
    if (l.status === "Sem interesse" && l.tentar_em) t += `<span class="etiqueta ${tentarDevido(l) ? "info" : "info-leve"}">Tentar de novo ${tentarDevido(l) ? "hoje" : "em " + dataCurta(l.tentar_em)}</span>`;
    return t;
  }
  function etiquetaTentativas(l) {
    const n = tentativasDe(l);
    if (!n) return "";
    if (decidir(l)) return `<span class="etiqueta atencao">${n} tentativas · decidir</span>`;
    return `<span class="etiqueta">${n} tentativa${n > 1 ? "s" : ""}${l.ultima_tentativa ? " · " + haDias(l.ultima_tentativa) : ""}</span>`;
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
            ${parado(l) ? `<div class="sec" style="color:var(--danger)">Parado há ${dias(l.atualizado_em)} dias</div>` : ""}
            ${etiquetasAgenda(l) ? `<div class="sec etiquetas-lista">${etiquetasAgenda(l)}</div>` : ""}</td>
          <td data-rotulo="Último contato">${data(l.data_contato)}${tentativasDe(l) ? `<div class="sec">${tentativasDe(l)} tentativa${tentativasDe(l) > 1 ? "s" : ""}</div>` : ""}</td>
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

  async function adiar(id, quando) {
    const l = E.leads.find(x => x.id === id);
    try {
      await API.atualizarLead(id, tentarDevido(l) && !retornoDevido(l) ? { tentar_em: quando } : { retorno: quando });
      await aposMudarLead(`${l.empresa}: próximo contato em ${data(quando)}.`);
    } catch (e) { aviso(API.traduzir(e), true); }
  }

  async function salvarStatus(id, status) {
    const l = E.leads.find(x => x.id === id);
    // Sem interesse pede o motivo: abre a ficha já com o status escolhido.
    if (status === "Sem interesse") { desenhar(); janelaLead(id, { status }); return; }
    const extra = l.status === "Sem interesse" ? { motivo: "", motivo_outro: "", tentar_em: "" } : {};
    if (status === "Contato inválido") Object.assign(extra, { retorno: "", retorno_hora: "", lembrete: "" });
    try {
      const novo = await API.atualizarLead(id, { status, data_contato: l.data_contato || (status !== "Novo" ? hojeISO() : null), ...extra });
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
  const ROTULO_HIST = { recebido: "⬇", status: "↻", contato_valido: "✓", whatsapp: "✆", email: "✉", ligacao: "☎", observacao: "✎", agenda: "◷", telefone: "⊘" };
  let desligarFicha = null; // tira os eventos da ficha anterior (volta para o portal, foco)

  // Ficha com tudo o que veio da Leads2b: empresa, internet, telefones, e-mails e sócios.
  function linhaTel(t, todos) {
    const tipo = { cel: "Celular", fixo: "Fixo", "0800": "0800" }[t.t] || "";
    const extra = todos && t.t !== "0800" && !t.local && t.base ? `<span class="sub">DDD ${esc(t.n.slice(0, 2))}${DDD_UF[t.n.slice(0, 2)] ? " · " + DDD_UF[t.n.slice(0, 2)] : ""}</span>` : todos && t.t === "0800" ? `<span class="sub">Costuma ser o SAC</span>` : "";
    if (t.errado) return `<div class="ct-linha errado"><span class="tipo t-${t.t}">${tipo}</span><b>${esc(foneTxt(t.n))}</b><span class="sub">Número errado</span>
      <span class="ct-acoes"><button type="button" class="link-mini" data-tel-errado="${esc(t.n)}">Desfazer</button></span></div>`;
    return `<div class="ct-linha"><span class="tipo t-${t.t}">${tipo}</span><b>${esc(foneTxt(t.n))}</b>${extra}
      <span class="ct-acoes">${t.t === "cel" ? `<button type="button" class="btn btn-p btn-zap btn-mini" data-tel-zap="${esc(t.n)}">WhatsApp</button>` : ""}<button type="button" class="btn btn-p btn-mini" data-tel-ligar="${esc(t.n)}">Ligar</button>
      ${todos ? `<button type="button" class="link-mini" data-tel-errado="${esc(t.n)}">Número errado</button>` : ""}</span></div>`;
  }
  function secaoTelefones(tels, todos) {
    if (!tels.length) return `<section class="ct" id="l-tels"></section>`;
    const conta = (t) => tels.filter(x => x.t === t && !x.errado).length;
    const resumo = [conta("cel") && `${conta("cel")} celular${conta("cel") > 1 ? "es" : ""}`, conta("fixo") && `${conta("fixo")} fixo${conta("fixo") > 1 ? "s" : ""}`, conta("0800") && `${conta("0800")} 0800`, tels.some(t => t.errado) && `${tels.filter(t => t.errado).length} errado(s)`].filter(Boolean).join(" · ");
    let corpo;
    if (todos) {
      const base = tels[0].base;
      const grupos = [
        ["Celulares", tels.filter(t => t.t === "cel" && !t.errado)],
        [`Fixos na cidade da empresa${base ? " · DDD " + base : ""}`, tels.filter(t => t.t === "fixo" && t.local && !t.errado)],
        ["Outras cidades, prováveis filiais", tels.filter(t => t.t === "fixo" && !t.local && !t.errado)],
        ["0800", tels.filter(t => t.t === "0800" && !t.errado)],
        ["Marcados como errados", tels.filter(t => t.errado)]
      ].filter(([, g]) => g.length);
      corpo = grupos.map(([nome, g]) => `<p class="ct-grupo">${esc(nome)} (${g.length})</p><div class="ct-lista">${g.map(t => linhaTel(t, true)).join("")}</div>`).join("")
        + `<p class="sub">“Número errado” risca o telefone para toda a unidade e fica no histórico. <button type="button" class="link-mini" data-tel-menos>Mostrar menos</button></p>`;
    } else {
      const visiveis = tels.filter(t => !t.errado).slice(0, 4);
      corpo = `<div class="ct-lista">${visiveis.map(t => linhaTel(t, false)).join("")}
        <button type="button" class="ct-mais" data-tel-todos>${tels.length > visiveis.length ? `Ver todos os ${tels.length} telefones` : "Ver por tipo e marcar número errado"}</button></div>`;
    }
    return `<section class="ct" id="l-tels"><div class="ct-topo"><h3>Telefones (${tels.length})</h3><span class="sub">${resumo}</span></div>${corpo}</section>`;
  }
  function fichaCompleta(l, tels, mails, telTodos) {
    const cnaes = l.cnaes || [];
    const endereco = l.endereco ? `${esc(l.endereco)}${l.bairro && !norm(l.endereco).includes(norm(l.bairro)) ? " · " + esc(l.bairro) : ""}<br>` : "";
    const local = [l.cidade_uf, l.cep && "CEP " + cepBonito(l.cep)].filter(Boolean).join(" · ");
    const mapa = l.endereco || l.cep ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([l.endereco, l.bairro, l.cidade_uf, cepBonito(l.cep)].filter(Boolean).join(", ")) : "";
    const links = [[l.site, "Site", l.site], [l.linkedin, "LinkedIn"], [l.instagram, "Instagram", l.instagram && "@" + String(l.instagram).split("/").filter(Boolean).pop()], [mapa, "Ver no mapa"]].filter(([u]) => u);
    const linhas = [
      ["CNPJ", l.cnpj && `${esc(l.cnpj)} <button type="button" class="link-mini" data-copiar="${esc(l.cnpj)}">Copiar</button>`],
      ["Segmento", l.segmento && esc(l.segmento)],
      ["Atividade", cnaes.length && `CNAE ${esc(cnaeBonito(cnaes[0]))}${cnaes.length > 1 ? ` <span class="sub">+ ${cnaes.length - 1} outro${cnaes.length > 2 ? "s" : ""}</span>` : ""}`],
      ["Porte", porteTexto(l) && esc(porteTexto(l))],
      [l.endereco ? "Endereço" : "Cidade/UF", (endereco + esc(local)) || ""],
      ["Contato", l.contato && esc(l.contato)],
      ["Sócios", (l.socios || []).length && esc(l.socios.join(", "))]
    ].filter(([, v]) => v);
    const emailsHtml = mails.length ? `<section class="ct"><div class="ct-topo"><h3>E-mails (${mails.length})</h3></div><div class="ct-lista">
        ${mails.map((m, i) => `<div class="ct-linha${i >= 3 ? " ct-escondido" : ""}"><b class="quebra">${esc(m)}</b><span class="ct-acoes"><button type="button" class="btn btn-p btn-mini" data-copiar="${esc(m)}">Copiar</button><button type="button" class="btn btn-p btn-mini" data-mail-usar="${esc(m)}">Mensagem pronta</button></span></div>`).join("")}
        ${mails.length > 3 ? `<button type="button" class="ct-mais" data-mail-todos>Ver os ${mails.length} e-mails</button>` : ""}</div></section>` : "";
    return {
      dados: `<dl class="dados">${linhas.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        ${links.length ? `<div class="ct-links">${links.map(([u, nome, txt]) => `<a href="${esc(linkDe(u))}" target="_blank" rel="noopener" class="ct-link">${esc(txt || nome)}</a>`).join("")}</div>` : ""}`,
      listas: `<div class="ct-listas">${secaoTelefones(tels, telTodos)}${emailsHtml}</div>`
    };
  }

  function janelaLead(id, op) {
    op = op || {};
    const l = E.leads.find(x => x.id === id);
    if (!l) return;
    if (desligarFicha) { desligarFicha(); desligarFicha = null; }
    const p = pedidoDe(l);
    const tels = telefonesDe(l), mails = emailsDe(l);
    const ativos = tels.filter(t => !t.errado);
    // Número e e-mail usados nos botões. Clicar num telefone ou e-mail da lista troca qual é usado.
    let tel = (ativos.find(t => t.t === "cel") || ativos[0] || {}).n || "";
    let email = mails[0] || "";
    const completo = tels.length > 1 || mails.length > 1 || l.site || l.linkedin || l.instagram || l.endereco || (l.socios || []).length;
    const ficha = completo ? fichaCompleta(l, tels, mails, !!op.telTodos) : null;
    const n = tentativasDe(l);
    const retomada = n >= 1;
    const statusInicial = op.status || l.status;
    let pendente = null; // ação aberta que espera a confirmação "Você enviou?"
    let motivo = l.motivo || "";
    let tentarEm = l.tentar_em || "";
    const prazos = [["Não", ""], ["Em 1 mês", somaDias(30)], ["Em 3 meses", somaDias(90)], ["Em 6 meses", somaDias(180)]];

    abrir(`
      <div class="janela-topo"><div><h2>${esc(l.empresa)}</h2><p>${l.fantasia && norm(l.fantasia) !== norm(l.empresa) ? `Nome fantasia: ${esc(l.fantasia)} · ` : ""}${esc(rotuloLongo(l.sigla))}${p.id ? `, pedido ${esc(p.id)} de ${data(p.criada_em)}` : ""}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        ${completo ? ficha.dados : `<dl class="dados">
          ${[["CNPJ", l.cnpj], ["Segmento", l.segmento], ["Cidade/UF", l.cidade_uf], ["Contato", l.contato], ["Telefone", tel ? foneTxt(tel) : l.telefone], ["E-mail", email || l.email]]
            .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}
        </dl>`}
        ${op.aposTentativa ? `<div class="ok-tentativa">Tentativa ${n} registrada. Marque abaixo o próximo contato.</div>` : ""}
        ${decidir(l) ? `<div class="decidir" id="l-decidir">
            <div class="decidir-topo"><b>${n} tentativas e o lead continua em ${esc(l.status)}</b>${l.ultima_tentativa ? `<span>Última ${haDias(l.ultima_tentativa)}</span>` : ""}</div>
            <p>Vale decidir o que fazer com este lead para não travar a próxima base.</p>
            <div class="acoes-linha">
              <button type="button" class="btn btn-p" data-decidir="tentar">Tentar mais uma vez</button>
              <button type="button" class="btn btn-p" data-decidir="sem">Marcar Sem interesse</button>
              <button type="button" class="btn btn-p" data-decidir="invalido">Marcar Contato inválido</button>
            </div></div>` : ""}
        <div class="contatos">
          ${tel ? `<button class="btn btn-zap btn-p" data-canal="whatsapp">${retomada ? "WhatsApp: mensagem de retomada" : "WhatsApp com mensagem pronta"}</button><button class="btn btn-p" data-canal="ligacao">Ligar</button>` : ""}
          ${email ? `<button class="btn btn-p" data-canal="email">${retomada ? "E-mail de retomada" : "E-mail com mensagem pronta"}</button>` : ""}
          ${n ? `<span class="sub tentativas-txt">${n} tentativa${n > 1 ? "s" : ""}${l.ultima_tentativa ? ", última " + haDias(l.ultima_tentativa) : ""}</span>` : ""}
        </div>
        <div id="l-compor"></div>
        <div class="confirma" id="l-confirma" hidden></div>
        ${completo ? ficha.listas : ""}
        <details class="dicas"><summary>Dicas de abordagem</summary>
          <dl>${(L.dicas || []).map(([q, r]) => `<dt>${esc(q)}</dt><dd>${esc(r)}</dd>`).join("")}</dl>
        </details>
        <form id="f-lead">
          <div class="grade-2">
            <div class="campo"><label for="l-status">Status</label><select id="l-status">${opcoes(NOMES_STATUS, statusInicial)}</select><span class="dica" id="l-desc">${esc(DESC[statusInicial] || "")}</span></div>
            <div class="campo"><label for="l-data">Data do contato</label><input id="l-data" type="date" value="${esc(l.data_contato || (op.status ? hojeISO() : ""))}"></div>
          </div>
          <div class="campo"><label for="l-valido">Tem contato válido?</label><select id="l-valido">${opcoes(["Sim", "Não"], l.contato_valido, "Selecione")}</select></div>

          <fieldset class="extra" id="l-bloco-motivo" hidden>
            <legend>Por que não teve interesse?</legend>
            <p class="sub">Escolha um motivo. Ajuda o time a pedir leads melhores na Leads2b.</p>
            <div class="opcoes-grade" role="group" aria-label="Motivo">
              ${MOTIVOS.map(m => `<button type="button" class="opcao" data-motivo="${esc(m)}" aria-pressed="${m === motivo}">${esc(m)}</button>`).join("")}
            </div>
            <div class="campo" id="l-outro-campo"${motivo === "Outro motivo" ? "" : " hidden"}><label for="l-outro">Qual foi o motivo?</label>
              <input id="l-outro" type="text" maxlength="200" value="${esc(l.motivo_outro || "")}" placeholder="Escreva o motivo em poucas palavras"></div>
            <div class="caixa-cinza">
              <b>Tentar de novo mais para frente?</b>
              <div class="pilulas-op">${prazos.map(([t, d]) => `<button type="button" class="pilula-op" data-tentar="${d}" aria-pressed="${d === tentarEm || (!d && !tentarEm)}">${t}</button>`).join("")}</div>
              <p class="sub" id="l-tentar-txt"></p>
            </div>
          </fieldset>

          <fieldset class="extra" id="l-bloco-quali" hidden>
            <legend>Dados da negociação (opcional)</legend>
            <div class="grade-3">
              <div class="campo"><label for="q-volume">Envios por mês</label><input id="q-volume" type="text" maxlength="120" value="${esc(l.volume || "")}" placeholder="Ex.: ~20 envios"></div>
              <div class="campo"><label for="q-destinos">Principais destinos</label><input id="q-destinos" type="text" maxlength="120" value="${esc(l.destinos || "")}" placeholder="Ex.: Sul e Nordeste"></div>
              <div class="campo"><label for="q-transp">Transportadora atual</label><input id="q-transp" type="text" maxlength="120" value="${esc(l.transportadora || "")}" placeholder="Ex.: Correios"></div>
            </div>
          </fieldset>

          <fieldset class="extra destaque" id="l-bloco-agenda" hidden>
            <legend>Próximo contato</legend>
            <div class="pilulas-op">
              ${[["Amanhã", somaDias(1)], ["Em 3 dias", somaDias(3)], ["Próxima semana", proximaSegunda()], ["Sem data", ""]].map(([t, d]) => `<button type="button" class="pilula-op" data-quando="${d}" aria-pressed="${(l.retorno || "") === d}">${t}</button>`).join("")}
            </div>
            <div class="grade-agenda">
              <div class="campo"><label for="ag-data">Data</label><input id="ag-data" type="date" value="${esc(l.retorno || "")}"></div>
              <div class="campo"><label for="ag-hora">Horário (opcional)</label><input id="ag-hora" type="time" value="${esc(l.retorno_hora || "")}"></div>
              <div class="campo"><label for="ag-lembrete">Lembrete para você</label><input id="ag-lembrete" type="text" maxlength="200" value="${esc(l.lembrete || "")}" placeholder="Ex.: perguntar pelo responsável de compras"></div>
            </div>
            <p class="sub">Com o próximo contato marcado, o lead não conta como parado e aparece em Para hoje no dia escolhido.</p>
          </fieldset>
          <div class="erro-form" id="l-erro" hidden></div>
        </form>
        <div class="hist"><h3>Histórico</h3><div id="l-hist"><p class="sub">Carregando…</p></div>
          <div class="campo" style="margin-top:12px"><textarea id="l-obs" rows="2" placeholder="Adicionar observação…"></textarea></div>
          <button class="btn btn-p" id="l-add-obs">+ Adicionar observação</button>
        </div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button><button class="btn btn-primario" id="l-salvar">Salvar</button></div>`,
    (j) => {
      const st = j.querySelector("#l-status"), dt = j.querySelector("#l-data"), vd = j.querySelector("#l-valido");
      const blocoMotivo = j.querySelector("#l-bloco-motivo"), blocoQuali = j.querySelector("#l-bloco-quali"), blocoAgenda = j.querySelector("#l-bloco-agenda");
      const agData = j.querySelector("#ag-data"), agHora = j.querySelector("#ag-hora"), agLembrete = j.querySelector("#ag-lembrete");
      const erro = j.querySelector("#l-erro");

      const mostrarBlocos = () => {
        blocoMotivo.hidden = st.value !== "Sem interesse";
        blocoQuali.hidden = !QUALI.has(st.value);
        blocoAgenda.hidden = ["Sem interesse", "Contato inválido"].includes(st.value);
      };
      const textoTentar = () => {
        j.querySelector("#l-tentar-txt").textContent = tentarEm
          ? `Em ${data(tentarEm)} o lead volta para Para hoje com o histórico completo. Ele não trava a base enquanto isso.`
          : "O lead fica em Sem interesse e não volta para a agenda.";
      };
      mostrarBlocos(); textoTentar();

      st.addEventListener("change", () => { j.querySelector("#l-desc").textContent = DESC[st.value] || ""; if (!dt.value && st.value !== "Novo") dt.value = hojeISO(); mostrarBlocos(); erro.hidden = true; });
      vd.addEventListener("change", () => {
        if (vd.value === "Não" && st.value !== "Contato inválido" && confirm("Sem contato válido. Mudar o status para \"Contato inválido\"?")) {
          st.value = "Contato inválido"; st.dispatchEvent(new Event("change"));
        }
      });

      // Motivo de Sem interesse e "tentar de novo".
      j.querySelectorAll("[data-motivo]").forEach(b => b.addEventListener("click", () => {
        motivo = b.dataset.motivo;
        j.querySelectorAll("[data-motivo]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        j.querySelector("#l-outro-campo").hidden = motivo !== "Outro motivo";
        if (motivo === "Outro motivo") j.querySelector("#l-outro").focus();
        erro.hidden = true;
      }));
      j.querySelectorAll("[data-tentar]").forEach(b => b.addEventListener("click", () => {
        tentarEm = b.dataset.tentar;
        j.querySelectorAll("[data-tentar]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        textoTentar();
      }));

      // Próximo contato: atalhos de data.
      const marcarAtalho = () => j.querySelectorAll("[data-quando]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.quando === agData.value)));
      j.querySelectorAll("[data-quando]").forEach(b => b.addEventListener("click", () => {
        agData.value = b.dataset.quando;
        if (!b.dataset.quando) { agHora.value = ""; agLembrete.value = ""; }
        marcarAtalho();
      }));
      agData.addEventListener("input", marcarAtalho);

      // Aviso de muitas tentativas.
      j.querySelectorAll("[data-decidir]").forEach(b => b.addEventListener("click", () => {
        const d = b.dataset.decidir;
        if (d === "tentar") { blocoAgenda.hidden = false; blocoAgenda.scrollIntoView({ block: "center", behavior: "smooth" }); agData.focus(); return; }
        st.value = d === "sem" ? "Sem interesse" : "Contato inválido";
        if (d === "invalido") vd.value = "Não";
        st.dispatchEvent(new Event("change"));
        (d === "sem" ? blocoMotivo : st).scrollIntoView({ block: "center", behavior: "smooth" });
      }));

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

      // Pergunta "Você enviou?" quando a pessoa volta para o portal. Cada envio ou ligação conta uma tentativa.
      const confirma = j.querySelector("#l-confirma");
      const perguntar = (canal) => {
        const pergunta = { whatsapp: "Você enviou a mensagem pelo <b>WhatsApp</b>?", email: "Você enviou o <b>e-mail</b>?", ligacao: "Você conseguiu <b>falar</b> com a empresa?" }[canal];
        const sim = { whatsapp: "Sim, enviei", email: "Sim, enviei", ligacao: "Sim, falei" }[canal];
        const nao = { whatsapp: "Não", email: "Não", ligacao: "Não atendeu" }[canal];
        confirma.innerHTML = `<span>${pergunta}</span><button class="btn btn-p btn-primario" data-r="sim">${sim}</button><button class="btn btn-p" data-r="nao">${nao}</button>`;
        confirma.hidden = false;
        confirma.querySelectorAll("[data-r]").forEach(b => b.addEventListener("click", async () => {
          const ok = b.dataset.r === "sim";
          const qual = canal === "email" ? (mails.length > 1 ? ` · ${email}` : "") : (tels.length > 1 ? ` · ${foneTxt(tel)}` : "");
          let texto = {
            whatsapp: ok ? (retomada ? "WhatsApp: mensagem de retomada enviada" : "WhatsApp: mensagem enviada") : null,
            email: ok ? (retomada ? "E-mail de retomada enviado" : "E-mail: proposta enviada") : null,
            ligacao: ok ? "Ligação: conseguiu falar" : "Ligação: não atendeu"
          }[canal];
          if (texto) texto += qual;
          confirma.hidden = true; pendente = null;
          if (!texto) return;
          try {
            const dados = {};
            if (l.status === "Novo") Object.assign(dados, { status: "Prospecção", data_contato: dt.value || hojeISO() });
            else if (!l.data_contato) dados.data_contato = hojeISO();
            // O contato de hoje foi feito: tira o lembrete vencido.
            if (retornoDevido(l)) Object.assign(dados, { retorno: "", retorno_hora: "", lembrete: "" });
            if (tentarDevido(l)) dados.tentar_em = "";
            await API.atualizarLead(id, dados, { canal, texto });
            await carregar(); desenhar();
            janelaLead(id, { aposTentativa: true });
          } catch (e) { aviso(API.traduzir(e), true); }
        }));
      };
      const aoVoltar = () => { if (pendente && document.visibilityState === "visible" && $janela.open) perguntar(pendente); };
      document.addEventListener("visibilitychange", aoVoltar);
      window.addEventListener("focus", aoVoltar);
      desligarFicha = () => { document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); };
      $janela.addEventListener("close", () => { if (desligarFicha) { desligarFicha(); desligarFicha = null; } }, { once: true });

      const compor = j.querySelector("#l-compor");
      const acionar = (canal) => {
        if (canal === "ligacao") { pendente = "ligacao"; location.href = tel.startsWith("0800") ? `tel:${tel}` : `tel:+55${tel}`; setTimeout(() => perguntar("ligacao"), 1500); return; }
        const M = L.mensagens;
        const assunto = preencher(retomada ? (M.emailRetomadaAssunto || M.emailAssunto) : M.emailAssunto, l);
        const corpo = preencher(canal === "email" ? (retomada ? (M.emailRetomada || M.email) : M.email) : (retomada ? (M.whatsappRetomada || M.whatsapp) : M.whatsapp), l);
        compor.innerHTML = `<div class="msg-prev">
            <div class="cab">${canal === "email" ? `<b>Para</b>${esc(email)}<br><b>Assunto</b><input id="m-assunto" value="${esc(assunto)}">` : `<b>Para</b>WhatsApp ${esc(foneTxt(tel))}`}</div>
            <textarea id="m-texto" rows="8">${esc(corpo)}</textarea></div>
          <div class="acoes" style="margin:8px 0 16px"><span class="sub" style="flex:1">${retomada ? `Mensagem de retomada (${n + 1}ª tentativa). ` : ""}Você pode ajustar o texto antes de abrir.</span>
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
        compor.scrollIntoView({ block: "center", behavior: "smooth" });
      };
      j.querySelectorAll("[data-canal]").forEach(b => b.addEventListener("click", () => acionar(b.dataset.canal)));

      // Lista de telefones e e-mails: usar outro número, copiar, ver todos, número errado.
      j.addEventListener("click", async (ev) => {
        const b = ev.target.closest("[data-tel-zap],[data-tel-ligar],[data-tel-errado],[data-tel-todos],[data-tel-menos],[data-mail-usar],[data-mail-todos],[data-copiar]");
        if (!b) return;
        ev.preventDefault();
        const d = b.dataset;
        if (d.telZap) { tel = d.telZap; acionar("whatsapp"); }
        else if (d.telLigar) { tel = d.telLigar; acionar("ligacao"); }
        else if (d.mailUsar) { email = d.mailUsar; acionar("email"); }
        else if (d.copiar) { try { await navigator.clipboard.writeText(d.copiar); aviso("Copiado."); } catch (e) { aviso("Não deu para copiar. Selecione e copie com Ctrl+C.", true); } }
        else if (d.telTodos !== undefined) { j.querySelector("#l-tels").outerHTML = secaoTelefones(tels, true); }
        else if (d.telMenos !== undefined) { j.querySelector("#l-tels").outerHTML = secaoTelefones(tels, false); j.querySelector("#l-tels").scrollIntoView({ block: "start", behavior: "smooth" }); }
        else if (d.mailTodos !== undefined) { j.querySelectorAll(".ct-escondido").forEach(x => x.classList.remove("ct-escondido")); b.remove(); }
        else if (d.telErrado) {
          const atual = new Set(l.tel_errados || []);
          if (atual.has(d.telErrado)) atual.delete(d.telErrado);
          else if (!confirm(`Marcar ${foneTxt(d.telErrado)} como número errado? Ele fica riscado para toda a unidade.`)) return;
          else atual.add(d.telErrado);
          try { await API.atualizarLead(id, { tel_errados: [...atual] }); await carregar(); desenhar(); janelaLead(id, { telTodos: true }); }
          catch (e) { aviso(API.traduzir(e), true); }
        }
      });

      j.querySelector("#l-salvar").addEventListener("click", async (ev) => {
        const falha = (msg) => { erro.textContent = msg; erro.hidden = false; erro.scrollIntoView({ block: "center", behavior: "smooth" }); };
        const dados = { status: st.value, data_contato: dt.value || null, contato_valido: vd.value || "" };
        if (st.value === "Sem interesse") {
          const outro = j.querySelector("#l-outro").value.trim();
          if (!motivo) return falha("Escolha o motivo de Sem interesse.");
          if (motivo === "Outro motivo" && !outro) return falha("Escreva qual foi o motivo.");
          Object.assign(dados, { motivo, motivo_outro: motivo === "Outro motivo" ? outro : "", tentar_em: tentarEm || "", retorno: "", retorno_hora: "", lembrete: "" });
        } else {
          if (l.motivo || l.tentar_em) Object.assign(dados, { motivo: "", motivo_outro: "", tentar_em: "" });
          if (st.value === "Contato inválido") Object.assign(dados, { retorno: "", retorno_hora: "", lembrete: "" });
          else {
            if (agData.value && agData.value < hojeISO() && agData.value !== (l.retorno || "")) return falha("A data do próximo contato já passou. Escolha hoje ou uma data futura.");
            Object.assign(dados, { retorno: agData.value || "", retorno_hora: agData.value ? agHora.value || "" : "", lembrete: agData.value ? agLembrete.value.trim() : "" });
          }
        }
        if (QUALI.has(st.value)) Object.assign(dados, { volume: j.querySelector("#q-volume").value.trim(), destinos: j.querySelector("#q-destinos").value.trim(), transportadora: j.querySelector("#q-transp").value.trim() });
        // Só manda o que mudou nos campos novos (leads antigos não têm esses campos).
        ["motivo", "motivo_outro", "tentar_em", "retorno", "retorno_hora", "lembrete", "volume", "destinos", "transportadora"].forEach(k => {
          if (k in dados && (dados[k] || "") === (l[k] || "")) delete dados[k];
        });
        try {
          const novo = await ocupado(ev.currentTarget, () => API.atualizarLead(id, dados));
          Object.assign(l, novo); fechar();
          await aposMudarLead(st.value === "Sem interesse" ? `${l.empresa}: Sem interesse (${motivoDe(l)}).` : dados.retorno ? `Lead salvo. Próximo contato em ${data(dados.retorno)}.` : "Lead salvo.");
        } catch (e) { aviso(API.traduzir(e), true); }
      });

      if (op.canal) { const b = j.querySelector(`[data-canal="${op.canal}"]`); if (b) b.click(); }
      if (op.status) { st.dispatchEvent(new Event("change")); blocoMotivo.scrollIntoView({ block: "center" }); }
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

  // Agenda do dia: próximos contatos vencidos e leads "tentar de novo" que chegaram na data.
  function blocoParaHoje() {
    if (!leadsU().length) return "";
    const hoje = hojeISO();
    const ordem = (l) => (l.retorno && l.retorno < hoje ? "0" : "1") + (l.retorno || l.tentar_em || "") + (l.retorno_hora || "99:99");
    const lista = leadsU().filter(paraHoje).sort((a, b) => ordem(a).localeCompare(ordem(b)));
    if (!lista.length) return `<section class="hoje hoje-vazio"><b>Para hoje</b><span>Nenhum contato marcado para hoje. Na ficha de cada lead, use “Próximo contato” para montar sua agenda.</span></section>`;
    return `<section class="hoje" aria-label="Para hoje">
      <h2>Para hoje <span class="qtd-hoje">${lista.length} contato${lista.length > 1 ? "s" : ""}</span></h2>
      <div class="hoje-lista">${lista.map(l => {
        const atrasado = l.retorno && l.retorno < hoje;
        const rotuloDia = retornoDevido(l)
          ? (atrasado ? `Atrasado desde ${data(l.retorno)}` : `Hoje${l.retorno_hora ? ", " + esc(l.retorno_hora) : ", sem horário"}`)
          : `Tentar de novo hoje · ${esc(motivoDe(l) || "Sem interesse")}`;
        const tel = API.limparTelefone(l.telefone), mail = API.limparEmail(l.email);
        const n = tentativasDe(l);
        return `<div class="hoje-item${atrasado ? " atrasado" : ""}" data-lead="${esc(l.id)}" role="button" tabindex="0" aria-label="${esc(l.empresa)}">
          <span class="hoje-quando">${rotuloDia}</span>
          <b>${esc(l.empresa)}</b>
          <span class="sec">${esc([l.contato, l.status, n ? `${n} tentativa${n > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · "))}</span>
          ${l.lembrete ? `<span class="hoje-lembrete">“${esc(l.lembrete)}”</span>` : ""}
          <div class="hoje-acoes">
            ${tel ? `<button class="btn btn-p btn-zap nao-abre" data-hoje="whatsapp" data-id="${esc(l.id)}">WhatsApp</button><button class="btn btn-p nao-abre" data-hoje="ligacao" data-id="${esc(l.id)}">Ligar</button>` : mail ? `<button class="btn btn-p nao-abre" data-hoje="email" data-id="${esc(l.id)}">E-mail</button>` : ""}
            <button class="btn btn-p nao-abre" data-adiar data-id="${esc(l.id)}">Adiar</button>
          </div>
        </div>`;
      }).join("")}</div></section>`;
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
      ${blocoParaHoje()}
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
        ${ls.length && ehAdmin() ? `<button class="btn btn-p btn-perigo" id="pt-apagar">Apagar os ${ls.length} leads deste pedido</button>` : ""}
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
  // [campo, rótulo, nomes de coluna aceitos]. Telefones, e-mails, redes, CNAE e sócios podem vir vários numa célula só.
  const CAMPOS = [
    ["empresa", "Empresa", ["razao social", "empresa", "nome da empresa", "nome"]],
    ["fantasia", "Nome fantasia", ["nome fantasia da empresa", "nome fantasia", "fantasia"]],
    ["cnpj", "CNPJ", ["cnpj", "cpf/cnpj", "documento"]],
    ["segmento", "Segmento", ["segmento", "descricao cnae", "atividade", "ramo"]],
    ["cidade", "Cidade", ["cidade/uf", "cidade", "municipio"]],
    ["uf", "UF", ["uf", "estado"]],
    ["contato", "Contato", ["contato", "nome do contato", "decisor", "responsavel"]],
    ["telefone", "Telefones", ["telefones", "telefone", "celular", "whatsapp", "fone", "telefone 1"]],
    ["email", "E-mails", ["emails", "e-mails", "e-mail", "email"]],
    ["site", "Site", ["site", "website"]],
    ["redes", "Redes sociais", ["redes sociais", "redes", "linkedin", "instagram"]],
    ["endereco", "Endereço", ["endereco", "logradouro"]],
    ["bairro", "Bairro", ["bairro"]],
    ["cep", "CEP", ["cep"]],
    ["funcionarios", "Funcionários", ["qnt. de funcionarios", "funcionarios"]],
    ["faturamento", "Faturamento", ["faturamento presumido", "faturamento"]],
    ["porte", "Porte", ["porte"]],
    ["tipo_unidade", "Matriz ou filial", ["tipo"]],
    ["filiais", "Filiais", ["filiais"]],
    ["cnae", "CNAE", ["cnae"]],
    ["socios", "Quadro societário", ["quadro societario", "socios"]]
  ];
  // Colunas da Leads2b que não entram (o time pediu para deixar de fora).
  const IGNORAR = ["popularidade", "natureza juridica", "revelado por", "status", "dados", "tipo de entidade"];

  function adivinhar(cabecalho) {
    const h = cabecalho.map(norm);
    const usado = new Set(h.map((x, k) => IGNORAR.includes(x) ? k : -1).filter(k => k >= 0)), mapa = {};
    CAMPOS.forEach(([campo, , nomes]) => {
      let i = -1;
      for (const n of nomes) { i = h.findIndex((x, k) => !usado.has(k) && x === n); if (i >= 0) break; }
      if (i < 0) for (const n of nomes) { i = h.findIndex((x, k) => !usado.has(k) && x.includes(n)); if (i >= 0) break; }
      if (i >= 0) { usado.add(i); mapa[campo] = i; }
    });
    return mapa;
  }

  // Conferência de duplicados: o mesmo CNPJ (ou, sem CNPJ, o mesmo nome + cidade) já enviado a qualquer unidade.
  const soDigitos = (v) => String(v || "").replace(/\D/g, "");
  const chaveNome = (empresa, cidade) => norm(empresa).replace(/\b(ltda|me|epp|eireli|s\/?a|sa|ss)\b\.?/g, "").replace(/[^a-z0-9]/g, "")
    + "|" + norm(String(cidade || "").split("/")[0]).replace(/[^a-z0-9]/g, "");
  const dataLonga = (v) => v ? String(v).slice(0, 10).split("-").reverse().join("/") : "";
  function indiceDuplicados() {
    const porCnpj = {}, porNome = {};
    E.leads.forEach(l => {
      const c = soDigitos(l.cnpj);
      if (c.length >= 11) (porCnpj[c] = porCnpj[c] || []).push(l);
      (porNome[chaveNome(l.empresa, l.cidade_uf)] = porNome[chaveNome(l.empresa, l.cidade_uf)] || []).push(l);
    });
    return (x) => {
      const c = soDigitos(x.cnpj);
      const nome = (porNome[chaveNome(x.empresa, x.cidade_uf)] || []).filter(l => c.length < 11 || soDigitos(l.cnpj).length < 11);
      const achados = [...(c.length >= 11 ? porCnpj[c] || [] : []), ...nome];
      if (!achados.length) return null;
      // O mais importante primeiro: Cliente Azul, depois o mais recente.
      return achados.sort((a, b) => (b.status === "Cliente Azul") - (a.status === "Cliente Azul") || String(b.atualizado_em || "").localeCompare(String(a.atualizado_em || "")))[0];
    };
  }
  function ondeJaEsta(l) {
    const ped = E.pedidos.find(p => p.id === l.solicitacao_id) || {};
    const quem = perfilDe(ped.solicitante).nome || ped.solicitante_nome || "";
    const det = l.status === "Cliente Azul" ? "Já é cliente. Outra unidade não deve abordar"
      : l.status === "Sem interesse" ? [motivoDe(l) && "Motivo: " + motivoDe(l), l.tentar_em && "tentar de novo em " + dataLonga(l.tentar_em)].filter(Boolean).join(" · ")
      : [ped.enviada_em && "Enviado em " + data(ped.enviada_em), quem].filter(Boolean).join(" · ");
    return `Unidade <b>${esc(rotulo(l.sigla))}</b>, pedido ${esc(l.solicitacao_id)} · <span class="pilula-status" style="--cor:${COR[l.status] || "#8A94A6"}">${esc(l.status)}</span>${det ? `<div class="sec">${esc(det)}</div>` : ""}`;
  }

  function janelaImportar(pedidoId) {
    const p = E.pedidos.find(x => x.id === pedidoId);
    const espaco = MAX - E.leads.filter(l => l.solicitacao_id === p.id).length;
    let linhas = [], cab = [], mapa = {};
    const reenviar = {}; // chave do lead duplicado -> true quando o time marca "Enviar mesmo assim"
    const jaExiste = indiceDuplicados();
    const desenharImport = (j) => {
      const corpo = j.querySelector("#imp-mapa");
      if (!cab.length) { corpo.innerHTML = ""; return; }
      const limpeza = { tel: 0, redes: 0 };
      const montar = () => linhas.map(r => {
        const v = (c) => mapa[c] >= 0 ? String(r[mapa[c]] == null ? "" : r[mapa[c]]).trim() : "";
        const cidade = titulo(v("cidade")), uf = v("uf").toUpperCase();
        const tels = API.lerTelefones(v("telefone"));
        limpeza.tel += tels.descartados;
        const base = dddBase(tels.lista);
        const telefones = tels.lista.slice().sort((a, b) => ordemTel(a, base) - ordemTel(b, base));
        const emails = API.lerEmails(v("email"));
        const redes = listaCel(v("redes"));
        const achar = (dom) => redes.find(x => x.toLowerCase().includes(dom)) || null;
        limpeza.redes += redes.filter(x => !/linkedin\.com|instagram\.com/i.test(x)).length;
        const segUnico = (p.segmentos || []).length === 1 ? p.segmentos[0] : null;
        return { empresa: titulo(v("empresa")), fantasia: titulo(v("fantasia")) || null, cnpj: cnpjBonito(v("cnpj")) || null, segmento: v("segmento") || segUnico,
          cidade_uf: [cidade, uf && !cidade.includes("/") ? uf : ""].filter(Boolean).join("/") || null,
          contato: titulo(v("contato")) || null, telefone: (telefones[0] || {}).n || null, email: emails[0] || null,
          telefones, emails, site: limparLink(v("site")) || null, linkedin: limparLink(achar("linkedin.com")), instagram: limparLink(achar("instagram.com")),
          endereco: titulo(v("endereco")) || null, bairro: titulo(v("bairro")) || null, cep: soDigitos(v("cep")) || null,
          funcionarios: v("funcionarios") || null, faturamento: v("faturamento") || null, porte: v("porte") || null,
          tipo_unidade: v("tipo_unidade") || null, filiais: v("filiais") || null,
          cnaes: listaCel(v("cnae")).map(soDigitos).filter(Boolean), socios: listaCel(v("socios")).map(titulo) };
      }).filter(x => x.empresa);
      const todos = montar();
      // Separa: novos, já no portal e repetidos dentro da própria planilha.
      const vistos = new Set(), novos = [], dups = [], repetidos = [];
      todos.forEach(x => {
        const c = soDigitos(x.cnpj), k = c.length >= 11 ? "c" + c : "n" + chaveNome(x.empresa, x.cidade_uf);
        if (vistos.has(k)) { repetidos.push(x); return; }
        vistos.add(k);
        const l = jaExiste(x);
        if (l) dups.push({ x, l, k, bloqueado: l.status === "Cliente Azul" }); else novos.push(x);
      });
      const reenviados = dups.filter(d => !d.bloqueado && reenviar[d.k]).map(d => d.x);
      const validos = [...novos, ...reenviados];
      const prontos = validos.slice(0, espaco);
      const reconhecido = ["telefone", "email", "cnpj", "empresa"].every(c => mapa[c] >= 0) && mapa.socios >= 0;
      const ligadas = new Set(Object.values(mapa).filter(i => i >= 0));
      const nomesLigados = new Set([...ligadas].map(i => norm(cab[i])));
      const deFora = cab.filter((h, i) => h && !ligadas.has(i) && !nomesLigados.has(norm(h)));
      corpo.innerHTML = `
        ${reconhecido ? `<div class="imp-ok"><b>Formato da Leads2b reconhecido.</b> As colunas já foram ligadas sozinhas; abra “Conferir colunas” se quiser mudar.</div>` : ""}
        <details class="imp-colunas"${reconhecido ? "" : " open"}><summary>Conferir colunas (${ligadas.size} ligadas)</summary>
        <p class="sub" style="margin:8px 0 10px">Confira qual coluna da planilha vai para cada campo.</p>
        <div class="mapa">${CAMPOS.map(([c, rot]) => `<div class="campo"><label for="m-${c}">${rot}${c === "empresa" ? " (obrigatório)" : ""}</label>
          <select id="m-${c}" data-mapa="${c}"><option value="-1">Não usar</option>${cab.map((h, i) => `<option value="${i}"${mapa[c] === i ? " selected" : ""}>${esc(h || "Coluna " + (i + 1))}</option>`).join("")}</select></div>`).join("")}</div>
        </details>
        ${deFora.length ? `<div class="imp-fora"><b>Ficam de fora:</b> ${deFora.map(h => `<span class="etiqueta">${esc(h)}</span>`).join(" ")}${limpeza.redes ? ` <span class="etiqueta">Facebook, Twitter e outras redes</span>` : ""}</div>` : ""}
        <div class="imp-resumo">
          <div class="imp-n ok"><b>${novos.length}</b><span>empresa(s) nova(s)</span></div>
          <div class="imp-n atencao"><b>${dups.length}</b><span>já estão no portal${dups.length ? " (ficam de fora)" : ""}</span></div>
          <div class="imp-n neutro"><b>${repetidos.length}</b><span>repetida(s) na planilha</span></div>
        </div>
        ${dups.length ? `<div class="imp-dup">
          <div class="imp-dup-topo"><b>Empresas que já estão no portal</b><span>Confere pelo CNPJ. Sem CNPJ, pelo nome + cidade</span></div>
          <div class="imp-dup-rolar"><table><thead><tr><th>Empresa</th><th>Onde já está</th><th class="dir">Enviar mesmo assim?</th></tr></thead>
          <tbody>${dups.map(d => `<tr><td><b>${esc(d.x.empresa)}</b><div class="sec">${esc(d.x.cnpj || d.x.cidade_uf || "")}</div></td><td>${ondeJaEsta(d.l)}</td>
            <td class="dir">${d.bloqueado ? `<span class="sec">Bloqueado</span>` : `<label class="opcao-mini"><input type="checkbox" data-reenviar="${esc(d.k)}"${reenviar[d.k] ? " checked" : ""}> Enviar</label>`}</td></tr>`).join("")}</tbody></table></div>
          <p class="imp-nota imp-dup-nota">Marcar “Enviar” manda o lead de novo; o histórico anterior continua guardado no pedido de origem. Cliente Azul nunca é reenviado.</p>
        </div>` : ""}
        ${limpeza.tel || limpeza.redes ? `<p class="imp-nota" style="margin:0 0 10px">Limpeza: ${[limpeza.tel && `${limpeza.tel} telefone(s) repetido(s) ou incompleto(s) removido(s)`, limpeza.redes && `${limpeza.redes} link(s) de Facebook, Twitter ou outras redes ignorado(s)`].filter(Boolean).join(" · ")}.</p>` : ""}
        ${repetidos.length ? `<p class="imp-nota" style="margin:0 0 10px">Repetidas na planilha (só a primeira linha entra): ${repetidos.map(x => esc(x.empresa)).join(", ")}.</p>` : ""}
        <p style="margin:6px 0 8px"><b>${prontos.length}</b> leads prontos para enviar a ${esc(rotuloLongo(p.sigla))}${linhas.length - todos.length ? ` (${linhas.length - todos.length} linhas sem nome de empresa serão ignoradas)` : ""}.</p>
        ${validos.length > espaco ? `<div class="erro-form">São ${validos.length} empresas para enviar, mas cada pedido aceita até ${MAX} leads${espaco < MAX ? ` (ainda cabem ${espaco})` : ""}. Entram as ${espaco} primeiras; as outras ${validos.length - espaco} ficam para o próximo pedido.</div>` : ""}
        <div class="tabela-wrap"><table class="previa"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Cidade/UF</th><th>Telefones</th><th>E-mails</th><th>Internet</th></tr></thead>
          <tbody>${prontos.slice(0, 10).map(x => `<tr><td>${esc(x.empresa)}</td><td>${esc(x.cnpj)}</td><td>${esc(x.cidade_uf)}</td>
            <td>${x.telefones.length > 1 ? `${x.telefones.length} (${x.telefones.filter(t => t.t === "cel").length} cel.)` : esc(foneTxt(x.telefone))}</td>
            <td>${x.emails.length > 1 ? x.emails.length : esc(x.email || "")}</td>
            <td>${[x.site && "Site", x.linkedin && "LinkedIn", x.instagram && "Instagram"].filter(Boolean).join(" · ")}</td></tr>`).join("")}</tbody></table></div>`;
      corpo.querySelectorAll("[data-mapa]").forEach(s => s.addEventListener("change", () => { mapa[s.dataset.mapa] = Number(s.value); desenharImport(j); }));
      corpo.querySelectorAll("[data-reenviar]").forEach(c => c.addEventListener("change", () => { reenviar[c.dataset.reenviar] = c.checked; desenharImport(j); }));
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
        "Nome fantasia": l.fantasia || "", "Segmento": l.segmento || "", "Cidade/UF": l.cidade_uf || "", "Contato": l.contato || "", "Telefone": foneTxt(l.telefone), "E-mail": API.limparEmail(l.email),
        "Todos os telefones": telefonesDe(l).filter(t => !t.errado).map(t => foneTxt(t.n)).join("; "), "Números errados": (l.tel_errados || []).map(foneTxt).join("; "),
        "Todos os e-mails": emailsDe(l).join("; "), "Site": l.site || "", "LinkedIn": l.linkedin || "", "Instagram": l.instagram || "",
        "Endereço": [l.endereco, l.bairro].filter(Boolean).join(" - "), "CEP": cepBonito(l.cep), "Porte": porteTexto(l), "CNAE": (l.cnaes || []).map(cnaeBonito).join("; "), "Sócios": (l.socios || []).join("; "),
        "Status": l.status, "Tem contato válido?": l.contato_valido || "", "Data do contato": data(l.data_contato), "Tentativas": tentativasDe(l),
        "Última tentativa": data(l.ultima_tentativa), "Próximo contato": data(l.retorno), "Horário": l.retorno_hora || "", "Lembrete": l.lembrete || "",
        "Motivo (Sem interesse)": l.status === "Sem interesse" ? motivoDe(l) : "", "Tentar de novo em": l.status === "Sem interesse" ? data(l.tentar_em) : "",
        "Envios por mês": l.volume || "", "Principais destinos": l.destinos || "", "Transportadora atual": l.transportadora || "", "Atualizado em": data(l.atualizado_em) };
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
      : `Olá, ${primeiroNome(p.nome)}! Recebemos seu cadastro no Portal de Leads e já estamos conferindo.`;
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Cadastros</h1><p>${ehAdmin() ? "Confira se a sigla no começo do e-mail é da unidade da pessoa antes de aprovar." : "Só administradores aprovam, mudam o acesso e excluem cadastros. Aqui você consulta quem tem acesso."}</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      ${extras.length && ehAdmin() ? `<section class="bloco" style="margin-bottom:18px"><h2>Pedidos de acesso a outras unidades</h2>
        <div class="tabela-wrap" style="border:0"><table><thead><tr><th>Pessoa</th><th>Unidade pedida</th><th>Unidades que já tem</th><th>Ações</th></tr></thead><tbody>
        ${extras.map(a => { const u = unidadeInfo(a.sigla); return `<tr><td><b>${esc(a.nome)}</b><div class="sec">${esc(a.email)}</div></td>
          <td><b>${esc(rotulo(a.sigla))}</b><div class="sec">${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}</div></td>
          <td>${esc(unidadesDe(a.uid).filter(x => x.situacao === "aprovado").map(x => x.sigla).join(", "))}</td>
          <td><div class="acoes"><button class="btn btn-p btn-primario" data-acao="aprovarUnidade" data-id="${esc(a.id)}">Liberar</button><button class="btn btn-p btn-perigo" data-acao="recusarUnidade" data-id="${esc(a.id)}">Recusar</button></div></td></tr>`; }).join("")}
        </tbody></table></div></section>` : ""}
      <div class="filtros">
        <div class="pilulas" role="group" aria-label="Situação do cadastro">
          ${[["pendente", "Aguardando"], ["aprovado", "Aprovados"], ["recusado", "Recusados"], ["excluido", "Excluídos"]].map(([v, r]) => `<button data-pilula="cadastro" data-valor="${v}" aria-pressed="${E.f.cadastro === v}">${r} (${contar(v)})</button>`).join("")}
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
            <td><b>${esc(p.nome)}</b> <span class="etiqueta">${esc(p.cargo || "Representante")}</span><div class="sec">${esc(p.email)}</div></td>
            <td>${us.length ? us.map(a => { const u = unidadeInfo(a.sigla); return `<div><b>${esc(u.nome || a.sigla)}</b>${a.principal ? "" : " (extra)"} <span class="sec">${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}${a.situacao !== "aprovado" ? " · " + esc(a.situacao) : ""}</span></div>`; }).join("") : `<span class="sec">${p.papel === "time" || !p.siglaPrincipal ? "Time (sem unidade)" : "–"}</span>`}
              ${!siglaOk ? `<div class="sec" style="color:var(--danger)">A sigla não bate com o e-mail</div>` : ""}</td>
            <td>${esc(foneBonito(p.celular || ""))}</td>
            <td>${p.papel === "admin" ? "<b>Administrador</b><div class=\"sec\">Vê tudo e gerencia cadastros</div>" : p.papel === "time" ? "Time<div class=\"sec\">Vê e trabalha pedidos e leads</div>" : "Só as próprias unidades"}</td>
            <td>${data(p.criadoEm)}${p.situacao === "excluido" ? `<div class="sec">Excluído${p.excluido_em ? " em " + data(p.excluido_em) : ""}${p.excluido_por ? " por " + esc(p.excluido_por) : ""}</div>` : ""}</td>
            <td><div class="acoes">
              ${!ehAdmin() ? (link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : `<span class="sec">–</span>`)
              : p.situacao === "excluido" ? `<button class="btn btn-p" data-acao="reativar" data-id="${esc(p.id)}">Reativar</button>` : `
              ${p.situacao !== "aprovado" ? (p.cargo === "Inside Sales"
                ? `<button class="btn btn-p btn-primario" data-acao="aprovar" data-papel="time" data-id="${esc(p.id)}">Aprovar como time</button><button class="btn btn-p" data-acao="aprovar" data-papel="admin" data-id="${esc(p.id)}">Aprovar como administrador</button>`
                : `<button class="btn btn-p btn-primario" data-acao="aprovar" data-id="${esc(p.id)}">Aprovar</button>`) : ""}
              ${p.situacao === "aprovado" && p.cargo === "Inside Sales" && (p.papel || "representante") === "representante" ? `<span class="etiqueta alerta">Falta liberar o acesso de time</span>` : ""}
              ${p.situacao !== "recusado" && !eu ? `<button class="btn btn-p btn-perigo" data-acao="recusar" data-id="${esc(p.id)}">${p.situacao === "aprovado" ? "Bloquear" : "Recusar"}</button>` : ""}
              ${p.situacao === "aprovado" && !eu ? ["representante", "time", "admin"].filter(x => x !== (p.papel || "representante")).map(x => `<button class="btn btn-p" data-acao="papel" data-papel="${x}" data-id="${esc(p.id)}">Tornar ${PAPEL[x].toLowerCase()}</button>`).join("") : ""}
              ${p.situacao === "aprovado" && !eu ? `<button class="btn btn-p" data-acao="senha" data-id="${esc(p.id)}">Esqueceu a senha</button>` : ""}
              <button class="btn btn-p" data-acao="editarPessoa" data-id="${esc(p.id)}">Editar dados</button>
              ${link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
              ${!eu ? `<button class="btn btn-p btn-perigo-leve" data-acao="excluir" data-id="${esc(p.id)}">Excluir cadastro</button>` : ""}`}
            </div></td></tr>`;
        }).join("")}</tbody></table></div>`
      : `<div class="vazio"><h2>${E.f.cadastro === "pendente" ? "Nenhum cadastro aguardando" : E.f.cadastro === "excluido" ? "Nenhum cadastro excluído" : "Nenhum cadastro aqui"}</h2><p>${E.f.cadastro === "pendente" ? "Quando um representante criar o acesso, ele aparece aqui para aprovação." : "Mude a aba para ver os outros cadastros."}</p></div>`}`;
  }

  // Celular: só números, com DDD (tira o 55 do Brasil se vier).
  function celularLimpo(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
    return d.length === 10 || d.length === 11 ? d : "";
  }
  function janelaCelular() {
    const p = E.perfil;
    abrir(`
      <div class="janela-topo"><div><h2>Alterar meu celular</h2><p>É por ele que o time avisa pelo WhatsApp.</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="c-cel">Celular com DDD</label><input id="c-cel" type="tel" inputmode="tel" autocomplete="tel" value="${esc(foneBonito(p.celular || ""))}" placeholder="(11) 91234-5678"><span class="dica">Exemplo: (11) 91234-5678</span></div>
        <div class="erro-form" id="c-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="c-ok">Salvar</button></div>`,
    (j) => {
      j.querySelector("#c-ok").addEventListener("click", async (ev) => {
        const cel = celularLimpo(j.querySelector("#c-cel").value), erro = j.querySelector("#c-erro");
        if (!cel) { erro.textContent = "Digite o celular com DDD, por exemplo (11) 91234-5678."; erro.hidden = false; return; }
        try { await ocupado(ev.currentTarget, () => API.mudarMeuCelular(cel)); E.perfil.celular = cel; fechar(); aviso("Celular atualizado."); if (E.perfil.situacao === "aprovado" && (ehTime() || minhasUnidades().length)) desenhar(); else telaEspera(); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }
  function janelaEditarPessoa(id) {
    const p = E.perfis.find(x => x.id === id);
    abrir(`
      <div class="janela-topo"><div><h2>Editar dados</h2><p>${esc(p.email)}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="e-nome">Nome</label><input id="e-nome" type="text" maxlength="120" value="${esc(p.nome || "")}"></div>
        <div class="campo"><label for="e-cel">Celular com DDD</label><input id="e-cel" type="tel" value="${esc(foneBonito(p.celular || ""))}" placeholder="(11) 91234-5678"></div>
        <p class="sub">O e-mail não muda: ele é o login da pessoa.</p>
        <div class="erro-form" id="e-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="e-ok">Salvar</button></div>`,
    (j) => {
      j.querySelector("#e-ok").addEventListener("click", async (ev) => {
        const nome = j.querySelector("#e-nome").value.trim(), cel = celularLimpo(j.querySelector("#e-cel").value), erro = j.querySelector("#e-erro");
        if (nome.length < 2) { erro.textContent = "Digite o nome."; erro.hidden = false; return; }
        if (!cel) { erro.textContent = "Digite o celular com DDD, por exemplo (11) 91234-5678."; erro.hidden = false; return; }
        const dados = {};
        if (nome !== p.nome) dados.nome = nome;
        if (cel !== p.celular) dados.celular = cel;
        if (!Object.keys(dados).length) { fechar(); return; }
        try { await ocupado(ev.currentTarget, () => API.atualizarPerfil(id, dados)); fechar(); await recarregar(); aviso("Dados atualizados."); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
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
        <p class="sub">O cadastro vai para a aba <b>Excluídos</b>, com a data e quem excluiu. Se a pessoa voltar, use <b>Reativar</b> e aprove de novo.</p>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-perigo" id="x-ok">Excluir cadastro</button></div>`,
    (j) => {
      j.querySelector("#x-ok").addEventListener("click", async (ev) => {
        try { await ocupado(ev.currentTarget, () => API.excluirCadastro(id)); fechar(); await recarregar(); aviso("Cadastro excluído. Ele fica na aba Excluídos; os pedidos e leads continuam salvos."); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }

  // Senha esquecida: o e-mail de redefinição pode ser barrado pela Azul, então o time tem um caminho manual.
  function janelaSenha(id) {
    const p = E.perfis.find(x => x.id === id);
    abrir(`
      <div class="janela-topo"><div><h2>Esqueceu a senha</h2><p>${esc(p.nome)} · ${esc(p.email)}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <p><b>1. Tente o link.</b> O portal manda um e-mail para a pessoa criar uma senha nova. Ele pode não chegar, porque o e-mail da Azul costuma barrar o remetente.</p>
        <p><b>2. Se não chegar:</b></p>
        <ol style="margin:0 0 10px 20px;line-height:1.6">
          <li>No Firebase, abra <b>Authentication › Usuários</b>, procure <b>${esc(p.email)}</b> e use <b>⋮ › Excluir conta</b>.</li>
          <li>Aqui no portal, clique em <b>Excluir cadastro</b> nesta pessoa. Os pedidos, leads e histórico continuam salvos.</li>
          <li>Peça para a pessoa criar o acesso de novo, com o mesmo e-mail e uma senha nova, e aprove.</li>
        </ol>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button><button class="btn btn-primario" id="x-link">Enviar o link</button></div>`,
    (j) => {
      j.querySelector("#x-link").addEventListener("click", async (ev) => {
        try { await ocupado(ev.currentTarget, () => API.enviarRedefinicao(p.email)); aviso("Link enviado. Se não chegar, siga o passo 2."); }
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

  // Painel: tentativas, agenda das unidades e motivos de Sem interesse.
  function blocoProspeccao(leads) {
    const hoje = hojeISO(), em90 = somaDias(90);
    const avancaram = leads.filter(l => !["Novo", "Prospecção", "Contato inválido"].includes(l.status) && tentativasDe(l));
    const media = avancaram.length ? (avancaram.reduce((s, l) => s + tentativasDe(l), 0) / avancaram.length) : 0;
    const atrasados = leads.filter(l => l.retorno && l.retorno < hoje).length;
    const proximos = leads.filter(l => l.status === "Sem interesse" && l.tentar_em && l.tentar_em >= hoje && l.tentar_em <= em90).length;
    const sem = leads.filter(l => l.status === "Sem interesse");
    const outros = sem.filter(l => l.motivo === "Outro motivo" && l.motivo_outro).slice(0, 6);
    const semMotivo = sem.filter(l => !l.motivo).length;
    const porUn = {};
    leads.forEach(l => {
      const o = porUn[l.sigla] = porUn[l.sigla] || { sigla: l.sigla, hoje: 0, atras: 0, soma: 0, qtd: 0 };
      if (paraHoje(l) && !(l.retorno && l.retorno < hoje)) o.hoje++;
      if (l.retorno && l.retorno < hoje) o.atras++;
      if (l.status !== "Novo") { o.soma += tentativasDe(l); o.qtd++; }
    });
    const un = Object.values(porUn).sort((a, b) => b.atras - a.atras || b.hoje - a.hoje || a.sigla.localeCompare(b.sigla));
    const num = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return `
      <h2 class="subtitulo-painel">Prospecção</h2>
      <div class="indicadores indicadores-3">
        <div class="indicador">${icone("retorno")}<div class="valor">${num(media)}</div><div class="rotulo">Tentativas, em média, dos leads que avançaram</div></div>
        <div class="indicador${atrasados ? " atencao" : ""}">${icone("alerta")}<div class="valor">${atrasados}</div><div class="rotulo">Retornos atrasados nas unidades</div></div>
        <div class="indicador">${icone("leads")}<div class="valor">${proximos}</div><div class="rotulo">Leads para tentar de novo nos próximos 3 meses</div></div>
      </div>
      <div class="paineis">
        <section class="bloco"><h2>Por que não teve interesse</h2>
          ${sem.length ? barras(MOTIVOS.map(m => [m, sem.filter(l => l.motivo === m).length])) : `<p class="sub">Nenhum lead em Sem interesse ainda.</p>`}
          ${semMotivo ? `<p class="sub" style="margin-top:10px">${semMotivo} lead${semMotivo > 1 ? "s" : ""} sem motivo (marcados antes desta versão).</p>` : ""}
          ${outros.length ? `<h3 class="mini-titulo">Escritos em “Outro motivo”</h3><ul class="outros-motivos">${outros.map(l => `<li>${esc(l.motivo_outro)} <span class="sec">· ${esc(rotulo(l.sigla))}</span></li>`).join("")}</ul>` : ""}
        </section>
        <section class="bloco"><h2>Agenda das unidades</h2>
          ${un.length ? `<div class="tabela-wrap"><table><thead><tr><th>Unidade</th><th>Para hoje</th><th>Atrasados</th><th>Média de tentativas</th></tr></thead><tbody>
            ${un.map(o => `<tr><td><b>${esc(rotulo(o.sigla))}</b></td><td>${o.hoje}</td><td${o.atras ? ' style="color:var(--danger);font-weight:600"' : ""}>${o.atras}</td><td>${o.qtd ? num(o.soma / o.qtd) : "–"}</td></tr>`).join("")}
          </tbody></table></div>
          <p class="sub" style="margin-top:10px">Média baixa de tentativas pode indicar unidade que desiste cedo do lead.</p>` : `<p class="sub">Nenhum lead enviado ainda.</p>`}
        </section>
      </div>`;
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
      ${blocoProspeccao(leads)}
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
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Minha conta</h1><p>Você mesmo pode alterar o celular. Para corrigir o nome, fale com o time de ${esc(TIME)}.</p></div></div>
      <div class="paineis">
        <section class="bloco"><h2>Meus dados</h2>
          <dl class="dados">
            <dt>Nome</dt><dd>${esc(p.nome)}</dd><dt>E-mail</dt><dd>${esc(p.email)}</dd><dt>Celular</dt><dd>${esc(foneBonito(p.celular || ""))} <button class="link-mini" data-acao="meuCelular">Alterar</button></dd>
            <dt>Cargo</dt><dd>${esc(p.cargo || "Representante")}</dd>
            <dt>Acesso</dt><dd>${p.papel === "admin" ? "Administrador (" + esc(TIME) + ")" : p.papel === "time" ? "Time de " + esc(TIME) : "Unidades"}</dd>
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

  // Atualização automática: quando o time publica uma versão nova (index.html com outro número em <meta name="versao">),
  // a página recarrega sozinha, sem precisar de Ctrl+F5. Se tiver uma janela aberta, só avisa.
  const VERSAO = (document.querySelector('meta[name="versao"]') || {}).content || "";
  let ultimaChecagem = 0;
  async function verificarVersao() {
    if (API.demo || !VERSAO || Date.now() - ultimaChecagem < 4 * 60 * 1000) return;
    ultimaChecagem = Date.now();
    try {
      const html = await fetch("index.html?nc=" + Date.now(), { cache: "no-store" }).then(r => r.text());
      const m = html.match(/<meta name="versao" content="([^"]+)"/);
      if (!m || m[1] === VERSAO) return;
      const recarregar = () => location.replace(location.pathname + "?v=" + encodeURIComponent(m[1]));
      if (!$janela.open) return recarregar();
      const t = document.getElementById("toast");
      t.innerHTML = `Há uma versão nova do portal. <button class="link-mini" id="b-versao">Atualizar agora</button>`;
      clearTimeout(toastTimer); t.className = "toast ver";
      document.getElementById("b-versao").onclick = recarregar;
    } catch (e) { /* sem internet: tenta depois */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verificarVersao(); });
  setInterval(verificarVersao, 10 * 60 * 1000);
  setTimeout(verificarVersao, 5000);

  iniciar();
})();
