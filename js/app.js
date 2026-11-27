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
  // "Vou cuidar deste": quem da unidade está cuidando de cada lead.
  const cuidaEu = () => ({ cuida_uid: E.perfil.id, cuida_nome: primeiroNome(E.perfil.nome) });
  const meuLead = (l) => !l.cuida_uid || l.cuida_uid === E.perfil.id;
  // A unidade tem mais gente (dono e vendedores)? Só aí faz sentido mostrar quem cuida de cada lead.
  function temEquipe(sigla) {
    if (ehTime()) return false;
    const u = ((E.perfil && E.perfil.unidades) || []).find(x => x.sigla === sigla) || {};
    if (u.tipo === "executivo") return false;
    if (u.dono_uid && u.dono_uid !== E.perfil.id) return true;
    const eq = (E.equipe || {})[sigla];
    if (eq && (eq.pessoas || []).filter(p => p.situacao === "aprovado").length > 1) return true;
    return (E.leads || []).some(l => l.sigla === sigla && l.cuida_uid && l.cuida_uid !== E.perfil.id);
  }
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
  // "oSASCO/sP" -> "Osasco/SP"; "são paulo - sp" -> "São Paulo/SP"; "sao jose dos campos" -> "Sao Jose dos Campos".
  function cidadeUf(v) {
    const t = String(v || "").trim().replace(/\s+/g, " ");
    if (!t) return t;
    const m = t.match(/^(.*?)(?:\s*[\/\-,]\s*([A-Za-z]{2}))?$/);
    const cap = (p) => p.split("-").map(x => x.charAt(0).toUpperCase() + x.slice(1)).join("-");
    const cidade = (m ? m[1] : t).toLowerCase().split(" ").map((p, i) => (i && MINUSCULAS.has(p)) ? p : cap(p)).join(" ");
    return m && m[2] ? `${cidade}/${m[2].toUpperCase()}` : cidade;
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
  const ordemTel = (t, base) => (t.errado ? 10 : t.ok ? -10 : 0) + (t.t === "cel" ? (t.n.startsWith(base) ? 0 : 1) : t.t === "fixo" ? (t.n.startsWith(base) ? 2 : 3) : 4);
  // Lista de telefones do lead (leads antigos só têm "telefone"), na ordem do mais provável para o menos provável.
  function telefonesDe(l) {
    let ts = Array.isArray(l.telefones) && l.telefones.length ? l.telefones : [API.normalizarTelefone(l.telefone)].filter(Boolean);
    if (!ts.length && API.limparTelefone(l.telefone)) ts = [{ n: API.limparTelefone(l.telefone), t: "fixo" }];
    const { ok, nao } = marcas(l), base = dddBase(ts);
    return ts.map(t => ({ ...t, errado: nao.has(t.n), ok: ok.has(t.n), local: t.t !== "0800" && t.n.startsWith(base), base })).sort((a, b) => ordemTel(a, base) - ordemTel(b, base));
  }
  const emailsDe = (l) => Array.isArray(l.emails) && l.emails.length ? l.emails : [API.limparEmail(l.email)].filter(Boolean);
  // Contato válido por contato: "Funciona" (contatos_ok) ou "Não funciona" (contatos_nao; tel_errados é o nome antigo).
  function marcas(l) { return { ok: new Set(l.contatos_ok || []), nao: new Set([...(l.contatos_nao || []), ...(l.tel_errados || [])]) }; }
  function emailsMarcados(l) {
    const { ok, nao } = marcas(l);
    return emailsDe(l).map(m => ({ m, ok: ok.has(m), errado: nao.has(m) })).sort((a, b) => (a.errado - b.errado) || (b.ok - a.ok));
  }
  // Sim: algum contato funciona. Não: todos marcados como não funciona. Vazio: ainda sem resposta.
  function contatoValidoDe(l, ok, nao) {
    const todos = [...telefonesDe(l).map(t => t.n), ...emailsDe(l)];
    if (ok.size) return "Sim";
    return todos.length && todos.every(c => nao.has(c)) ? "Não" : "";
  }
  const botoesMarca = (c, item) => `<span class="marca" role="group" aria-label="Este contato funciona?">
      <button type="button" class="marca-b sim" data-marca="ok" data-contato="${esc(c)}" aria-pressed="${!!item.ok}" title="Funciona">✓ Funciona</button>
      <button type="button" class="marca-b nao" data-marca="nao" data-contato="${esc(c)}" aria-pressed="${!!item.errado}" title="Não funciona">✕ Não funciona</button></span>`;
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
  const $toast = document.getElementById("toast");
  // aviso(msg, erro, desfazer): com "desfazer", o aviso ganha um botão Desfazer por alguns segundos (no lugar do "Tem certeza?").
  function aviso(msg, erro, desfazer) {
    const t = $toast;
    // Com uma janela aberta, o aviso vai para dentro dela: senão fica escondido atrás da janela.
    // (a confirmação "Tem certeza?" fica de fora: ela some logo e apagaria o aviso junto)
    const dlg = [...document.querySelectorAll("dialog[open]")].filter(d => !d.classList.contains("confirmar")).pop();
    if (t.parentNode !== (dlg || document.body)) (dlg || document.body).appendChild(t);
    t.textContent = msg; t.className = "toast ver" + (erro ? " erro" : "");
    if (desfazer) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "link-mini toast-desfazer"; b.textContent = "Desfazer";
      b.addEventListener("click", async () => {
        clearTimeout(toastTimer); t.className = "toast";
        try { await desfazer(); } catch (e) { aviso(API.traduzir(e), true); }
      });
      t.append(" ", b);
    }
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = "toast", erro ? 6000 : desfazer ? 9000 : 3200);
  }

  function opcoes(lista, atual, vazio) {
    return (vazio !== undefined ? `<option value="">${esc(vazio)}</option>` : "") +
      lista.map(v => `<option value="${esc(v)}"${v === atual ? " selected" : ""}>${esc(v)}</option>`).join("");
  }
  const EMPRESA = cfg.empresa || "Azul Logística";
  const TIME = cfg.nomeDoTime || "Inside Sales";
  const AUTORIA = `<span class="autoria">Desenvolvido por <b>Lucas de Oliveira Rocha</b><span class="sep-aut"> · </span><span class="nw">© ${new Date().getFullYear()}</span></span>`;
  const logo = (cls) => cfg.logoUrl ? `<img class="${cls || "logo"}" src="${esc(cfg.logoUrl)}" alt="${esc(EMPRESA)}">` : "";
  const ICONES = {
    pedido: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
    leads: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
    retorno: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    fechado: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    aviao: '<path d="M2 13l8-1 5-8h2l-2 8 5 1 2-2h1l-1 3 1 3h-1l-2-2-5 1 2 8h-2l-5-8-8-1z"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    sino: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'
  };
  const icone = (n) => `<span class="icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES[n]}</svg></span>`;
  const sobre = () => `${esc(TIME)} | ${esc(EMPRESA)}`;
  const ROTA = `<svg class="rota" viewBox="0 0 600 600" aria-hidden="true"><path d="M-40 520 C 160 420, 260 470, 360 300 S 560 120, 660 60" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/><path d="M-40 600 C 200 520, 330 560, 430 400 S 600 260, 680 210" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 12" stroke-linecap="round" opacity=".6"/><g transform="translate(372 286) rotate(-38) scale(1.6)" fill="currentColor" stroke="none"><path d="M2 13l8-1 5-8h2l-2 8 5 1 2-2h1l-1 3 1 3h-1l-2-2-5 1 2 8h-2l-5-8-8-1z" transform="translate(-12 -12)"/></g></svg>`;

  const chipSituacao = (s) => `<span class="situacao s-${slug(s)}">${esc(situacaoTexto(s))}</span>`;
  const ponto = (s) => `<span class="ponto" style="background:${COR[s] || "#999"}"></span>`;
  const chipStatus = (s) => `<span class="chip-status" style="--c:${COR[s] || "#999"}">${esc(s)}</span>`;

  // Antes de fechar uma janela, a tela pode salvar algo pendente (ex.: observação digitada e não adicionada).
  let guardaFechar = null;
  function abrir(html, ligar) {
    guardaFechar = null;
    if ($janela.contains($toast)) document.body.appendChild($toast); // o aviso não pode sumir junto com a janela anterior
    $janela.innerHTML = html;
    if (!$janela.open) $janela.showModal();
    $janela.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", fechar));
    if (ligar) ligar($janela);
  }
  // Android/Chrome: guarda o convite de instalação para o botão "Colocar na tela agora".
  let instalarPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); instalarPrompt = e; });
  window.addEventListener("appinstalled", () => { instalarPrompt = null; });

  // ---- Avisos no celular ----
  // estado: "ativo" (este aparelho recebe), "desligado" (dá para ativar), "bloqueado" (a pessoa negou nos ajustes),
  // "iphone" (iPhone fora da tela inicial: precisa instalar primeiro), "sem-suporte" (navegador não recebe avisos).
  const AV = { suportado: null };
  const ehIphone = () => /iPhone|iPad|iPod/i.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  function estadoAvisos() {
    if (API.demo) return "sem-suporte";
    if (AV.suportado === false) return ehIphone() && !instalado() ? "iphone" : "sem-suporte";
    if (AV.suportado === null) return "carregando";
    const perm = API.avisosPermissao();
    if (perm === "denied") return "bloqueado";
    return API.avisosAtivosAqui() ? "ativo" : "desligado";
  }
  const avisosDispensado = () => { try { return !!localStorage.getItem("portal-avisos-dispensado"); } catch (e) { return true; } };
  function cartaoAvisos() {
    const st = estadoAvisos();
    if (avisosDispensado() || !((st === "desligado") || (st === "iphone" && ehCelular()))) return "";
    const texto = st === "iphone"
      ? `No iPhone, os avisos chegam com o portal na tela de início: no Safari, toque em <b>Compartilhar</b> e em <b>Adicionar à Tela de Início</b>. Depois abra pelo ícone e ative aqui.`
      : ehTime() ? `Saiba na hora quando chegar pedido novo${ehAdmin() ? " ou cadastro para aprovar" : " na sua carteira"}, mesmo com o portal fechado.`
      : `Saiba na hora quando seus leads chegarem e receba o resumo dos contatos do dia, mesmo com o portal fechado.`;
    return `<section class="cartao-avisos" role="region" aria-label="Avisos no celular">${icone("sino")}<div><h2>Receba avisos no celular</h2><p>${texto}</p></div>
      <div class="acoes">${st === "desligado" ? `<button class="btn btn-primario" data-acao="ativarAvisos">Ativar avisos</button>` : ""}<button class="btn" data-acao="dispensarAvisos">Agora não</button></div></section>`;
  }
  function blocoAvisos() {
    const st = estadoAvisos();
    if (API.demo) return "";
    const corpo = {
      carregando: `<p class="sub">Conferindo este aparelho…</p>`,
      ativo: `<p class="selo selo-ok">Avisos ativados neste aparelho</p><p class="sub">${ehTime() ? `Você recebe: pedido novo da sua carteira${ehAdmin() ? ", cadastro para aprovar" : ""} e o resumo do dia às 8h (dias úteis).` : "Você recebe: leads que chegaram, acesso liberado e o resumo dos contatos do dia às 8h (dias úteis)."}</p>
        <button class="btn" data-acao="desativarAvisos">Desativar neste aparelho</button>`,
      desligado: `<p class="sub">${ehTime() ? `Pedido novo da sua carteira${ehAdmin() ? ", cadastro para aprovar" : ""} e o resumo do dia às 8h (dias úteis).` : "Leads que chegaram, acesso liberado e o resumo dos contatos do dia às 8h (dias úteis)."} Os avisos chegam mesmo com o portal fechado.</p>
        <button class="btn btn-primario" data-acao="ativarAvisos">Ativar avisos neste aparelho</button>`,
      bloqueado: `<p class="sub">Os avisos do portal estão bloqueados neste aparelho. Para liberar: ${ehIphone() ? "Ajustes do iPhone › Notificações › <b>Leads</b> › Permitir Notificações" : "toque no cadeado ao lado do endereço (ou em Configurações do app › Notificações) e permita as notificações"}. Depois volte aqui.</p>`,
      iphone: `<p class="sub">No iPhone, os avisos só funcionam com o portal na tela de início. No Safari, toque em <b>Compartilhar</b> › <b>Adicionar à Tela de Início</b>, abra o portal pelo ícone novo e volte aqui para ativar.</p>`,
      "sem-suporte": `<p class="sub">Este navegador não recebe avisos. No celular, use o Chrome (Android) ou o portal instalado na tela de início (iPhone).</p>`
    }[st];
    return `<section class="bloco"><h2>Avisos no celular</h2>${corpo}</section>`;
  }
  async function prepararAvisos() {
    if (AV.suportado !== null || API.demo) return;
    AV.suportado = await API.avisosSuportados().catch(() => false);
    if (AV.suportado) {
      API.conferirAvisos();
      API.aoReceberAviso((n) => { if (n && (n.title || n.body)) aviso(`${n.title ? n.title + ": " : ""}${n.body || ""}`); });
    }
    if (E.perfil && document.getElementById("principal")) desenhar();
    else if (document.getElementById("espera-avisos")) mostrarAvisoEspera();
  }

  async function fechar() {
    if (guardaFechar) { const g = guardaFechar; guardaFechar = null; if (!(await g())) { guardaFechar = g; return; } }
    if ($janela.open) $janela.close();
  }
  // Tocar fora da janela não fecha mais: no celular é fácil tocar fora sem querer e perder o que foi preenchido.
  $janela.addEventListener("cancel", (e) => { if (guardaFechar) { e.preventDefault(); fechar(); } });
  $janela.addEventListener("close", () => { if ($janela.contains($toast)) document.body.appendChild($toast); });

  // ---- Confirmação de toda ação: "Tem certeza?" com o aviãozinho voando ao confirmar ----
  const $conf = document.createElement("dialog");
  $conf.className = "confirmar"; $conf.setAttribute("aria-labelledby", "cf-titulo");
  document.body.appendChild($conf);
  // O avião sempre voa, em qualquer aparelho (decisão do time: vale também para quem pediu "reduzir movimento").
  const AVIAO = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 21.5 L37 20 Q39 20 37 21.6 L3 23 Z" fill="#12306F"/><path d="M16 21.2 L9 32 L13 32 L24 21.4 Z" fill="#1661D8"/><path d="M16 21.4 L9 9.5 L13 9.5 L24 21 Z" fill="#1661D8"/><path d="M3.5 21.6 L1 15.5 L4 15.5 L8 21.4 Z" fill="#1661D8"/></svg>`;
  // Celular e tablet: tela de toque ou estreita. Lá o avião sobe quase reto até o topo, para dar tempo de ver o voo.
  const vooDeToque = () => (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || window.innerWidth < 820;
  // voar(botão ou posição, onde desenhar): o avião sai do botão e sobe. Devolve quanto tempo o voo leva (ms).
  function voar(botao, alvo = $conf) {
    if (!document.body.animate) return 0;
    const r = botao.getBoundingClientRect ? botao.getBoundingClientRect() : botao, x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const rastro = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    rastro.setAttribute("class", "voo-rastro"); rastro.setAttribute("aria-hidden", "true");
    const aviao = document.createElement("div");
    aviao.className = "voo-aviao"; aviao.innerHTML = AVIAO;
    const corpo = alvo === $conf ? $conf.querySelector(".cf-corpo") : null;
    if (vooDeToque()) {
      const tam = 48, W = window.innerWidth;
      const x1 = Math.min(W - tam, x0 + Math.min(110, W * .25)), y1 = -tam * 1.8;
      const cx = x0 + (x1 - x0) * .15 + 28, cy = y0 - (y0 - y1) * .5;
      rastro.innerHTML = `<path d="M${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}" fill="none" stroke="#1661D8" stroke-width="3" stroke-dasharray="7 10" stroke-linecap="round"/>`;
      aviao.style.width = aviao.style.height = tam + "px";
      aviao.style.left = (x0 - tam / 2) + "px"; aviao.style.top = (y0 - tam / 2) + "px";
      alvo.append(rastro, aviao);
      // pontos da curva, com o nariz do avião acompanhando a direção do voo
      const quadros = [], N = 10;
      for (let i = 0; i <= N; i++) {
        const t = i / N, u = 1 - t;
        const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
        const tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
        const ang = Math.atan2(ty, tx) * 180 / Math.PI;
        quadros.push({ transform: `translate(${x - x0}px,${y - y0}px) rotate(${ang}deg) scale(${.75 + .4 * t})`, offset: t });
      }
      aviao.animate(quadros, { duration: 1100, easing: "cubic-bezier(.45,0,.75,.6)", fill: "forwards" });
      rastro.animate([{ clipPath: `inset(${y0}px 0 0 0)`, opacity: 1 }, { clipPath: "inset(0 0 0 0)", opacity: 1, offset: .75 }, { clipPath: "inset(0 0 0 0)", opacity: 0 }], { duration: 1350, easing: "ease-in", fill: "forwards" });
      if (corpo) corpo.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px) scale(.98)" }], { duration: 350, delay: 750, fill: "forwards" });
      return 1250;
    }
    const x1 = Math.min(window.innerWidth + 60, x0 + 300), y1 = -70;
    rastro.innerHTML = `<path d="M${x0} ${y0} Q ${x0 + 120} ${y0 - 120} ${x1} ${y1}" fill="none" stroke="#1661D8" stroke-width="2.5" stroke-dasharray="6 9" stroke-linecap="round"/>`;
    aviao.style.left = (x0 - 20) + "px"; aviao.style.top = (y0 - 20) + "px";
    alvo.append(rastro, aviao);
    const dx = x1 - x0, dy = y1 - y0;
    aviao.animate([
      { transform: "translate(0,0) rotate(-35deg) scale(.7)", opacity: 1 },
      { transform: `translate(${dx * .4}px,${dy * .3}px) rotate(-38deg) scale(1)`, opacity: 1, offset: .45 },
      { transform: `translate(${dx}px,${dy}px) rotate(-55deg) scale(1.1)`, opacity: 1 }
    ], { duration: 750, easing: "ease-in", fill: "forwards" });
    rastro.animate([{ clipPath: `inset(0 ${window.innerWidth - x0}px 0 0)`, opacity: 1 }, { clipPath: "inset(0 0 0 0)", opacity: 1, offset: .7 }, { clipPath: "inset(0 0 0 0)", opacity: 0 }], { duration: 1000, easing: "ease-in", fill: "forwards" });
    if (corpo) corpo.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px) scale(.98)" }], { duration: 300, delay: 450, fill: "forwards" });
    return 820;
  }
  // Avião depois de uma ação que salvou sem passar pelo "Tem certeza?" (Salvar do lead e "Como foi?").
  // Ele voa numa camada própria, por cima de qualquer janela aberta, e some sozinho.
  function voarSolto(origem) {
    const r = origem && origem.getBoundingClientRect ? origem.getBoundingClientRect() : origem;
    if (!r || !r.width) return;
    const camada = document.createElement("div");
    camada.className = "voo-camada"; camada.setAttribute("aria-hidden", "true");
    document.body.appendChild(camada);
    try { camada.setAttribute("popover", "manual"); camada.showPopover(); } catch (e) { camada.removeAttribute("popover"); }
    const tempo = voar(r, camada);
    setTimeout(() => { try { camada.hidePopover(); } catch (e) { } camada.remove(); }, tempo + 300);
  }
  // confirmar({ titulo, texto, botao, perigo }) -> true/false. A ação começa assim que a pessoa confirma; o avião voa por cima.
  function confirmar({ titulo, texto = "", botao = "Confirmar", perigo = false, campo }) {
    return new Promise(resolve => {
      $conf.innerHTML = `<div class="cf-corpo"><h2 id="cf-titulo">${esc(titulo)}</h2>${texto ? `<p>${texto}</p>` : ""}
        ${campo !== undefined ? `<textarea class="cf-campo" aria-label="${esc(titulo)}" maxlength="2000">${esc(campo)}</textarea>` : ""}
        <div class="cf-botoes"><button type="button" class="btn" data-cf="nao">Cancelar</button><button type="button" class="btn ${perigo ? "btn-perigo" : "btn-primario"}" data-cf="sim">${esc(botao)}</button></div></div>`;
      let feito = false;
      const terminar = (ok, botaoSim) => {
        if (feito) return; feito = true;
        const t = $conf.querySelector(".cf-campo");
        resolve(ok && t ? t.value : ok);
        const tempo = ok && botaoSim ? voar(botaoSim) : 0;
        setTimeout(() => { if ($conf.open) $conf.close(); $conf.innerHTML = ""; }, tempo);
      };
      $conf.querySelector('[data-cf="nao"]').onclick = () => terminar(false);
      const sim = $conf.querySelector('[data-cf="sim"]');
      sim.onclick = () => terminar(true, sim);
      $conf.oncancel = (e) => { e.preventDefault(); terminar(false); };
      $conf.onclick = (e) => { if (e.target === $conf) terminar(false); };
      $conf.showModal();
      ($conf.querySelector(".cf-campo") || (perigo ? $conf.querySelector('[data-cf="nao"]') : sim)).focus();
    });
  }

  // escolher({ titulo, texto, opcoes: [{ id, rotulo, tipo }] }) -> id da opção escolhida (null se fechar). Para perguntas com mais de dois caminhos.
  function escolher({ titulo, texto = "", opcoes }) {
    return new Promise(resolve => {
      $conf.innerHTML = `<div class="cf-corpo"><h2 id="cf-titulo">${esc(titulo)}</h2>${texto ? `<p>${texto}</p>` : ""}
        <div class="cf-botoes cf-escolhas">${opcoes.map(o => `<button type="button" class="btn ${o.tipo === "primario" ? "btn-primario" : o.tipo === "perigo" ? "btn-perigo-leve" : ""}" data-escolha="${esc(o.id)}">${esc(o.rotulo)}</button>`).join("")}</div></div>`;
      let feito = false;
      const terminar = (v) => { if (feito) return; feito = true; resolve(v); if ($conf.open) $conf.close(); $conf.innerHTML = ""; };
      $conf.querySelectorAll("[data-escolha]").forEach(b => b.onclick = () => terminar(b.dataset.escolha));
      $conf.oncancel = (e) => { e.preventDefault(); terminar(null); };
      $conf.onclick = (e) => { if (e.target === $conf) terminar(null); };
      $conf.showModal();
      ($conf.querySelector(".btn-primario") || $conf.querySelector("[data-escolha]")).focus();
    });
  }

  // Celular ou computador: no computador, "Ligar" mostra o número em vez de abrir um link de telefone que não faz nada.
  const ehCelular = () => (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

  // Mostrar a senha: todo campo de senha ganha um botão "Mostrar" (inclusive os que aparecem depois, em janelas e telas novas).
  function olhoSenha(raiz) {
    (raiz || document).querySelectorAll('input[type="password"]:not([data-olho])').forEach(inp => {
      inp.dataset.olho = "1";
      const caixa = document.createElement("span"); caixa.className = "senha-caixa";
      inp.parentNode.insertBefore(caixa, inp); caixa.appendChild(inp);
      const b = document.createElement("button"); b.type = "button"; b.className = "senha-olho"; b.textContent = "Mostrar";
      b.setAttribute("aria-label", "Mostrar a senha"); b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        const ver = inp.type === "password"; inp.type = ver ? "text" : "password";
        b.textContent = ver ? "Ocultar" : "Mostrar"; b.setAttribute("aria-pressed", String(ver)); b.setAttribute("aria-label", ver ? "Ocultar a senha" : "Mostrar a senha");
        inp.focus();
      });
      caixa.appendChild(b);
    });
  }
  new MutationObserver(() => olhoSenha()).observe(document.body, { childList: true, subtree: true });

  // Executivo, coordenador e gerente trabalham numa carteira, não numa unidade: os textos acompanham.
  const ehExec = () => !!(E.perfil && E.perfil.cargo === "Executivo");
  const suaU = () => ehExec() ? "sua carteira" : "sua unidade";
  const estaU = () => ehExec() ? "Sua carteira" : "Esta unidade";

  // Situação do pedido em palavras simples para quem pede (o time continua vendo os nomes de trabalho).
  const SITUACAO_REP = { "Nova": "Recebido pelo time", "Em extração": "Separando seus leads", "Enviada": "Seus leads chegaram", "Concluída": "Pedido fechado", "Sem leads": "Sem leads encontrados", "Cancelada": "Cancelado" };
  const situacaoTexto = (s) => ehTime() ? s : (SITUACAO_REP[s] || s);

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
  // Dono da unidade: convida e libera a equipe (vendedores) da unidade.
  const unidadesDono = () => E.perfil && !ehTime() ? minhasUnidades().filter(u => u.dono_uid === E.perfil.id) : [];
  const pendentesEquipe = () => Object.values(E.equipe || {}).reduce((n, q) => n + q.pessoas.filter(p => p.situacao === "pendente" && p.uid !== E.perfil.id).length, 0);
  const rotuloLongo = (sigla) => infoUnidade(sigla).nome || "Unidade " + sigla;
  function escolherUnidade(sigla) { E.u = sigla; try { localStorage.setItem("portal-unidade", sigla); } catch (e) { /* sem armazenamento */ } }

  // ------------------------------------------------------------------
  // Início
  // ------------------------------------------------------------------
  async function iniciar() {
    if (API.demo) document.getElementById("faixa-demo").hidden = false;
    // A atualização automática recarrega com ?v=versão (para não usar a cópia antiga); depois de carregar, o endereço volta a ser só o do portal.
    try {
      const q = new URLSearchParams(location.search);
      if (q.has("v")) { q.delete("v"); const resto = q.toString(); history.replaceState(null, "", location.pathname + (resto ? "?" + resto : "") + location.hash); }
    } catch (e) { /* ignora */ }
    // Link de convite do dono da unidade: ?convite=CODIGO
    const convite = new URLSearchParams(location.search).get("convite");
    if (convite && !E.conviteVisto) { E.conviteVisto = true; return telaConvite(convite); }
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
      E.tela = E.tela || (ehTime() ? "hoje" : "leads");
      if (!ehAdmin() && E.f.cadastro === "pendente") E.f.cadastro = "aprovado";
      // O time vê leads de todas as unidades: a Lista é mais leve que o Quadro para centenas de leads.
      if (ehTime() && !E.vistaEscolhida) E.vista = "lista";
      await carregar();
      desenhar();
      ligarTempoReal();
      if (E.boasVindas) { aviso(`Bem-vindo! Seu acesso à unidade ${E.boasVindas} já está liberado.`); E.boasVindas = null; }
      if (E.senhaNova) { aviso("Senha nova criada. Use ela nas próximas vezes que entrar."); E.senhaNova = false; }
      talvezTour();
    } catch (e) {
      $app.innerHTML = `<div class="carregando"><div class="vazio"><h2>Não foi possível abrir o portal</h2><p>${esc(API.traduzir(e))}</p><button class="btn btn-primario" onclick="location.reload()">Tentar de novo</button></div></div>`;
    }
  }

  async function carregar() {
    if (ehTime()) {
      // Administrador carrega tudo; o time, só as regiões que ele vê (carteira dele, substituição e regiões livres).
      E.carteiras = await API.carteiras();
      const [pedidos, perfis, acessos, unidades] = await Promise.all([ehAdmin() ? API.pedidos() : API.pedidos(null, regioesVisiveis()), API.perfis(), API.acessos(), API.unidades()]);
      Object.assign(E, { pedidos, perfis, acessos, unidades });
      if (ehAdmin() && !E.siglasSincronizadas) { E.siglasSincronizadas = true; API.sincronizarSiglas(unidades.map(u => ({ ...u }))); } // cópia: a cidade é padronizada logo abaixo só para a tela
    } else {
      // Representante: relê o próprio cadastro (unidade liberada aparece na hora, sem recarregar a página).
      const p = await API.meuPerfil();
      if (p) E.perfil = p;
      if (!minhasUnidades().some(u => u.sigla === E.u)) E.u = (minhasUnidades()[0] || {}).sigla;
      E.pedidos = await API.pedidos(minhasUnidades().map(u => u.sigla));
      // Dono da unidade: equipe e convites de cada unidade dele.
      const equipe = {};
      await Promise.all(unidadesDono().map(async u => {
        try { const [pessoas, convites] = await Promise.all([API.equipe(u.sigla), API.convites(u.sigla)]); equipe[u.sigla] = { pessoas, convites }; }
        catch (e) { equipe[u.sigla] = { pessoas: [], convites: [], erro: API.traduzir(e) }; }
      }));
      E.equipe = equipe;
    }
    if (!ehTime()) {
      E.carteiras = await API.carteiras();
      if (!E.segmentosRegiao) E.segmentosRegiao = await API.segmentosRegiao();
      // Coordenador e gerente: carteiras de quem responde a ele (só consulta).
      if (ehExec()) {
        try {
          E.equipeComercial = (await API.equipeComercial()).filter(u => u.sigla !== (E.perfil.siglaPrincipal || ""));
          E.pedidosEquipe = E.equipeComercial.length ? await API.pedidos(E.equipeComercial.map(u => u.sigla)) : [];
        } catch (e) { E.equipeComercial = []; E.pedidosEquipe = []; E.erroEquipe = API.traduzir(e); }
        E.leadsEquipe = API.leadsDe(E.pedidosEquipe);
      }
    }
    // Cidades gravadas antes da padronização aparecem certas na tela ("oSASCO/sP" -> "Osasco/SP").
    [E.pedidos, E.unidades, (E.perfil && E.perfil.unidades) || []].forEach(lista => (lista || []).forEach(x => { if (x && x.cidade_uf) x.cidade_uf = cidadeUf(x.cidade_uf); }));
    E.leads = API.leadsDe(E.pedidos);
    if (ehAdmin() && !E.segmentosPublicados) {
      E.segmentosPublicados = true;
      API.segmentosRegiao().then(d => { E.segmentosRegiao = d; publicarSegmentos(); });
    }
  }
  async function recarregar() { await carregar(); desenhar(); ligarTempoReal(); }

  // Tempo real: quando algo muda no banco, a tela se atualiza sozinha.
  // Se tiver uma janela aberta ou a pessoa estiver digitando, espera ela terminar para não atrapalhar.
  let pararObservar = null, chaveObservar = "", atualizarDepois = false, timerTempoReal = null;
  function ligarTempoReal() {
    if (!E.perfil || E.perfil.situacao !== "aprovado") return;
    const siglas = ehTime() ? null : minhasUnidades().map(u => u.sigla);
    const donas = ehTime() ? [] : unidadesDono().map(u => u.sigla);
    const regs = ehTime() && !ehAdmin() ? regioesVisiveis() : null;
    const chave = siglas ? siglas.join(",") + "|" + donas.join(",") : "time|" + (regs ? regs.join(",") : "todas");
    if (pararObservar && chave === chaveObservar) return;
    if (pararObservar) pararObservar();
    chaveObservar = chave;
    pararObservar = API.observar(siglas, () => { clearTimeout(timerTempoReal); timerTempoReal = setTimeout(atualizarSozinho, 700); }, donas, regs);
  }
  function ocupadoAgora() {
    const a = document.activeElement;
    return $janela.open || $conf.open || !!document.querySelector(".tour") || (a && $app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  async function atualizarSozinho() {
    if (ocupadoAgora()) { atualizarDepois = true; return; }
    atualizarDepois = false;
    const y = window.scrollY, q = document.querySelector(".quadro"), qx = q ? q.scrollLeft : 0;
    try { await carregar(); desenhar(); } catch (e) { return; }
    window.scrollTo(0, y); const q2 = document.querySelector(".quadro"); if (q2) q2.scrollLeft = qx;
    ligarTempoReal();
  }
  $janela.addEventListener("close", () => { if (atualizarDepois) setTimeout(atualizarSozinho, 300); });
  document.addEventListener("focusout", () => { if (atualizarDepois) setTimeout(() => { if (atualizarDepois) atualizarSozinho(); }, 400); });

  // ------------------------------------------------------------------
  // Acesso: entrar e criar cadastro
  // ------------------------------------------------------------------
  // Lado esquerdo das telas de entrada (entrar, criar acesso e convite).
  const ladoAcesso = () => `
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
          <p class="rodape-lado">Ferramenta interna do time de ${esc(TIME)}. Este portal tem login próprio e não usa a senha da sua conta Azul.${AUTORIA}</p>
        </section>`;

  // Esqueci minha senha: o e-mail de redefinição não chega na caixa da Azul, então o caminho principal é pedir ao time pelo WhatsApp.
  // A mensagem vai para quem do time cuida da região da pessoa (carteiras do time, com o substituto das férias).
  // O time refaz o acesso e manda um link para a pessoa criar a senha nova (veja janelaSenha).
  const msgEsqueci = (email) => `Olá! Esqueci minha senha do ${cfg.nomeDoPortal || "Portal de Leads"}. Meu e-mail de acesso é ${email || "(meu e-mail)"}. Pode refazer meu acesso, por favor?`;
  // Quem do time atende uma região. Região sem responsável fixo: vai para o primeiro responsável das outras regiões.
  function contatoDoTime(regiao) {
    const r = regiao ? responsavelRegiao(regiao) : null;
    if (r && fone(r.celular)) return { ...r, regiao, daRegiao: true };
    const outra = L.regioes.map(x => responsavelRegiao(x)).find(x => x && fone(x.celular));
    if (outra) return { ...outra, regiao, daRegiao: false };
    return cfg.whatsappTime ? { nome: "time de " + TIME, celular: cfg.whatsappTime, regiao, daRegiao: false } : null;
  }
  // ---- Cidades: autocompletar com a lista oficial de municípios (IBGE) ----
  // A lista (js/municipios.js, ~75 KB) só é baixada quando alguém começa a digitar uma cidade.
  let municipiosPromessa = null, MUN = null;
  function carregarMunicipios() {
    if (window.MUNICIPIOS) return Promise.resolve();
    if (!municipiosPromessa) municipiosPromessa = new Promise((ok, erro) => {
      const sc = document.createElement("script");
      sc.src = "js/municipios.js?v=" + encodeURIComponent(VERSAO || "1");
      sc.onload = ok; sc.onerror = () => { municipiosPromessa = null; erro(new Error("lista de cidades")); };
      document.head.append(sc);
    });
    return municipiosPromessa;
  }
  function listaMunicipios() {
    if (!MUN && window.MUNICIPIOS) {
      MUN = [];
      Object.entries(window.MUNICIPIOS).forEach(([uf, nomes]) => nomes.split("|").forEach(n => MUN.push({ t: `${n}/${uf}`, n, k: norm(n), uf })));
    }
    return MUN || [];
  }
  const regiaoDaCidade = (t) => { const uf = String(t || "").split("/")[1]; return (window.REGIAO_DA_UF || {})[uf] || ""; };
  // Liga o autocompletar num campo de cidade. "regiao" (opcional): select de região preenchido pela UF, se estiver vazio.
  function ligarCidade(input, regiao) {
    if (!input || input.dataset.cidadeLigada) return;
    input.dataset.cidadeLigada = "1";
    input.setAttribute("autocomplete", "off");
    const caixaPai = document.createElement("span"); caixaPai.className = "cidade-wrap";
    input.parentNode.insertBefore(caixaPai, input); caixaPai.append(input);
    const lista = document.createElement("div"); lista.className = "lista-cidades"; lista.hidden = true; lista.setAttribute("role", "listbox");
    caixaPai.append(lista);
    const fecharLista = () => { lista.hidden = true; lista.innerHTML = ""; };
    const escolher = (t) => {
      input.value = t; fecharLista();
      if (regiao && (!regiao.value || regiao.dataset.auto)) { const r = regiaoDaCidade(t); if (r && L.regioes.includes(r)) { regiao.value = r; regiao.dataset.auto = "1"; } }
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const filtrar = async () => {
      const q = input.value.trim();
      if (q.length < 2) return fecharLista();
      try { await carregarMunicipios(); } catch (e) { return; } // sem a lista, o campo continua aceitando texto livre
      if (input.value.trim() !== q) return;
      const [nomeQ, ufQ] = q.split("/");
      const k = norm(nomeQ), uf = String(ufQ || "").trim().toUpperCase();
      const base = listaMunicipios().filter(m => !uf || m.uf.startsWith(uf));
      const comeca = base.filter(m => m.k.startsWith(k)).sort((a, b) => a.k.length - b.k.length || a.k.localeCompare(b.k));
      const contem = k.length >= 3 ? base.filter(m => !m.k.startsWith(k) && m.k.includes(k)).sort((a, b) => a.k.localeCompare(b.k)) : [];
      const achados = comeca.concat(contem).slice(0, 8);
      if (!achados.length || (achados.length === 1 && achados[0].t === q)) return fecharLista();
      lista.innerHTML = achados.map((m, i) => `<button type="button" role="option" tabindex="-1" data-cid="${esc(m.t)}"${i === 0 ? ' class="ativo"' : ""}>${esc(m.n)}<small>/${m.uf}</small></button>`).join("");
      lista.hidden = false;
      lista.querySelectorAll("[data-cid]").forEach(b => b.addEventListener("mousedown", (e) => { e.preventDefault(); escolher(b.dataset.cid); }));
    };
    input.addEventListener("input", filtrar);
    input.addEventListener("focus", () => { carregarMunicipios().catch(() => {}); });
    input.addEventListener("keydown", (e) => {
      if (lista.hidden) return;
      const bs = [...lista.querySelectorAll("[data-cid]")]; let i = bs.findIndex(b => b.classList.contains("ativo"));
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (bs[i]) bs[i].classList.remove("ativo");
        i = (i + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length; bs[i].classList.add("ativo"); bs[i].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") { e.preventDefault(); if (bs[i]) escolher(bs[i].dataset.cid); }
      else if (e.key === "Escape") { e.preventDefault(); fecharLista(); }
    });
    input.addEventListener("blur", () => setTimeout(fecharLista, 150));
    if (regiao) regiao.addEventListener("change", () => { delete regiao.dataset.auto; });
  }

  function janelaEsqueci(emailDigitado) {
    abrir(`
      <div class="janela-topo"><div><h2>Esqueceu a senha?</h2><p>Sem problema. O time de ${esc(TIME)} resolve pelo WhatsApp.</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <ol class="passos-senha">
          <li><span class="n">1</span><span>Confira o seu e-mail, escolha a sua região e clique em <b>Pedir pelo WhatsApp</b>. A mensagem já vai pronta.</span></li>
          <li><span class="n">2</span><span>Quem do time cuida da sua região refaz o seu acesso e manda um <b>link</b> de volta.</span></li>
          <li><span class="n">3</span><span>Abra o link, crie a senha nova e pronto: você entra direto, com seus leads e pedidos.</span></li>
        </ol>
        <div class="campo"><label for="es-email">E-mail de acesso</label><input id="es-email" type="email" autocomplete="email" placeholder="sigla.nome@voeazul.com.br" value="${esc(emailDigitado || "")}"></div>
        <div class="campo"><label for="es-regiao">Sua região</label><select id="es-regiao">${opcoes(L.regioes, "", "Escolha a região")}</select>
          <span class="dica" id="es-quem">Carregando quem atende cada região…</span></div>
        <div class="erro-form" id="es-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><a class="btn btn-zap" id="es-zap" href="#" target="_blank" rel="noopener">Pedir pelo WhatsApp</a></div>`,
    async (j) => {
      const campo = j.querySelector("#es-email"), reg = j.querySelector("#es-regiao"), zapBt = j.querySelector("#es-zap"), erroEl = j.querySelector("#es-erro"), quem = j.querySelector("#es-quem");
      let carregou = false;
      const atualizar = () => {
        erroEl.hidden = true;
        if (!carregou) return;
        const c = contatoDoTime(reg.value);
        if (!c) { quem.textContent = "Não encontramos o contato do time. Fale com quem te passou o link do portal."; zapBt.href = "#"; return; }
        quem.textContent = !reg.value ? "Escolha a região para ver quem vai te atender."
          : c.daRegiao ? `A mensagem vai para ${primeiroNome(c.nome)}, que cuida da região ${reg.value}${c.substituindo ? ` (cobrindo ${primeiroNome(c.substituindo)})` : ""}.`
          : `A região ${reg.value} está sem responsável fixo. A mensagem vai para ${primeiroNome(c.nome)}, do time de ${TIME}.`;
        zapBt.href = zap(c.celular, msgEsqueci(campo.value.trim().toLowerCase()));
      };
      campo.addEventListener("input", atualizar); reg.addEventListener("change", atualizar);
      zapBt.addEventListener("click", (ev) => {
        const falha = (m, el) => { ev.preventDefault(); erroEl.textContent = m; erroEl.hidden = false; el.focus(); };
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(campo.value.trim())) return falha("Digite o e-mail que você usa para entrar no portal.", campo);
        if (!reg.value) return falha("Escolha a sua região.", reg);
        if (!contatoDoTime(reg.value)) return falha("Não encontramos o contato do time. Fale com quem te passou o link do portal.", reg);
      });
      try { E.carteiras = await API.carteiras(); } catch (e) { E.carteiras = { regioes: {} }; }
      carregou = true; atualizar();
    });
  }

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
        <div class="campo"><label id="c-eusou">Eu sou</label><div class="escolha" role="radiogroup" aria-labelledby="c-eusou">
          ${CARGOS.map((c, i) => `<label${i === 0 ? "" : ' class="c-outro" hidden'}><input type="radio" name="c-cargo" value="${esc(c)}"${i === 0 ? " checked" : ""}> ${esc(c === "Inside Sales" ? "Time de " + TIME : c === "Executivo" ? "Executivo, coordenador ou gerente" : "Representante de unidade")}</label>`).join("")}</div>
          <button type="button" class="link-btn link-pequeno" id="c-mais">Não sou representante: sou do time ou executivo</button></div>
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
        <p class="dica dica-solta so-exec" hidden>A região define quem do time de ${esc(TIME)} cuida dos seus pedidos de leads.</p>
        ${refazer ? "" : `<div class="aviso-senha">${icone("cadeado")}<span>Crie uma senha só para este portal. Não use a senha da sua conta Azul.</span></div>`}
        <div class="campo"${refazer ? " hidden" : ""}><label for="c-senha">Crie uma senha</label><input id="c-senha" type="password" autocomplete="new-password" required minlength="8"><span class="dica">Mínimo de 8 caracteres. Use “Mostrar” para conferir o que digitou.</span></div>
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
        ${ladoAcesso()}
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
      document.getElementById("b-esqueci").addEventListener("click", () => janelaEsqueci(document.getElementById("e-email").value.trim()));
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
      document.getElementById("c-mais").addEventListener("click", (ev) => {
        fc.querySelectorAll(".c-outro").forEach(el => el.hidden = false);
        ev.currentTarget.hidden = true;
        (fc.querySelector(".c-outro input") || {}).focus && fc.querySelector(".c-outro input").focus();
      });
      // Unidade que já existe no portal: cidade e região vêm preenchidas pela sigla.
      const cidadeEl = document.getElementById("c-cidade"), regiaoEl = document.getElementById("c-regiao");
      let tSigla = null, ultimaSigla = "";
      const buscarSigla = () => {
        clearTimeout(tSigla);
        tSigla = setTimeout(async () => {
          const sg = sigla.value.trim().toUpperCase();
          if (sg.length < 3 || sg === ultimaSigla || cargo() !== "Representante") return;
          ultimaSigla = sg;
          const info = await API.infoSigla(sg);
          if (!info || sigla.value.trim().toUpperCase() !== sg) return;
          if (info.cidade_uf && (!cidadeEl.value.trim() || cidadeEl.dataset.auto)) { cidadeEl.value = cidadeUf(info.cidade_uf); cidadeEl.dataset.auto = "1"; }
          if (info.regiao && L.regioes.includes(info.regiao) && (!regiaoEl.value || regiaoEl.dataset.auto)) { regiaoEl.value = info.regiao; regiaoEl.dataset.auto = "1"; }
          let d = document.getElementById("c-sigla-dica");
          if (!d) { d = document.createElement("span"); d.id = "c-sigla-dica"; d.className = "dica dica-ok"; sigla.parentNode.append(d); }
          d.textContent = `Unidade ${sg} encontrada: preenchemos a cidade e a região. Confira.`;
        }, 400);
      };
      email.addEventListener("input", () => { if (!sigla.dataset.mexeu) sigla.value = API.siglaDoEmail(email.value).slice(0, 10); buscarSigla(); });
      sigla.addEventListener("input", () => { sigla.dataset.mexeu = "1"; buscarSigla(); });
      cidadeEl.addEventListener("input", () => { delete cidadeEl.dataset.auto; });
      ligarCidade(cidadeEl, regiaoEl);
      regiaoEl.addEventListener("change", () => { delete regiaoEl.dataset.auto; });
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
        try {
          const r = await ocupado(fc.querySelector("button[type=submit]"), () => API.cadastrar(em, v("c-senha"), {
            nome: v("c-nome"), celular: v("c-cel"), sigla: sg, cidade_uf: cidadeUf(v("c-cidade")), regiao: v("c-regiao"), time: ehDoTime, cargo: cargo()
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

  // Convite do dono da unidade: a pessoa cria a senha e já entra liberada na unidade.
  const VALIDADE_CONVITE = 7;
  const conviteVencido = (c) => Date.now() - new Date(c.criado_em).getTime() > VALIDADE_CONVITE * DIA;
  const linkConvite = (codigo, novaSenha) => urlPortal() + "?convite=" + encodeURIComponent(codigo) + (novaSenha ? "&nova=1" : "");
  const tirarConviteDaUrl = () => { try { history.replaceState(null, "", location.pathname); } catch (e) { /* ignora */ } };
  async function telaConvite(codigo) {
    $app.innerHTML = `<div class="carregando"><p class="sub">Abrindo o convite…</p></div>`;
    const c = await API.lerConvite(codigo);
    const nova = new URLSearchParams(location.search).get("nova") === "1";
    const sessao = await API.sessao().catch(() => null);
    const caixa = (html) => { $app.innerHTML = `<div class="acesso">${ladoAcesso()}<section class="acesso-form"><div class="acesso-caixa">${html}</div></section></div>`; };
    const irEntrar = () => { tirarConviteDaUrl(); E.tela = null; iniciar(); };
    const aviso1 = (titulo, texto) => {
      caixa(`<h2>${titulo}</h2><p class="sub">${texto}</p><button class="btn btn-primario btn-largo" id="v-entrar">Ir para a entrada do portal</button>`);
      document.getElementById("v-entrar").onclick = async () => { if (sessao) await sair(); irEntrar(); };
    };
    const quemPede = nova ? `o time de ${esc(TIME)}` : "o dono da sua unidade";
    if (!c) return aviso1(nova ? "Link não encontrado" : "Convite não encontrado", `O link pode ter sido cancelado ou copiado pela metade. Peça um novo para ${quemPede}.`);
    if (c.usado) return aviso1(nova ? "Este link já foi usado" : "Este convite já foi usado", `O acesso de <b>${esc(c.email)}</b> já foi criado. Entre com esse e-mail e a senha que você escolheu.`);
    if (conviteVencido(c)) return aviso1(nova ? "Este link venceu" : "Este convite venceu", `O link vale ${VALIDADE_CONVITE} dias. Peça um novo para ${nova ? quemPede : esc(c.criado_por_nome || "o dono da unidade")}.`);
    if (sessao && sessao.email !== c.email) {
      caixa(`<h2>Você está conectado com outro e-mail</h2><p class="sub">Este convite é para <b>${esc(c.email)}</b>, mas o portal está aberto como <b>${esc(sessao.email)}</b>.</p>
        <button class="btn btn-primario btn-largo" id="v-trocar">Sair e continuar o convite</button>`);
      document.getElementById("v-trocar").onclick = async () => { await API.sair(); E.perfil = null; telaConvite(codigo); };
      return;
    }
    caixa(`
      ${nova ? `<p class="selo selo-ok" style="margin:0 0 10px">Nova senha · unidade ${esc(c.sigla)}</p>
      <h2>Criar minha senha nova</h2>
      <p class="sub"><b>${esc(c.criado_por_nome || "O time")}</b>, do time de ${esc(TIME)}, refez o seu acesso. Confira seus dados, crie a senha nova e você já entra liberado, com seus leads e pedidos.</p>` : `<p class="selo selo-ok" style="margin:0 0 10px">Convite da unidade ${esc(c.sigla)}</p>
      <h2>Criar meu acesso</h2>
      <p class="sub"><b>${esc(c.criado_por_nome || "O dono da unidade")}</b> convidou você para a equipe da unidade <b>${esc(c.sigla)}</b>. Crie sua senha e você já entra liberado, sem esperar aprovação.</p>`}
      <form id="f-convite" novalidate>
        <div class="campo"><label for="v-nome">Nome completo</label><input id="v-nome" type="text" autocomplete="name" required value="${esc(c.nome)}"></div>
        <div class="campo"><label for="v-email">E-mail Azul</label><input id="v-email" type="email" value="${esc(c.email)}" readonly aria-readonly="true"><span class="dica">É o e-mail do convite e vira o seu login.</span></div>
        <div class="campo"><label for="v-cel">Celular com DDD</label><input id="v-cel" type="tel" autocomplete="tel" required value="${esc(foneBonito(c.celular || ""))}" placeholder="(11) 90000-0000"></div>
        <div class="aviso-senha">${icone("cadeado")}<span>Crie uma senha só para este portal. Não use a senha da sua conta Azul.</span></div>
        <div class="campo"><label for="v-senha">Crie uma senha</label><input id="v-senha" type="password" autocomplete="new-password" required minlength="8"><span class="dica">Mínimo de 8 caracteres. Use “Mostrar” para conferir o que digitou.</span></div>
        <div class="erro-form" id="v-erro" hidden></div>
        <button class="btn btn-primario btn-largo" type="submit">${nova ? "Criar senha e entrar" : "Criar acesso e entrar"}</button>
      </form>
      <p class="sub" style="margin-top:18px">${nova ? "Já criou a senha nova?" : "Já tem acesso?"} <button class="link-btn" id="v-ja">Entrar</button></p>`);
    document.getElementById("v-ja").onclick = irEntrar;
    const f = document.getElementById("f-convite");
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const v = (id) => document.getElementById(id).value.trim();
      const erroEl = document.getElementById("v-erro");
      const mostrar = (m) => { erroEl.textContent = m; erroEl.hidden = false; };
      const cel = celularLimpo(v("v-cel"));
      if (v("v-nome").length < 2) return mostrar("Digite seu nome completo.");
      if (!cel) return mostrar("Informe o celular com DDD, por exemplo (11) 91234-5678.");
      if (v("v-senha").length < 8) return mostrar("A senha precisa ter pelo menos 8 caracteres.");
      try {
        await ocupado(f.querySelector("button[type=submit]"), () => API.cadastrarComConvite(codigo, v("v-senha"), { nome: v("v-nome"), celular: cel }));
        tirarConviteDaUrl(); E.tela = null; if (nova) E.senhaNova = true; else E.boasVindas = c.sigla; iniciar();
      } catch (e) {
        mostrar(e && e.code === "auth/email-already-in-use"
          ? (nova ? `O login antigo de ${c.email} ainda existe. Avise o time de ${TIME} para terminar de refazer o seu acesso e tente de novo.` : `O e-mail ${c.email} já tem acesso ao portal. Clique em Entrar e use a sua senha.`)
          : API.traduzir(e));
      }
    });
  }

  function telaEspera() {
    const p = E.perfil;
    const recusado = ["recusado", "excluido"].includes(p.situacao);
    const faltaAcesso = p.situacao === "aprovado"; // aprovado, mas sem unidade liberada ou sem acesso de time
    const unid = (p.unidades || []).map(u => u.nome ? "da sua carteira" : "da unidade " + u.sigla).join(", ");
    const principal = (p.unidades || []).find(u => u.principal) || {};
    const dono = principal.dono_uid && principal.dono_uid !== p.id ? principal.dono_nome : "";
    $app.innerHTML = `
      <div class="carregando"><div class="vazio" style="max-width:520px">
        ${!recusado && E.cadastroNovo ? `<p class="selo selo-ok" style="margin:0 auto 10px">Cadastro realizado</p>` : ""}
        <h2>${recusado ? "Seu acesso não foi aprovado" : faltaAcesso ? "Cadastro aprovado, falta liberar o acesso" : E.cadastroNovo ? "Recebemos seu cadastro" : "Cadastro aguardando aprovação"}</h2>
        <p>${recusado
          ? `Fale com o time de ${esc(TIME)} para revisar o seu cadastro.`
          : faltaAcesso ? `Seu cadastro foi aprovado, mas o time de ${esc(TIME)} ainda precisa liberar ${p.cargo === "Inside Sales" ? "o seu acesso de time" : "a sua unidade"}. Assim que liberar, clique em “Já fui aprovado”.`
          : dono ? `${esc(dono)}, dono da unidade ${esc(principal.sigla)}, ou o time de ${esc(TIME)} vai conferir seus dados e liberar o acesso. Assim que liberarem, o portal abre sozinho.`
          : `O time de ${esc(TIME)} vai conferir seus dados e liberar o acesso${unid ? " " + esc(unid) : ""}. Assim que liberarem, o portal abre sozinho.`}</p>
        <div id="espera-contato" class="espera-contato" hidden></div>
        <div id="espera-avisos" class="espera-contato" hidden></div>
        <div class="acoes" style="justify-content:center">
          <button class="btn" id="b-atualizar">Já fui aprovado</button>
          <button class="btn" id="b-celular">Alterar meu celular</button>
          <button class="btn" id="b-sair">Sair</button>
        </div>
        <p class="sub" style="margin-top:12px">Seu celular: ${esc(foneBonito(p.celular || "") || "não informado")}</p>
      </div></div>`;
    document.getElementById("b-atualizar").onclick = () => iniciar();
    // Entra sozinho quando o time aprovar (sem precisar clicar em "Já fui aprovado").
    if (pararObservar) pararObservar();
    chaveObservar = "espera";
    pararObservar = API.observar([], () => { if (pararObservar) { pararObservar(); pararObservar = null; chaveObservar = ""; } iniciar(); });
    document.getElementById("b-celular").onclick = () => janelaCelular();
    document.getElementById("b-sair").onclick = sair;
    if (!recusado) { if (AV.suportado === null) prepararAvisos(); else mostrarAvisoEspera(); }
    // Botão para falar com quem do time cuida da região (ou do Sudeste, se a região estiver livre).
    (async () => {
      try { E.carteiras = await API.carteiras(); } catch (e) { return; }
      const caixa = document.getElementById("espera-contato");
      const c = contatoDoTime(principal.regiao || (p.unidades || [])[0] && p.unidades[0].regiao);
      if (!caixa || !c) return;
      const quemSou = `${primeiroNome(p.nome)}${principal.sigla && !principal.nome ? ", da unidade " + principal.sigla : ""}`;
      const msg = recusado
        ? `Olá, ${primeiroNome(c.nome)}! Aqui é ${quemSou}. Meu cadastro no ${cfg.nomeDoPortal || "Portal de Leads"} (${p.email}) não foi aprovado. Pode me ajudar?`
        : `Olá, ${primeiroNome(c.nome)}! Aqui é ${quemSou}. Fiz meu cadastro no ${cfg.nomeDoPortal || "Portal de Leads"} com o e-mail ${p.email} e estou aguardando a liberação.`;
      caixa.innerHTML = `<p class="sub">Dúvidas? Quem atende ${c.daRegiao ? "a sua região" : "o portal"} é <b>${esc(primeiroNome(c.nome))}</b>, do time de ${esc(TIME)}.</p>
        <a class="btn btn-zap" href="${esc(zap(c.celular, msg))}" target="_blank" rel="noopener">Falar com ${esc(primeiroNome(c.nome))} no WhatsApp</a>`;
      caixa.hidden = false;
    })();
  }

  // Tela de espera: oferece avisar no celular quando o acesso for liberado.
  function mostrarAvisoEspera() {
    const caixa = document.getElementById("espera-avisos");
    if (!caixa) return;
    const st = estadoAvisos();
    if (st === "ativo") { caixa.innerHTML = `<p class="sub">✓ Avisos ativados: você recebe uma notificação quando o acesso for liberado.</p>`; caixa.hidden = false; return; }
    if (st !== "desligado") { caixa.hidden = true; return; }
    caixa.innerHTML = `<p class="sub">Quer saber na hora em que o acesso for liberado?</p><button class="btn" id="b-avisos-espera">Avisar no celular</button>`;
    caixa.hidden = false;
    document.getElementById("b-avisos-espera").onclick = async (ev) => {
      const b = ev.currentTarget;
      try { const r = await ocupado(b, () => API.ativarAvisos(true)); if (r.ok) { voarSolto(b); aviso("Pronto! Avisamos neste aparelho quando liberarem."); } else if (r.motivo === "denied") aviso("Os avisos foram bloqueados neste aparelho.", true); }
      catch (e) { aviso("Não foi possível ativar os avisos agora.", true); }
      mostrarAvisoEspera();
    };
  }

  async function sair() { if (pararObservar) { pararObservar(); pararObservar = null; chaveObservar = ""; } await API.sair(); E.perfil = null; E.tela = null; telaAcesso("entrar"); }

  // ------------------------------------------------------------------
  // Estrutura com menu lateral
  // ------------------------------------------------------------------
  // ---- Carteiras: quem cuida de cada região ----
  const listaE = (xs) => xs.length > 1 ? xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1] : (xs[0] || "");
  const timeAprovado = () => (E.perfis || []).filter(x => ["time", "admin"].includes(x.papel) && x.situacao === "aprovado");
  // Substitutos nas férias: cada pessoa do time pode ter o seu, com a sua data ({ uid: { para, ate } }).
  // Carteiras salvas antes guardavam um substituto só ({ de, para, ate }); ele continua valendo.
  function substitutosDe(c) {
    const m = { ...((c && c.substitutos) || {}) };
    const v = c && c.substituto;
    if (v && v.de && v.para && !m[v.de]) m[v.de] = { para: v.para, ate: v.ate || "" };
    return m;
  }
  function substitutoAtivo(c, uid) {
    const s = uid ? substitutosDe(c)[uid] : null;
    return s && s.para && s.para.uid && (!s.ate || hojeISO() <= s.ate) ? s : null;
  }
  function responsavelRegiao(regiao) {
    const c = E.carteiras || {}, r = (c.regioes || {})[regiao] || null;
    const sub = r ? substitutoAtivo(c, r.uid) : null;
    if (sub) return { ...sub.para, substituindo: r.nome };
    return r;
  }
  // Dono do pedido: quem assumiu ou puxou; sem ninguém, o responsável da região. null = pedido livre.
  function donoPedido(p) {
    if (p.responsavel_uid) return { uid: p.responsavel_uid, nome: p.responsavel, celular: p.responsavel_cel };
    if (p.responsavel) { const q = (E.perfis || []).find(x => x.nome === p.responsavel); return { uid: q ? q.id : null, nome: p.responsavel, celular: q ? q.celular : null }; }
    const r = responsavelRegiao(p.regiao);
    return r ? { ...r, porRegiao: true } : null;
  }
  const meuPedido = (p) => { const d = donoPedido(p); return !!d && d.uid === E.perfil.id; };
  const pedidoLivre = (p) => !donoPedido(p);
  const minhasRegioes = () => L.regioes.filter(r => { const x = responsavelRegiao(r); return x && x.uid === E.perfil.id; });
  // Regiões que a pessoa enxerga (as regras do Firebase conferem o mesmo): administrador, todas; time, as da carteira dele,
  // as que está cobrindo como substituto (até a data) e as livres (sem responsável).
  function regioesVisiveis() {
    if (ehAdmin()) return L.regioes.slice();
    const c = E.carteiras || {}, eu = E.perfil.id;
    return L.regioes.filter(r => {
      const x = (c.regioes || {})[r] || null;
      if (!x || x.uid === eu) return true;
      const sub = substitutoAtivo(c, x.uid);
      return !!(sub && sub.para.uid === eu);
    });
  }
  const euComoResponsavel = () => ({ responsavel: E.perfil.nome, responsavel_uid: E.perfil.id, responsavel_cel: E.perfil.celular || null });
  // dias úteis desde a data (para o alerta de pedido livre parado)
  function diasUteis(desde) {
    let d = new Date(desde), n = 0; const fim = new Date();
    if (isNaN(d)) return 0;
    while (d < fim) { d = new Date(d.getTime() + 86400000); if (d <= fim && d.getDay() % 6 !== 0) n++; }
    return n;
  }

  function desenhar() {
    const time = ehTime();
    const pendentes = ehAdmin() ? E.perfis.filter(p => p.situacao === "pendente").length + E.acessos.filter(a => a.situacao === "pendente" && !a.principal && perfilDe(a.uid).situacao === "aprovado").length : 0;
    const novos = E.pedidos.filter(p => p.situacao === "Nova" && (meuPedido(p) || pedidoLivre(p))).length;
    // [tela, nome, contador, nome curto para o menu de baixo no celular]
    const itens = time
      ? [["hoje", "Hoje", tarefasHoje().total], ["pedidos", "Pedidos", novos], ["leads", "Leads"], ["cadastros", "Cadastros", pendentes, "Cadastros"], ["painel", "Painel"], ["conta", "Minha conta", 0, "Conta"]]
      : [["leads", "Meus leads", E.leads.filter(l => paraHoje(l) && meuLead(l)).length, "Leads"], ["pedidos", "Meus pedidos", 0, "Pedidos"], ...(unidadesDono().length ? [["equipe", "Minha equipe", pendentesEquipe(), "Equipe"]] : []),
         ...((E.equipeComercial || []).length ? [["gestao", "Minha equipe", 0, "Equipe"]] : []), ["conta", "Minha conta", 0, "Conta"]];

    const conteudo = {
      leads: time ? telaLeadsTime : telaLeadsRep,
      pedidos: time ? telaPedidosTime : telaPedidosRep,
      cadastros: time ? telaCadastros : telaLeadsRep,
      hoje: time ? telaHojeTime : telaLeadsRep,
      equipe: time ? (() => "") : telaEquipe,
      gestao: time ? (() => "") : telaGestao,
      painel: telaPainel,
      conta: telaConta
    }[E.tela] || (() => "");
    const n = minhasUnidades().length;

    $app.innerHTML = `
      <div class="app">
        <aside class="lateral">
          <div class="marca">${logo("logo logo-menu")}<span>${esc(cfg.nomeDoPortal || "Portal de Leads")}<small>${cfg.logoUrl ? esc(TIME) : `${esc(TIME)} | ${esc(EMPRESA)}`}</small></span></div>
          <nav class="nav" aria-label="Menu">
            ${itens.map(([id, nome, c, curto]) => `<button data-tela="${id}"${E.tela === id ? ' aria-current="page"' : ""}><span class="nav-icone" aria-hidden="true">${ICONES_NAV[id] || ""}</span><span class="nav-longo">${nome}</span><span class="nav-curto" aria-hidden="true">${curto || nome}</span>${c ? `<span class="contador">${c}</span>` : ""}</button>`).join("")}
          </nav>
          <div class="quem">
            <div><div class="nome">${esc(E.perfil.nome)}</div><div class="papel">${time ? (ehAdmin() ? "Administrador · " : "Time de ") + esc(TIME) : `${E.perfil.cargo === "Executivo" ? nivelDe(E.perfil) + " · " : unidadesDono().length ? "Dono · " : ""}${n > 1 ? `${n} unidades` : esc(unidade() ? rotuloLongo(unidade().sigla) : "")}`}</div></div>
            <button class="link-btn" id="b-sair">Sair da conta</button>
          </div>
        </aside>
        <main class="principal" id="principal">${["hoje", "leads"].includes(E.tela) ? cartaoAvisos() : ""}${conteudo()}<p class="rodape">${esc(cfg.nomeDoPortal || "Portal de Leads")}, ferramenta do time de ${esc(TIME)} | ${esc(EMPRESA)}${AUTORIA}</p></main>
      </div>`;

    if (AV.suportado === null) prepararAvisos();
    $app.querySelectorAll("[data-tela]").forEach(b => b.addEventListener("click", () => { E.tela = b.dataset.tela; E.f.busca = ""; E.f.faltam = false; desenhar(); window.scrollTo(0, 0); }));
    document.getElementById("b-sair").onclick = sair;
    ligarTela();
    rotularTabelas();
  }

  // Ícones do menu (traço simples, herdam a cor do texto).
  const icNav = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONES_NAV = {
    hoje: icNav('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    leads: icNav('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>'),
    pedidos: icNav('<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>'),
    gestao: icNav('<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M5 16.5v-2.5h14v2.5"/>'),
    equipe: icNav('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c3 0 5 2 5 4"/>'),
    cadastros: icNav('<circle cx="10" cy="8" r="4"/><path d="M3 21c0-4 3-6 7-6s7 2 7 6"/><path d="M18 8h4M20 6v4"/>'),
    painel: icNav('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    conta: icNav('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>')
  };

  // No celular, cada linha de tabela vira um cartão: cada célula ganha o nome da coluna.
  function rotularTabelas() { rotularTabelasEm(document.getElementById("principal")); }
  function rotularTabelasEm(raiz) {
    if (!raiz) return;
    raiz.querySelectorAll("table").forEach(t => {
      const nomes = [...t.querySelectorAll("thead th")].map(th => th.textContent.trim());
      if (!nomes.length) return;
      t.classList.add("tabela-cartoes");
      t.querySelectorAll("tbody tr").forEach(tr => [...tr.children].forEach((td, i) => { if (nomes[i] && !td.dataset.rotulo) td.dataset.rotulo = nomes[i]; }));
    });
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
    m.querySelectorAll("[data-vista]").forEach(b => b.addEventListener("click", () => { E.vista = b.dataset.vista; E.vistaEscolhida = true; desenhar(); }));
    m.querySelectorAll("[data-unidade]").forEach(b => b.addEventListener("click", () => { escolherUnidade(b.dataset.unidade); E.f.faltam = false; desenhar(); }));
    m.querySelectorAll("[data-lead]").forEach(el => el.addEventListener("click", (ev) => {
      if (ev.target.closest("select, a, button.nao-abre")) return;
      janelaLead(el.dataset.lead);
    }));
    m.querySelectorAll(".cartao[data-lead], .hoje-item[data-lead]").forEach(el => el.addEventListener("keydown", (ev) => {
      if (ev.target !== el) return;
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); janelaLead(el.dataset.lead); }
    }));
    m.querySelectorAll("[data-hoje]").forEach(b => b.addEventListener("click", () => janelaLead(b.dataset.id, { canal: b.dataset.hoje })));
    m.querySelectorAll("[data-vista-hoje]").forEach(b => b.addEventListener("click", () => {
      E.vistaHoje = b.dataset.vistaHoje; try { localStorage.setItem("portal-vista-hoje", E.vistaHoje); } catch (e) { /* ignora */ }
      desenhar();
    }));
    m.querySelectorAll("[data-adiar]").forEach(b => b.addEventListener("click", () => {
      const caixa = b.closest(".hoje-acoes");
      caixa.innerHTML = `<span class="sub">Adiar para:</span>${[["Amanhã", somaDias(1)], ["Em 3 dias", somaDias(3)], ["Próxima semana", proximaSegunda()]]
        .map(([t, d]) => `<button class="btn btn-p nao-abre" data-adiar-para="${d}" data-id="${esc(b.dataset.id)}">${t}</button>`).join("")}`;
      caixa.querySelectorAll("[data-adiar-para]").forEach(x => x.addEventListener("click", () => adiar(x.dataset.id, x.dataset.adiarPara)));
    }));
    m.querySelectorAll("a[data-marcar]").forEach(a => a.addEventListener("click", () => marcarAviso(a.dataset.pid, a.dataset.marcar)));
    m.querySelectorAll("[data-hoje-quem]").forEach(b => b.addEventListener("click", () => { E.hojeQuem = b.dataset.hojeQuem; desenhar(); }));
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
    ativarAvisos: async (b) => {
      try {
        const r = await ocupado(b, () => API.ativarAvisos(true));
        if (r.ok) { aviso("Pronto! Os avisos do portal vão chegar neste aparelho."); voarSolto(b); }
        else if (r.motivo === "denied") aviso("Os avisos foram bloqueados neste aparelho. Dá para liberar nos ajustes do celular (veja em Minha conta).", true);
        else if (r.motivo !== "default") aviso("Não foi possível ativar os avisos neste aparelho.", true);
      } catch (e) { aviso("Não foi possível ativar os avisos agora. Tente de novo em instantes.", true); }
      desenhar();
    },
    desativarAvisos: async (b) => {
      if (!(await confirmar({ titulo: "Desativar os avisos neste aparelho?", texto: "Os avisos do portal param de chegar neste celular. Dá para ativar de novo em Minha conta.", botao: "Desativar" }))) return;
      try { await ocupado(b, () => API.desativarAvisos()); aviso("Avisos desativados neste aparelho."); } catch (e) { aviso(API.traduzir(e), true); }
      desenhar();
    },
    dispensarAvisos: () => { try { localStorage.setItem("portal-avisos-dispensado", new Date().toISOString()); } catch (e) { /* ignora */ } aviso("Tudo bem. Dá para ativar os avisos quando quiser em Minha conta."); desenhar(); },
    instalar: async () => {
      if (!instalarPrompt) return;
      instalarPrompt.prompt();
      try { const r = await instalarPrompt.userChoice; if (r && r.outcome === "accepted") aviso("Pronto! O portal está na tela do seu celular."); } catch (e) { /* ignora */ }
      instalarPrompt = null; desenhar();
    },
    importarDe: (b) => janelaImportar(b.dataset.id),
    cobrarSequencia: () => cobrarSequencia(tarefasHoje().cobrar, 0),
    irCadastros: () => { E.tela = "cadastros"; E.f.cadastro = "pendente"; desenhar(); window.scrollTo(0, 0); },
    gerenciar: (b) => janelaGerenciar(b.dataset.id),
    verCarteira: (b) => janelaCarteiraEquipe(b.dataset.sigla),
    quemPede: async (b) => {
      const sigla = b.dataset.sigla, so = b.dataset.valor === "dono";
      const u = minhasUnidades().find(x => x.sigla === sigla) || {};
      const antes = !!u.so_dono_pede;
      if (antes === so) return;
      try {
        await API.definirQuemPede(sigla, so); await carregar(); desenhar();
        aviso(so ? `Na ${sigla}, só você pede bases agora.` : `Na ${sigla}, todos da equipe podem pedir bases.`, false, async () => { await API.definirQuemPede(sigla, antes); await carregar(); desenhar(); aviso("Desfeito."); });
      } catch (e) { aviso(API.traduzir(e), true); }
    },
    puxar: (b) => { const p = E.pedidos.find(x => x.id === b.dataset.id);
      seConfirmar({ titulo: `Puxar o pedido ${p.id} para você?`, texto: `${esc(p.cidade_uf || "")} · ${esc(p.regiao || "")}. Você passa a ser o responsável e o representante vê o seu nome.`, botao: "Puxar para mim" },
        () => API.atualizarPedido(p.id, euComoResponsavel()), `Pedido ${p.id} é seu agora.`); },
    carteiras: () => janelaCarteiras(),
    novoPedido: () => janelaNovoPedido(),
    atualizar: async (b) => { await ocupado(b, recarregar); aviso("Dados atualizados."); },
    exportar: () => exportarLeads(),
    irPedidos: () => { E.tela = "pedidos"; desenhar(); },
    // Atalho do aviso de base travada: mostra só os leads que ainda estão em Novo ou Prospecção.
    verFaltam: () => { Object.assign(E.f, { faltam: true, base: "atual", status: "", busca: "" }); desenhar(); const a = document.getElementById("aviso-faltam"); if (a) a.scrollIntoView({ block: "start", behavior: "smooth" }); },
    verTodos: () => { E.f.faltam = false; desenhar(); },
    irLeads: () => { E.tela = "leads"; desenhar(); },
    aprovar: (b) => seConfirmar({ titulo: `Aprovar ${perfilDe(b.dataset.id).nome || "este cadastro"}${b.dataset.papel === "admin" ? " como administrador" : b.dataset.papel === "time" ? " como time" : ""}?`,
        texto: b.dataset.papel === "admin" ? "A pessoa passa a ver tudo e a aprovar cadastros, mudar acessos e excluir." : b.dataset.papel === "time" ? "A pessoa passa a ver e trabalhar todos os pedidos e leads."
          : (() => { const p = perfilDe(b.dataset.id), u = E.unidades.find(x => x.sigla === p.siglaPrincipal) || {};
            return "A pessoa passa a usar o portal na unidade dela." + ((p.cargo || "Representante") === "Representante" && u.sigla && !u.dono_uid && !u.tipo ? ` Como é o primeiro cadastro aprovado da unidade ${esc(u.sigla)}, vira dono dela: convida e libera a equipe.` : u.dono_nome ? ` A unidade ${esc(u.sigla)} já tem dono: ${esc(u.dono_nome)}.` : ""); })(), botao: "Aprovar" },
      () => API.aprovarCadastro(b.dataset.id, b.dataset.papel), b.dataset.papel === "admin" ? "Aprovado como administrador." : b.dataset.papel === "time" ? "Aprovado como time." : "Cadastro aprovado."),
    editarPessoa: (b) => janelaEditarPessoa(b.dataset.id),
    meuCelular: () => janelaCelular(),
    recusar: (b) => seConfirmar({ titulo: `${perfilDe(b.dataset.id).situacao === "aprovado" ? "Bloquear" : "Recusar"} ${perfilDe(b.dataset.id).nome || "este cadastro"}?`, texto: "A pessoa fica sem acesso ao portal. Dá para aprovar de novo depois.", botao: perfilDe(b.dataset.id).situacao === "aprovado" ? "Bloquear" : "Recusar", perigo: true },
      () => API.atualizarPerfil(b.dataset.id, { situacao: "recusado" }), perfilDe(b.dataset.id).situacao === "aprovado" ? "Acesso bloqueado." : "Cadastro recusado."),
    papel: (b) => {
      const x = b.dataset.papel;
      const texto = { admin: "A pessoa passa a aprovar cadastros, mudar acessos e excluir.", time: "A pessoa passa a ver e trabalhar todos os pedidos e leads, sem gerenciar cadastros.", representante: "A pessoa passa a ver só as próprias unidades." }[x];
      seConfirmar({ titulo: `Tornar ${perfilDe(b.dataset.id).nome || "esta pessoa"} ${PAPEL[x].toLowerCase()}?`, texto, botao: `Tornar ${PAPEL[x].toLowerCase()}` },
        () => API.atualizarPerfil(b.dataset.id, { papel: x }), `Acesso alterado para ${PAPEL[x].toLowerCase()}.`);
    },
    reativar: (b) => seConfirmar({ titulo: `Reativar ${perfilDe(b.dataset.id).nome || "este cadastro"}?`, texto: "O cadastro volta para Aguardando. Depois é só aprovar.", botao: "Reativar" },
      () => API.reativarCadastro(b.dataset.id), "Cadastro reativado. Ele está em Aguardando para aprovar."),
    aprovarUnidade: (b) => { const a = acessoDe(b.dataset.id), p = perfilDe(a.uid), u = E.unidades.find(x => x.sigla === a.sigla) || {};
      const dono = !u.dono_uid && !u.tipo && (p.papel || "representante") === "representante" && (p.cargo || "Representante") === "Representante" ? { uid: a.uid, nome: p.nome || a.nome } : null;
      seConfirmar({ titulo: `Liberar a unidade ${a.sigla || ""}?`, texto: `${esc(a.nome || "A pessoa")} passa a pedir e trabalhar leads dessa unidade.${dono ? " Como a unidade ainda não tem dono, a pessoa vira dono dela." : ""}`, botao: "Liberar" },
        () => API.atualizarAcesso(b.dataset.id, "aprovado", dono), "Unidade liberada."); },
    recusarUnidade: (b) => seConfirmar({ titulo: `Recusar a unidade ${acessoDe(b.dataset.id).sigla || ""}?`, texto: "A pessoa poderá pedir de novo, se for o caso.", botao: "Recusar", perigo: true },
      () => API.atualizarAcesso(b.dataset.id, "recusado"), "Unidade recusada."),
    pedirDeNovo: (b) => seConfirmar({ titulo: `Pedir de novo a unidade ${b.dataset.sigla}?`, texto: `O pedido volta para o time de ${esc(TIME)} conferir.`, botao: "Pedir de novo" },
      async () => { await API.pedirDeNovo(b.dataset.sigla); }, "Pedido enviado de novo ao time."),
    // Dono da unidade
    convidar: (b) => janelaConvidar(b.dataset.sigla, b.dataset.trocar ? { nome: b.dataset.nome, email: b.dataset.email, cel: b.dataset.cel, trocar: b.dataset.trocar } : null),
    liberarEquipe: (b) => { const p = pessoaEquipe(b); seConfirmar({ titulo: `Liberar ${p.nome || "esta pessoa"} na unidade ${b.dataset.sigla}?`, texto: "A pessoa passa a pedir e trabalhar os leads da unidade.", botao: "Liberar" },
      () => API.decidirNaEquipe(b.dataset.id, b.dataset.sigla, "aprovado", !!b.dataset.perfil), `${primeiroNome(p.nome)} está liberado na unidade.`); },
    recusarEquipe: (b) => { const p = pessoaEquipe(b); seConfirmar({ titulo: `Recusar ${p.nome || "esta pessoa"}?`, texto: `A pessoa não entra na unidade ${esc(b.dataset.sigla)}. Se for engano, o time de ${esc(TIME)} consegue reativar.`, botao: "Recusar", perigo: true },
      () => API.decidirNaEquipe(b.dataset.id, b.dataset.sigla, "recusado", !!b.dataset.perfil), "Pedido recusado."); },
    tirarEquipe: (b) => { const p = pessoaEquipe(b); seConfirmar({ titulo: `Tirar ${p.nome || "esta pessoa"} da unidade ${b.dataset.sigla}?`, texto: "A pessoa para de ver os pedidos e leads da unidade. Os leads e o histórico continuam salvos, e dá para liberar de novo depois.", botao: "Tirar da unidade", perigo: true },
      () => API.decidirNaEquipe(b.dataset.id, b.dataset.sigla, "recusado", false), "Pessoa tirada da unidade."); },
    copiarConvite: async (b) => { const c = conviteDe(b.dataset.id); aviso(await copiar(msgConvite(c)) ? "Mensagem com o link copiada. É só colar no WhatsApp." : "Não deu para copiar. Tente de novo.", false); },
    cancelarConvite: (b) => { const c = conviteDe(b.dataset.id); seConfirmar({ titulo: `Cancelar o convite de ${c.nome}?`, texto: "O link para de funcionar. Dá para mandar outro depois.", botao: "Cancelar convite", perigo: true },
      () => API.cancelarConvite(c.id), "Convite cancelado."); },
    // Administrador: dono da unidade
    tornarDono: (b) => { const p = perfilDe(b.dataset.id), u = E.unidades.find(x => x.sigla === b.dataset.sigla) || {};
      seConfirmar({ titulo: `Tornar ${p.nome} dono da unidade ${b.dataset.sigla}?`, texto: `${u.dono_nome ? `Hoje o dono é ${esc(u.dono_nome)}. ` : ""}O dono convida e libera a equipe da unidade.`, botao: "Tornar dono" },
        () => API.definirDono(b.dataset.sigla, p.id, p.nome), `${primeiroNome(p.nome)} agora é dono da unidade ${b.dataset.sigla}.`); },
    definirDonos: () => { const s = donosSugeridos();
      seConfirmar({ titulo: `Definir o dono de ${s.length} unidade${s.length > 1 ? "s" : ""}?`, texto: s.map(x => `${esc(x.sigla)}: ${esc(x.nome)}`).join(" · ") + ". Depois dá para trocar em cada pessoa.", botao: "Definir donos" },
        () => API.definirDonos(s.map(x => ({ sigla: x.sigla, uid: x.uid, nome: x.nome }))), "Donos definidos."); },
    tour: () => iniciarTour(),
    senha: (b) => janelaSenha(b.dataset.id),
    pedirUnidade: () => janelaPedirUnidade(),
    excluir: (b) => janelaExcluir(b.dataset.id),
    excluirDeVez: (b) => excluirDeVez(b.dataset.id)
  };
  async function mudar(fn, msg) {
    try { await fn(); await recarregar(); aviso(msg); } catch (e) { aviso(API.traduzir(e), true); }
  }
  async function seConfirmar(opcoes, fn, msg) { if (await confirmar(opcoes)) await mudar(fn, msg); }
  const acessoDe = (id) => (E.acessos || []).find(a => a.id === id) || {};
  const pessoaEquipe = (b) => (((E.equipe || {})[b.dataset.sigla] || { pessoas: [] }).pessoas.find(p => p.uid === b.dataset.id)) || {};
  const conviteDe = (id) => Object.values(E.equipe || {}).flatMap(q => q.convites).find(c => c.id === id) || {};
  // Unidades sem dono: sugere o primeiro representante aprovado de cada uma.
  function donosSugeridos() {
    return E.unidades.filter(u => !u.tipo && !u.dono_uid).map(u => {
      const cands = E.acessos.filter(a => a.sigla === u.sigla && a.situacao === "aprovado").map(a => ({ a, p: perfilDe(a.uid) }))
        .filter(({ p }) => p.situacao === "aprovado" && (p.papel || "representante") === "representante" && (p.cargo || "Representante") === "Representante")
        .sort((x, y) => (y.a.principal - x.a.principal) || String(x.a.criadoEm || x.p.criadoEm || "").localeCompare(String(y.a.criadoEm || y.p.criadoEm || "")));
      return cands.length ? { sigla: u.sigla, uid: cands[0].p.id, nome: cands[0].p.nome } : null;
    }).filter(Boolean);
  }

  // ------------------------------------------------------------------
  // Leads: filtros, Kanban e lista
  // ------------------------------------------------------------------
  function pedidoDe(l) { return E.pedidos.find(p => p.id === l.solicitacao_id) || {}; }

  function filtrarLeads(lista) {
    const b = norm(E.f.busca);
    return lista.filter(l => {
      if (!ehTime() && E.f.faltam && !trava(l)) return false;
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
    if (l.cuida_nome && (ehTime() || l.cuida_uid !== E.perfil.id)) t += `<span class="etiqueta">Com ${esc(l.cuida_nome)}</span>`;
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
      <thead><tr><th>Empresa</th>${ehTime() ? "<th>Unidade</th>" : ""}<th>Contato</th><th>Cidade</th><th>Status</th><th>Último contato</th><th>Algum contato funciona?</th></tr></thead>
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
          <td data-rotulo="Algum contato funciona?">${esc(l.contato_valido || "–")}</td>
        </tr>`).join("")}</tbody></table></div>`;
  }

  function seletorVista() {
    return `<div class="pilulas" role="group" aria-label="Forma de ver">
      <button data-vista="kanban" aria-pressed="${E.vista === "kanban"}">Quadro</button>
      <button data-vista="lista" aria-pressed="${E.vista === "lista"}">Lista</button></div>`;
  }

  function ligarKanban(raiz) {
    let arrastando = null;
    // Enquanto arrasta, o quadro rola sozinho quando o cartão chega perto da borda (dá para levar até a última coluna).
    const quadro = raiz.querySelector(".quadro");
    let px = 0, py = 0, rolando = null;
    const seguir = (e) => { px = e.clientX; py = e.clientY; };
    const rolar = () => {
      if (!arrastando || !quadro) { rolando = null; return; }
      const r = quadro.getBoundingClientRect(), borda = Math.min(120, r.width / 5);
      let dx = 0;
      if (px > r.right - borda) dx = Math.min(28, 6 + (px - (r.right - borda)) / 3);
      else if (px > 0 && px < r.left + borda) dx = -Math.min(28, 6 + (r.left + borda - px) / 3);
      if (dx) quadro.scrollLeft += dx;
      if (py > 0 && py < 70) window.scrollBy(0, -14); else if (py > window.innerHeight - 70) window.scrollBy(0, 14);
      rolando = requestAnimationFrame(rolar);
    };
    raiz.querySelectorAll(".cartao[draggable]").forEach(c => {
      c.addEventListener("dragstart", (e) => {
        arrastando = c.dataset.lead; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", arrastando);
        px = e.clientX; py = e.clientY;
        document.addEventListener("dragover", seguir);
        if (!rolando) rolando = requestAnimationFrame(rolar);
      });
      c.addEventListener("dragend", () => {
        arrastando = null; document.removeEventListener("dragover", seguir);
        if (rolando) { cancelAnimationFrame(rolando); rolando = null; }
        raiz.querySelectorAll(".alvo").forEach(x => x.classList.remove("alvo"));
      });
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
    const peloTentar = tentarDevido(l) && !retornoDevido(l);
    const antes = peloTentar ? { tentar_em: l.tentar_em || "" } : { retorno: l.retorno || "" };
    try {
      await API.atualizarLead(id, peloTentar ? { tentar_em: quando } : { retorno: quando });
      await carregar(); desenhar();
      aviso(`${l.empresa}: próximo contato em ${data(quando)}.`, false, async () => { await API.atualizarLead(id, antes); await carregar(); desenhar(); aviso("Desfeito."); });
    } catch (e) { aviso(API.traduzir(e), true); }
  }

  // CNPJ: confere os dígitos verificadores e devolve no formato 00.000.000/0000-00.
  function cnpjValido(c) {
    const d = String(c || "").replace(/\D/g, "");
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const dv = (n) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const r = pesos.reduce((a, p, i) => a + p * Number(d.charAt(i)), 0) % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === Number(d.charAt(12)) && dv(13) === Number(d.charAt(13));
  }
  const cnpjFormatado = (c) => { const d = String(c || "").replace(/\D/g, "").slice(0, 14); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d; };
  const REGRA_EMBARQUE = (l) => ({ titulo: "Embarque iniciado pede CNPJ e razão social", texto: `Para marcar <b>${esc(l.empresa)}</b> como Embarque iniciado, informe o <b>CNPJ</b> e a <b>razão social</b> de quem está embarcando. Assim o time confere o cliente no sistema da Azul.`, foco: "embarque" });

  // Regras de status. Devolve o motivo do bloqueio (para o pop-up) ou null se a mudança pode seguir.
  const ETAPAS_COM_CONTATO = ["Em negociação", "Em implantação", "Embarque iniciado"];
  function regraStatus(l, novo) {
    if (!l || novo === l.status) return null;
    if (novo === "Em implantação" && !["Em negociação", "Embarque iniciado"].includes(l.status))
      return { titulo: "Antes vem a negociação", texto: `<b>${esc(l.empresa)}</b> está em <b>${esc(l.status)}</b>. O lead precisa passar por <b>Em negociação</b> antes de ir para Em implantação.`, foco: "status" };
    if (novo === "Embarque iniciado" && l.status !== "Em implantação")
      return { titulo: "Antes vem a implantação", texto: `<b>${esc(l.empresa)}</b> está em <b>${esc(l.status)}</b>. O lead precisa passar por <b>Em implantação</b> antes de ir para Embarque iniciado.`, foco: "status" };
    if (ETAPAS_COM_CONTATO.includes(novo) && !marcas(l).ok.size)
      return { titulo: "Falta marcar o contato que funcionou", texto: `Para passar <b>${esc(l.empresa)}</b> para <b>${esc(novo)}</b>, marque com <b>✓</b> o telefone ou e-mail em que você conseguiu falar com a empresa. Assim o time sabe qual contato usar se o cliente fechar.`, foco: "contatos" };
    if (novo === "Sem interesse" && !tentativasDe(l) && l.status !== "Sem interesse")
      return { titulo: "Tente o contato antes", texto: `Para marcar <b>${esc(l.empresa)}</b> como Sem interesse, registre pelo menos uma tentativa: use o WhatsApp, a ligação ou o e-mail da ficha e confirme quando o portal perguntar. Depois do contato, o portal pergunta “Como foi?” e você escolhe “Não tem interesse”.`, foco: "contatos" };
    if (novo === "Contato inválido" && !tentativasDe(l) && l.contato_valido !== "Não")
      return { titulo: "Tente o contato antes", texto: `Para marcar <b>${esc(l.empresa)}</b> como Contato inválido, registre pelo menos uma tentativa: use o WhatsApp, a ligação ou o e-mail da ficha e confirme quando o portal perguntar. Se você já sabe que um número não existe, marque ele com <b>✕</b>.`, foco: "contatos" };
    return null;
  }
  const REGRA_AZUL = (l) => ({ titulo: "Cliente Azul pede uma observação", texto: `Para marcar <b>${esc(l.empresa)}</b> como Cliente Azul, escreva os detalhes: qual filial ou CNPJ já embarca, com qual unidade e quem é o contato.`, foco: "azul" });
  // Pop-up de mudança barrada. Com "outro", mostra também um botão de ação (ex.: abrir a ficha). Devolve true se clicou nele.
  function barrado(r, outro) {
    return new Promise(resolve => {
      $conf.innerHTML = `<div class="cf-corpo cf-barrado"><p class="selo-barrado" style="margin:0 0 10px">Mudança de status barrada</p><h2>${esc(r.titulo)}</h2><p>${r.texto}</p>
        <div class="cf-botoes">${outro ? `<button type="button" class="btn" data-cf="nao">Fechar</button><button type="button" class="btn btn-primario" data-cf="sim">${esc(outro)}</button>` : `<button type="button" class="btn btn-primario" data-cf="nao">Entendi</button>`}</div></div>`;
      let feito = false;
      const terminar = (ok) => { if (feito) return; feito = true; resolve(ok); if ($conf.open) $conf.close(); $conf.innerHTML = ""; };
      $conf.querySelector('[data-cf="nao"]').onclick = () => terminar(false);
      const sim = $conf.querySelector('[data-cf="sim"]'); if (sim) sim.onclick = () => terminar(true);
      $conf.oncancel = (e) => { e.preventDefault(); terminar(false); };
      $conf.onclick = (e) => { if (e.target === $conf) terminar(false); };
      $conf.showModal();
      (sim || $conf.querySelector('[data-cf="nao"]')).focus();
    });
  }

  async function salvarStatus(id, status) {
    const l = E.leads.find(x => x.id === id);
    const r = regraStatus(l, status);
    if (r) { desenhar(); if (await barrado(r, "Abrir a ficha do lead")) janelaLead(id, { foco: r.foco }); return; }
    // Embarque iniciado pede CNPJ e razão social: avisa e abre a ficha já com o status escolhido.
    if (status === "Embarque iniciado" && l.status !== "Embarque iniciado") { desenhar(); if (await barrado(REGRA_EMBARQUE(l), "Abrir a ficha e preencher")) janelaLead(id, { status, foco: "embarque" }); return; }
    // Cliente Azul pede observação: avisa e abre a ficha já com o status escolhido.
    if (status === "Cliente Azul" && l.status !== "Cliente Azul") { desenhar(); if (await barrado(REGRA_AZUL(l), "Abrir a ficha e escrever")) janelaLead(id, { status, foco: "azul" }); return; }
    // Sem interesse pede o motivo: abre a ficha já com o status escolhido.
    if (status === "Sem interesse") { desenhar(); janelaLead(id, { status }); return; }
    if (!(await confirmar({ titulo: `Mudar ${l.empresa} para ${status}?`, texto: `Hoje está em ${esc(l.status)}. ${esc(DESC[status] || "")}`, botao: "Mudar status" }))) { desenhar(); return; }
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
  // Modelos de abordagem (listas.js). "Primeiro contato" e "Retomada" usam as mensagens de sempre.
  function modelosMensagem() {
    const M = L.mensagens;
    const base = { primeiro: { whatsapp: M.whatsapp, emailAssunto: M.emailAssunto, email: M.email },
      retomada: { whatsapp: M.whatsappRetomada || M.whatsapp, emailAssunto: M.emailRetomadaAssunto || M.emailAssunto, email: M.emailRetomada || M.email, dica: "Para quem ainda não respondeu." } };
    const lista = (L.modelos && L.modelos.length ? L.modelos : [{ id: "primeiro", nome: "Primeiro contato" }, { id: "retomada", nome: "Retomada (sem resposta)" }]);
    return lista.map(m => ({ ...(base[m.id] || {}), ...m })).filter(m => m.whatsapp && m.email);
  }
  // Modelo sugerido: reativação para quem volta de Sem interesse, cotação em negociação, retomada a partir da 2ª tentativa.
  function modeloPadrao(l, n) {
    if (l.status === "Sem interesse") return "reativacao";
    if (l.status === "Em negociação") return "cotacao";
    return n >= 1 ? "retomada" : "primeiro";
  }

  function preencher(modelo, l) {
    const u = E.perfil.unidades && E.perfil.unidades.find(x => x.sigla === l.sigla) || {};
    // Carteira de executivo: a sigla é um código interno (EX…) e não vai para o cliente.
    if (u.tipo === "executivo" || infoUnidade(l.sigla).tipo === "executivo") {
      modelo = String(modelo || "")
        .replace(/da Azul Logística \(unidade \{sigla\}, \{cidade\}\)/g, "da equipe comercial da Azul Logística em {cidade}")
        .replace(/Azul Logística, unidade \{sigla\}/g, "Azul Logística")
        .replace(/\s*\(?unidade \{sigla\}\)?/g, "");
    }
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
    if (t.errado) return `<div class="ct-linha errado"><span class="tipo t-${t.t}">${tipo}</span><b>${esc(foneTxt(t.n))}</b><span class="sub">Não funciona</span>
      <span class="ct-acoes">${botoesMarca(t.n, t)}</span></div>`;
    return `<div class="ct-linha${t.ok ? " confirmado" : ""}"><span class="tipo t-${t.t}">${tipo}</span><b>${esc(foneTxt(t.n))}</b>${t.ok ? `<span class="ok-txt">Funciona</span>` : ""}${extra}
      <span class="ct-acoes">${t.t === "cel" ? `<button type="button" class="btn btn-p btn-zap btn-mini" data-tel-zap="${esc(t.n)}">WhatsApp</button>` : ""}<button type="button" class="btn btn-p btn-mini" data-tel-ligar="${esc(t.n)}">Ligar</button>
      ${botoesMarca(t.n, t)}</span></div>`;
  }
  function secaoTelefones(tels, todos) {
    if (!tels.length) return `<section class="ct" id="l-tels"></section>`;
    const conta = (t) => tels.filter(x => x.t === t && !x.errado).length;
    const resumo = [conta("cel") && `${conta("cel")} celular${conta("cel") > 1 ? "es" : ""}`, conta("fixo") && `${conta("fixo")} fixo${conta("fixo") > 1 ? "s" : ""}`, conta("0800") && `${conta("0800")} 0800`, tels.some(t => t.ok) && `${tels.filter(t => t.ok).length} funciona(m)`, tels.some(t => t.errado) && `${tels.filter(t => t.errado).length} não funciona(m)`].filter(Boolean).join(" · ");
    let corpo;
    if (todos) {
      const base = tels[0].base;
      const grupos = [
        ["Funcionam", tels.filter(t => t.ok && !t.errado)],
        ["Celulares", tels.filter(t => t.t === "cel" && !t.errado && !t.ok)],
        [`Fixos na cidade da empresa${base ? " · DDD " + base : ""}`, tels.filter(t => t.t === "fixo" && t.local && !t.errado && !t.ok)],
        ["Outras cidades, prováveis filiais", tels.filter(t => t.t === "fixo" && !t.local && !t.errado && !t.ok)],
        ["0800", tels.filter(t => t.t === "0800" && !t.errado && !t.ok)],
        ["Não funcionam", tels.filter(t => t.errado)]
      ].filter(([, g]) => g.length);
      corpo = grupos.map(([nome, g]) => `<p class="ct-grupo">${esc(nome)} (${g.length})</p><div class="ct-lista">${g.map(t => linhaTel(t, true)).join("")}</div>`).join("")
        + `<p class="sub">✓ Funciona e ✕ Não funciona valem para toda a unidade e ficam no histórico. <button type="button" class="link-mini" data-tel-menos>Mostrar menos</button></p>`;
    } else {
      const visiveis = tels.filter(t => !t.errado).slice(0, 4);
      corpo = `<div class="ct-lista">${visiveis.map(t => linhaTel(t, false)).join("")}
        ${tels.length > visiveis.length ? `<button type="button" class="ct-mais" data-tel-todos>Ver todos os ${tels.length} telefones${tels.some(t => t.errado) ? ` (${tels.filter(t => t.errado).length} não funcionam)` : ""}</button>` : ""}</div>`;
    }
    return `<section class="ct" id="l-tels"><div class="ct-topo"><h3>Telefones (${tels.length})</h3><span class="sub">${resumo}</span></div>${corpo}</section>`;
  }
  function secaoEmails(l) {
    const ms = emailsMarcados(l);
    if (!ms.length) return "";
    return `<section class="ct" id="l-mails"><div class="ct-topo"><h3>E-mails (${ms.length})</h3>${ms.some(x => x.ok || x.errado) ? `<span class="sub">${[ms.some(x => x.ok) && `${ms.filter(x => x.ok).length} funciona(m)`, ms.some(x => x.errado) && `${ms.filter(x => x.errado).length} não funciona(m)`].filter(Boolean).join(" · ")}</span>` : ""}</div><div class="ct-lista">
        ${ms.map((x, i) => `<div class="ct-linha${x.errado ? " errado" : x.ok ? " confirmado" : ""}${i >= 3 ? " ct-escondido" : ""}"><b class="quebra">${esc(x.m)}</b>${x.ok ? `<span class="ok-txt">Funciona</span>` : x.errado ? `<span class="sub">Não funciona</span>` : ""}
          <span class="ct-acoes">${x.errado ? "" : `<button type="button" class="btn btn-p btn-mini" data-copiar="${esc(x.m)}">Copiar</button><button type="button" class="btn btn-p btn-mini" data-mail-usar="${esc(x.m)}">Mensagem pronta</button>`}${botoesMarca(x.m, x)}</span></div>`).join("")}
        ${ms.length > 3 ? `<button type="button" class="ct-mais" data-mail-todos>Ver os ${ms.length} e-mails</button>` : ""}</div></section>`;
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
      ["Atividade", ehTime() && cnaes.length && `CNAE ${esc(cnaeBonito(cnaes[0]))}${cnaes.length > 1 ? ` <span class="sub">+ ${cnaes.length - 1} outro${cnaes.length > 2 ? "s" : ""}</span>` : ""}`],
      ["Porte", porteTexto(l) && esc(porteTexto(l))],
      [l.endereco ? "Endereço" : "Cidade/UF", (endereco + esc(local)) || ""],
      ["Contato", l.contato && esc(l.contato)],
      ["Sócios", (l.socios || []).length && esc(l.socios.join(", "))]
    ].filter(([, v]) => v);
    const emailsHtml = secaoEmails(l);
    return {
      dados: `<dl class="dados">${linhas.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        ${links.length ? `<div class="ct-links">${links.map(([u, nome, txt]) => `<a href="${esc(linkDe(u))}" target="_blank" rel="noopener" class="ct-link">${esc(txt || nome)}</a>`).join("")}</div>` : ""}`,
      listas: `<div class="ct-listas"><p class="ct-dica">Depois de tentar, marque <b>✓</b> no contato que funcionou ou <b>✕</b> no que não funciona.</p>${secaoTelefones(tels, telTodos)}${emailsHtml}</div>`
    };
  }

  // "Como foi?" e "Quando volto?": depois de cada envio ou ligação, duas respostas preenchem status, ✓/✕ e próximo contato.
  function painelComoFoi(cf, n) {
    const opcoesComo = cf.canal === "ligacao"
      ? [["interesse", "Tem interesse"], ["depois", "Pediu para falar depois"], ["sem", "Não tem interesse"], ["errado", "Não é a empresa ou número errado"]]
      : [["interesse", "Respondeu: tem interesse"], ["aguardando", "Ainda não respondeu"], ["sem", "Respondeu: não tem interesse"], ["errado", cf.canal === "email" ? "E-mail voltou ou é de outra empresa" : "Número errado ou não é a empresa"]];
    const chips = [["Amanhã", somaDias(1)], ["Em 3 dias", somaDias(3)], ["Próxima semana", proximaSegunda()]];
    return `<div class="comofoi" id="l-comofoi" role="group" aria-label="Como foi o contato">
      <p class="cf-registrado">✓ Tentativa ${n} registrada.</p>
      <div class="cf-passo" data-passo="como"${cf.ok ? "" : " hidden"}>
        <p class="cf-pergunta">Como foi?</p>
        <div class="cf-opcoes">${opcoesComo.map(([v, t]) => `<button type="button" class="cf-op" data-como="${v}">${esc(t)}</button>`).join("")}</div>
      </div>
      <div class="cf-passo" data-passo="motivo" hidden>
        <p class="cf-pergunta">Por que não tem interesse?</p>
        <div class="cf-opcoes">${MOTIVOS.filter(Boolean).map(m => `<button type="button" class="cf-op" data-cf-motivo="${esc(m)}">${esc(m)}</button>`).join("")}</div>
        <div class="cf-linha" id="cf-outro-c" hidden><input id="cf-outro" type="text" maxlength="200" placeholder="Escreva o motivo em poucas palavras" aria-label="Qual foi o motivo"><button type="button" class="btn btn-primario" id="cf-outro-ok">Salvar</button></div>
      </div>
      <div class="cf-passo" data-passo="quando"${cf.ok ? " hidden" : ""}>
        <p class="cf-pergunta" id="cf-q-quando">${cf.ok ? "Quando você volta a falar com a empresa?" : "Não atendeu. Quando você tenta de novo?"}</p>
        <div class="cf-opcoes">${chips.map(([t, d]) => `<button type="button" class="cf-op" data-cf-quando="${d}">${t}<small>${data(d)}</small></button>`).join("")}<button type="button" class="cf-op" data-cf-quando="outra">Outra data</button></div>
        <div class="cf-linha" id="cf-data-c" hidden><input id="cf-data" type="date" min="${hojeISO()}" aria-label="Data do próximo contato"><button type="button" class="btn btn-primario" id="cf-data-ok">Salvar</button></div>
      </div>
      <button type="button" class="link-btn link-pequeno" id="cf-pular">Prefiro preencher a ficha</button>
    </div>`;
  }

  function janelaLead(id, op) {
    op = op || {};
    const obsAberta = $janela.open && $janela.querySelector(`#l-obs[data-lead="${id}"]`);
    if (obsAberta && obsAberta.value.trim() && !op.obsPendente) op.obsPendente = obsAberta.value;
    const l = E.leads.find(x => x.id === id);
    if (!l) return;
    if (desligarFicha) { desligarFicha(); desligarFicha = null; }
    const p = pedidoDe(l);
    const tels = telefonesDe(l), mails = emailsDe(l);
    const ativos = tels.filter(t => !t.errado);
    // Número e e-mail usados nos botões. Clicar num telefone ou e-mail da lista troca qual é usado.
    let tel = (ativos.find(t => t.t === "cel") || ativos[0] || {}).n || "";
    let email = (emailsMarcados(l).find(x => !x.errado) || {}).m || "";
    const completo = tels.length || mails.length || l.site || l.linkedin || l.instagram || l.endereco || (l.socios || []).length;
    const ficha = completo ? fichaCompleta(l, tels, mails, !!op.telTodos) : null;
    const n = tentativasDe(l);
    const retomada = n >= 1;
    const statusInicial = op.status || l.status;
    let pendente = null; // ação aberta que espera a confirmação "Você enviou?"
    let modeloEnviado = ""; // nome do modelo de mensagem usado no último envio (vai para o histórico)
    let motivo = l.motivo || "";
    let tentarEm = l.tentar_em || "";
    const prazos = [["Não", ""], ["Em 1 mês", somaDias(30)], ["Em 3 meses", somaDias(90)], ["Em 6 meses", somaDias(180)]];

    abrir(`
      <div class="janela-topo"><div><h2>${esc(l.empresa)}</h2><p>${l.fantasia && norm(l.fantasia) !== norm(l.empresa) ? `Nome fantasia: ${esc(l.fantasia)} · ` : ""}${esc(rotuloLongo(l.sigla))}${p.id ? (ehTime() ? `, pedido ${esc(p.id)} de ${data(p.criada_em)}` : `, pedido de ${data(p.criada_em)}`) : ""}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        ${completo ? ficha.dados : `<dl class="dados">
          ${[["CNPJ", l.cnpj], ["Segmento", l.segmento], ["Cidade/UF", l.cidade_uf], ["Contato", l.contato], ["Telefone", tel ? foneTxt(tel) : l.telefone], ["E-mail", email || l.email]]
            .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}
        </dl>`}
        ${op.comoFoi ? painelComoFoi(op.comoFoi, n) : op.aposTentativa ? `<div class="ok-tentativa">Tentativa ${n} registrada. Marque abaixo o próximo contato.</div>` : ""}
        ${op.salvoMsg ? `<div class="ok-tentativa" role="status">✓ ${esc(op.salvoMsg)}</div>` : ""}
        ${temEquipe(l.sigla) ? `<div class="cuida-linha"><span>${l.cuida_uid ? (l.cuida_uid === E.perfil.id ? "<b>Você</b> está cuidando deste lead." : `<b>${esc(l.cuida_nome || "Outra pessoa")}</b> está cuidando deste lead.`) : "Ninguém da unidade está cuidando deste lead ainda."}</span>
          <button type="button" class="btn btn-p" id="l-cuidar">${l.cuida_uid === E.perfil.id ? "Deixar de cuidar" : l.cuida_uid ? "Passar para mim" : "Vou cuidar deste"}</button></div>`
          : ehTime() && l.cuida_nome ? `<p class="sub">Na unidade, quem cuida deste lead é ${esc(l.cuida_nome)}.</p>` : ""}
        ${decidir(l) ? `<div class="decidir" id="l-decidir">
            <div class="decidir-topo"><b>${n} tentativas e o lead continua em ${esc(l.status)}</b>${l.ultima_tentativa ? `<span>Última ${haDias(l.ultima_tentativa)}</span>` : ""}</div>
            <p>Vale decidir o que fazer com este lead para não travar a próxima base.</p>
            <div class="acoes-linha">
              <button type="button" class="btn btn-p" data-decidir="tentar">Tentar mais uma vez</button>
              <button type="button" class="btn btn-p" data-decidir="sem">Marcar Sem interesse</button>
              <button type="button" class="btn btn-p" data-decidir="invalido">Marcar Contato inválido</button>
            </div></div>` : ""}
        <div class="contatos">
          ${tel ? `<button class="btn btn-zap btn-p" data-canal="whatsapp">WhatsApp com mensagem pronta</button><button class="btn btn-p" data-canal="ligacao">Ligar</button>` : ""}
          ${email ? `<button class="btn btn-p" data-canal="email">E-mail com mensagem pronta</button>` : ""}
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

          <fieldset class="extra destaque" id="l-bloco-embarque" hidden>
            <legend>Dados do embarque</legend>
            <p class="sub">Obrigatório para Embarque iniciado: CNPJ e razão social de quem está embarcando.</p>
            <div class="grade-2">
              <div class="campo"><label for="e-cnpj">CNPJ</label><input id="e-cnpj" type="text" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00" value="${esc(l.cnpj_embarque || "")}"></div>
              <div class="campo"><label for="e-razao">Razão social</label><input id="e-razao" type="text" maxlength="150" placeholder="Como está no cartão CNPJ" value="${esc(l.razao_embarque || "")}"></div>
            </div>
            ${l.cnpj && cnpjValido(l.cnpj) ? `<button type="button" class="link-btn" id="e-usar">Usar o CNPJ que veio da Leads2b (${esc(cnpjFormatado(l.cnpj))})</button>` : ""}
          </fieldset>

          <fieldset class="extra destaque" id="l-bloco-azul" hidden>
            <legend>Detalhes do Cliente Azul</legend>
            <p class="sub">Obrigatório. Vai para o histórico do lead como observação.</p>
            <div class="campo"><label for="l-azul">Qual filial ou CNPJ já embarca, com qual unidade e quem é o contato?</label>
              <textarea id="l-azul" rows="3" maxlength="1000" placeholder="Ex.: a matriz em Campinas já embarca com a CPQ, contato Ana (compras)."></textarea></div>
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
          <div class="campo" style="margin-top:12px"><textarea id="l-obs" data-lead="${esc(id)}" rows="2" placeholder="Adicionar observação…"></textarea></div>
          <button class="btn btn-p" id="l-add-obs">+ Adicionar observação</button>
        </div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button><button class="btn btn-primario" id="l-salvar">Salvar</button></div>`,
    (j) => {
      const st = j.querySelector("#l-status"), dt = j.querySelector("#l-data");
      const blocoMotivo = j.querySelector("#l-bloco-motivo"), blocoQuali = j.querySelector("#l-bloco-quali"), blocoAgenda = j.querySelector("#l-bloco-agenda"), blocoAzul = j.querySelector("#l-bloco-azul"), blocoEmbarque = j.querySelector("#l-bloco-embarque");
      const agData = j.querySelector("#ag-data"), agHora = j.querySelector("#ag-hora"), agLembrete = j.querySelector("#ag-lembrete");
      const erro = j.querySelector("#l-erro");

      const mostrarBlocos = () => {
        blocoMotivo.hidden = st.value !== "Sem interesse";
        blocoAzul.hidden = !(st.value === "Cliente Azul" && l.status !== "Cliente Azul");
        blocoEmbarque.hidden = !(st.value === "Embarque iniciado" && l.status !== "Embarque iniciado");
        blocoQuali.hidden = !QUALI.has(st.value);
        blocoAgenda.hidden = ["Sem interesse", "Contato inválido"].includes(st.value);
      };
      const textoTentar = () => {
        j.querySelector("#l-tentar-txt").textContent = tentarEm
          ? `Em ${data(tentarEm)} o lead volta para Para hoje com o histórico completo. Ele não trava a base enquanto isso.`
          : "O lead fica em Sem interesse e não volta para a agenda.";
      };
      mostrarBlocos(); textoTentar();

      // O que está na ficha agora, para saber se a pessoa mudou algo e ainda não salvou.
      const valor = (s) => (j.querySelector(s) || {}).value || "";
      const estado = () => JSON.stringify([st.value, dt.value, agData.value, agHora.value, agLembrete.value, motivo, tentarEm,
        valor("#l-outro"), valor("#q-volume"), valor("#q-destinos"), valor("#q-transp"), valor("#l-azul"), valor("#e-cnpj"), valor("#e-razao")]);
      const inicial = estado();
      let salvou = false;
      // Próximo contato digitado e não salvo continua na ficha quando ela é redesenhada (depois de uma tentativa ou de um ✓/✕).
      const agendaPendente = () => {
        const a = [agData.value, agHora.value, agLembrete.value];
        return a.join("|") !== [l.retorno || "", l.retorno_hora || "", l.lembrete || ""].join("|") ? a : undefined;
      };
      if (op.agenda) {
        [agData.value, agHora.value, agLembrete.value] = op.agenda;
        j.querySelectorAll("[data-quando]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.quando === agData.value)));
      }

      let statusAntes = st.value;
      const irPara = (foco) => {
        const alvo = foco === "contatos" ? (j.querySelector("#l-tels") || j.querySelector(".contatos")) : foco === "azul" ? blocoAzul : foco === "embarque" ? blocoEmbarque : st;
        if (!alvo) return;
        alvo.scrollIntoView({ block: "center", behavior: "smooth" });
        alvo.classList.remove("realce"); void alvo.offsetWidth; alvo.classList.add("realce");
        if (foco === "azul") setTimeout(() => j.querySelector("#l-azul").focus(), 300);
        if (foco === "embarque") setTimeout(() => j.querySelector("#e-cnpj").focus(), 300);
      };
      const eCnpj = j.querySelector("#e-cnpj");
      eCnpj.addEventListener("input", () => { const d = eCnpj.value.replace(/\D/g, "").slice(0, 14); eCnpj.value = d.length === 14 ? cnpjFormatado(d) : d; });
      const eUsar = j.querySelector("#e-usar");
      if (eUsar) eUsar.addEventListener("click", () => { eCnpj.value = cnpjFormatado(l.cnpj); j.querySelector("#e-razao").focus(); });
      // Observação digitada e não adicionada: salva sozinha ao salvar o lead ou ao fechar a ficha.
      const obsCampo = j.querySelector("#l-obs");
      obsCampo.dataset.lead = id;
      if (op.obsPendente) obsCampo.value = op.obsPendente;
      guardaFechar = async () => {
        const t = obsCampo.value.trim();
        if (t) {
          try { await API.registrar(id, "observacao", t); obsCampo.value = ""; aviso("Sua observação foi salva automaticamente."); }
          catch (e) { aviso(API.traduzir(e), true); return false; }
        }
        // Mudou status, data, próximo contato ou outro campo e não salvou: pergunta antes de fechar.
        if (salvou || estado() === inicial) return true;
        const r = await escolher({ titulo: "Salvar antes de sair?", texto: `Você mudou <b>${esc(l.empresa)}</b> e ainda não salvou. Se sair agora, a mudança se perde.`,
          opcoes: [{ id: "continuar", rotulo: "Continuar aqui" }, { id: "sair", rotulo: "Sair sem salvar", tipo: "perigo" }, { id: "salvar", rotulo: "Salvar", tipo: "primario" }] });
        if (r === "sair") return true;
        if (r === "salvar") j.querySelector("#l-salvar").click();
        return false;
      };
      st.addEventListener("change", async () => {
        const r = regraStatus(l, st.value);
        if (r) { st.value = statusAntes; await barrado(r); irPara(r.foco); return; }
        statusAntes = st.value;
        j.querySelector("#l-desc").textContent = DESC[st.value] || ""; if (!dt.value && st.value !== "Novo") dt.value = hojeISO(); mostrarBlocos(); erro.hidden = true;
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
            const novo = await confirmar({ titulo: "Editar observação", texto: "Dá para editar no mesmo dia em que foi escrita.", botao: "Salvar", campo: h.texto });
            if (!novo || !novo.trim() || novo.trim() === h.texto) return;
            try { await API.editarObservacao(id, h.id, novo.trim()); carregarHist(); } catch (e) { aviso(API.traduzir(e), true); }
          }));
          lista.querySelectorAll("[data-excluir]").forEach(a => a.addEventListener("click", async (ev) => {
            ev.preventDefault();
            if (!(await confirmar({ titulo: "Excluir esta observação?", texto: "Ela sai do histórico do lead.", botao: "Excluir", perigo: true }))) return;
            try { await API.excluirObservacao(id, a.dataset.excluir); carregarHist(); } catch (e) { aviso(API.traduzir(e), true); }
          }));
        } catch (e) { lista.innerHTML = `<p class="sub">${esc(API.traduzir(e))}</p>`; }
      };
      carregarHist();

      j.querySelector("#l-add-obs").addEventListener("click", async (ev) => {
        const t = j.querySelector("#l-obs").value.trim(), bt = ev.currentTarget;
        if (!t) return;
        try {
          await ocupado(bt, () => API.registrar(id, "observacao", t)); j.querySelector("#l-obs").value = ""; carregarHist();
          aviso("Observação adicionada.", false, async () => {
            const hs = await API.historico(id);
            const h = hs.filter(x => x.tipo === "observacao" && x.autor === E.perfil.id && x.texto === t).pop();
            if (h) await API.excluirObservacao(id, h.id);
            if ($janela.open && $janela.querySelector(`#l-obs[data-lead="${id}"]`)) carregarHist();
            aviso("Observação retirada.");
          });
        } catch (e) { aviso(API.traduzir(e), true); }
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
            whatsapp: ok ? `WhatsApp enviado: ${modeloEnviado || (retomada ? "Retomada" : "Primeiro contato")}` : null,
            email: ok ? `E-mail enviado: ${modeloEnviado || (retomada ? "Retomada" : "Primeiro contato")}` : null,
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
            // Ligação atendida: o número usado fica marcado como "Funciona" (vale para a unidade toda e vai para o histórico).
            if (canal === "ligacao" && ok && tel) {
              const m = marcas(l);
              m.nao.delete(tel); m.ok.add(tel);
              Object.assign(dados, { contatos_ok: [...m.ok], contatos_nao: [...m.nao], contato_valido: contatoValidoDe(l, m.ok, m.nao) });
              if ((l.tel_errados || []).length) dados.tel_errados = [];
            }
            // Quem faz a primeira tentativa passa a cuidar do lead (dá para trocar na ficha).
            if (!ehTime() && !l.cuida_uid) Object.assign(dados, cuidaEu());
            const agenda = agendaPendente();
            const contato = canal === "email" ? email : tel;
            await API.atualizarLead(id, dados, { canal, texto });
            await carregar(); desenhar();
            janelaLead(id, { aposTentativa: true, agenda, comoFoi: { canal, ok, contato } });
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
        if (canal === "ligacao") {
          // No celular, disca. No computador, mostra o número para ligar de outro aparelho e só pergunta depois.
          if (ehCelular()) { pendente = "ligacao"; location.href = tel.startsWith("0800") ? `tel:${tel}` : `tel:+55${tel}`; setTimeout(() => perguntar("ligacao"), 1500); return; }
          compor.innerHTML = `<div class="ligar-pc"><span class="sub">Ligue do seu celular ou telefone para</span>
              <b class="ligar-numero">${esc(foneTxt(tel))}</b>
              <div class="acoes"><button class="btn btn-p" id="lg-copiar">Copiar número</button><button class="btn btn-p" id="lg-cancelar">Cancelar</button><button class="btn btn-p btn-primario" id="lg-liguei">Já liguei</button></div></div>`;
          compor.querySelector("#lg-copiar").onclick = async () => aviso(await copiar(tel) ? "Número copiado." : "Não deu para copiar. Anote o número.", false);
          compor.querySelector("#lg-cancelar").onclick = () => { compor.innerHTML = ""; };
          compor.querySelector("#lg-liguei").onclick = () => { compor.innerHTML = ""; perguntar("ligacao"); };
          compor.scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }
        const mods = modelosMensagem();
        let mod = mods.find(m => m.id === modeloPadrao(l, n)) || mods[0];
        const textoDe = (m) => preencher(canal === "email" ? m.email : m.whatsapp, l);
        compor.innerHTML = `<div class="msg-prev">
            <div class="cab cab-modelo"><label for="m-modelo">Modelo</label><select id="m-modelo">${mods.map(m => `<option value="${esc(m.id)}"${m.id === mod.id ? " selected" : ""}>${esc(m.nome)}</option>`).join("")}</select></div>
            <div class="cab">${canal === "email" ? `<b>Para</b>${esc(email)}<br><b>Assunto</b><input id="m-assunto" value="${esc(preencher(mod.emailAssunto, l))}">` : `<b>Para</b>WhatsApp ${esc(foneTxt(tel))}`}</div>
            <textarea id="m-texto" rows="8">${esc(textoDe(mod))}</textarea></div>
          <div class="acoes" style="margin:8px 0 16px"><span class="sub" style="flex:1" id="m-dica"></span>
            <button class="btn btn-p" id="m-cancelar">Cancelar</button><button class="btn btn-p btn-primario" id="m-abrir">${canal === "email" ? "Abrir no e-mail" : "Abrir no WhatsApp"}</button></div>`;
        const dicaMod = () => { compor.querySelector("#m-dica").textContent = `${mod.id === "retomada" && n ? `${n + 1}ª tentativa. ` : ""}${mod.dica ? mod.dica + " " : ""}Você pode ajustar o texto antes de abrir.`; };
        dicaMod();
        compor.querySelector("#m-modelo").onchange = (e) => {
          mod = mods.find(m => m.id === e.target.value) || mod;
          compor.querySelector("#m-texto").value = textoDe(mod);
          const as = compor.querySelector("#m-assunto"); if (as) as.value = preencher(mod.emailAssunto, l);
          dicaMod();
        };
        compor.querySelector("#m-cancelar").onclick = () => { compor.innerHTML = ""; };
        compor.querySelector("#m-abrir").onclick = () => {
          const texto = compor.querySelector("#m-texto").value;
          const url = canal === "email"
            ? `mailto:${email}?subject=${encodeURIComponent(compor.querySelector("#m-assunto").value)}&body=${encodeURIComponent(texto)}`
            : `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`;
          pendente = canal; modeloEnviado = mod.nome; compor.innerHTML = "";
          if (canal === "email") location.href = url; else window.open(url, "_blank", "noopener");
          setTimeout(() => { if (pendente) perguntar(canal); }, 1500);
        };
        compor.scrollIntoView({ block: "center", behavior: "smooth" });
      };
      j.querySelectorAll("[data-canal]").forEach(b => b.addEventListener("click", () => acionar(b.dataset.canal)));

      // Lista de telefones e e-mails: usar outro número, copiar, ver todos, número errado.
      j.addEventListener("click", async (ev) => {
        const b = ev.target.closest("[data-tel-zap],[data-tel-ligar],[data-marca],[data-tel-todos],[data-tel-menos],[data-mail-usar],[data-mail-todos],[data-copiar]");
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
        else if (d.marca) marcarContato(d.contato, d.marca);
      });
      // ✓ Funciona / ✕ Não funciona em cada telefone ou e-mail (clicar de novo tira a marcação).
      const marcarContato = async (c, tipo) => {
        const { ok, nao } = marcas(l);
        const antes = { contatos_ok: [...ok], contatos_nao: [...nao], contato_valido: l.contato_valido || "" };
        const ehTel = /^\d+$/.test(c), nome = ehTel ? foneTxt(c) : c;
        const tirar = tipo === "ok" ? ok.has(c) : nao.has(c);
        ok.delete(c); nao.delete(c);
        if (!tirar) (tipo === "ok" ? ok : nao).add(c);
        const dados = { contatos_ok: [...ok], contatos_nao: [...nao], contato_valido: contatoValidoDe(l, ok, nao) };
        if ((l.tel_errados || []).length) dados.tel_errados = [];
        try {
          await API.atualizarLead(id, dados);
          await carregar(); desenhar();
          const atual = E.leads.find(x => x.id === id) || l;
          if (dados.contato_valido === "Não" && atual.status !== "Contato inválido" && await confirmar({ titulo: "Nenhum contato funciona", texto: "Todos os telefones e e-mails foram marcados como não funciona. Mudar o status para Contato inválido?", botao: "Mudar para Contato inválido" })) {
            await API.atualizarLead(id, { status: "Contato inválido", data_contato: atual.data_contato || hojeISO(), retorno: "", retorno_hora: "", lembrete: "" });
            await aposMudarLead(`${atual.empresa}: Contato inválido.`);
          }
          janelaLead(id, { telTodos: !!j.querySelector(".ct-grupo"), agenda: agendaPendente() });
          aviso(tirar ? `Marcação de ${nome} retirada.` : tipo === "ok" ? `${nome}: funciona.` : `${nome}: não funciona.`, false, async () => {
            await API.atualizarLead(id, antes); await carregar(); desenhar();
            if ($janela.open && $janela.querySelector(`#l-obs[data-lead="${id}"]`)) janelaLead(id);
            aviso("Desfeito.");
          });
        } catch (e) { aviso(API.traduzir(e), true); }
      };

      // Quem cuida do lead: "Vou cuidar deste", "Passar para mim" e "Deixar de cuidar".
      const btCuidar = j.querySelector("#l-cuidar");
      if (btCuidar) btCuidar.addEventListener("click", async () => {
        const antes = { cuida_uid: l.cuida_uid || "", cuida_nome: l.cuida_nome || "" };
        const meu = l.cuida_uid === E.perfil.id;
        if (!meu && l.cuida_uid && !(await confirmar({ titulo: `Passar ${l.empresa} para você?`, texto: `Hoje quem cuida é ${esc(l.cuida_nome || "outra pessoa")}. Combine com a pessoa antes, para ninguém abordar a empresa duas vezes.`, botao: "Passar para mim" }))) return;
        try {
          await API.atualizarLead(id, meu ? { cuida_uid: "", cuida_nome: "" } : cuidaEu());
          await carregar(); desenhar(); janelaLead(id, { agenda: agendaPendente() });
          aviso(meu ? "Você deixou de cuidar deste lead." : "Agora você cuida deste lead.", false, async () => { await API.atualizarLead(id, antes); await carregar(); desenhar(); if ($janela.open) janelaLead(id); aviso("Desfeito."); });
        } catch (e) { aviso(API.traduzir(e), true); }
      });

      // "Como foi?" e "Quando volto?" (depois de uma tentativa): as respostas preenchem status, ✓/✕ e próximo contato, e já salvam.
      const cfBox = j.querySelector("#l-comofoi");
      if (cfBox && op.comoFoi) {
        const cf = op.comoFoi;
        const dec = { dados: {}, ok: null, nao: null };
        const passo = (nome) => {
          cfBox.querySelectorAll(".cf-passo").forEach(x => { x.hidden = x.dataset.passo !== nome; });
          const f = cfBox.querySelector(`[data-passo="${nome}"] .cf-op`); if (f) f.focus();
        };
        const marcar = (contato, tipo) => {
          const m = dec.ok ? { ok: dec.ok, nao: dec.nao } : marcas(l);
          m.ok.delete(contato); m.nao.delete(contato); (tipo === "ok" ? m.ok : m.nao).add(contato);
          dec.ok = m.ok; dec.nao = m.nao;
        };
        cfBox.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) dec.toque = b.getBoundingClientRect(); }, true);
        const gravar = async (extra, msg) => {
          const dados = { ...dec.dados, ...extra };
          if (dec.ok) {
            Object.assign(dados, { contatos_ok: [...dec.ok], contatos_nao: [...dec.nao], contato_valido: contatoValidoDe(l, dec.ok, dec.nao) });
            if ((l.tel_errados || []).length) dados.tel_errados = [];
          }
          if (!l.data_contato && !dados.data_contato) dados.data_contato = hojeISO();
          if (!ehTime() && !l.cuida_uid) Object.assign(dados, cuidaEu());
          cfBox.querySelectorAll("button, input").forEach(x => { x.disabled = true; });
          try {
            const antes = !ehTime() && podePedir();
            await API.atualizarLead(id, dados);
            salvou = true;
            await carregar(); desenhar();
            janelaLead(id, { salvoMsg: msg });
            voarSolto(dec.toque);
            if (!ehTime() && !antes && podePedir()) aviso("Base liberada: nenhum lead em Novo ou Prospecção. Você já pode pedir uma nova base.");
          } catch (e) { cfBox.querySelectorAll("button, input").forEach(x => { x.disabled = false; }); aviso(API.traduzir(e), true); }
        };
        cfBox.querySelectorAll("[data-como]").forEach(b => b.addEventListener("click", async () => {
          const v = b.dataset.como;
          cfBox.querySelectorAll("[data-como]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
          if (v === "interesse") {
            if (cf.contato) marcar(cf.contato, "ok");
            if (["Novo", "Prospecção", "Sem interesse", "Contato inválido"].includes(l.status)) {
              dec.dados.status = "Em negociação";
              if (l.motivo || l.tentar_em) Object.assign(dec.dados, { motivo: "", motivo_outro: "", tentar_em: "" });
            }
            passo("quando");
          } else if (v === "sem") {
            passo("motivo");
          } else if (v === "errado") {
            if (cf.contato) marcar(cf.contato, "nao");
            if (contatoValidoDe(l, dec.ok, dec.nao) === "Não") {
              await gravar({ status: "Contato inválido", retorno: "", retorno_hora: "", lembrete: "" }, "Nenhum contato funciona: o lead foi para Contato inválido. Tudo salvo.");
              return;
            }
            cfBox.querySelector("#cf-q-quando").textContent = "Quando você tenta outro contato?";
            passo("quando");
          } else passo("quando");
        }));
        const salvarMotivo = (m, outro) => gravar({ status: "Sem interesse", motivo: m, motivo_outro: m === "Outro motivo" ? outro : "", tentar_em: "", retorno: "", retorno_hora: "", lembrete: "" },
          `Sem interesse (${m === "Outro motivo" ? outro : m}). Tudo salvo.`);
        cfBox.querySelectorAll("[data-cf-motivo]").forEach(b => b.addEventListener("click", () => {
          const m = b.dataset.cfMotivo;
          if (m === "Outro motivo") { cfBox.querySelector("#cf-outro-c").hidden = false; cfBox.querySelector("#cf-outro").focus(); return; }
          salvarMotivo(m, "");
        }));
        cfBox.querySelector("#cf-outro-ok").addEventListener("click", () => {
          const t = cfBox.querySelector("#cf-outro").value.trim();
          if (!t) { cfBox.querySelector("#cf-outro").focus(); return; }
          salvarMotivo("Outro motivo", t);
        });
        const salvarQuando = (d) => {
          // Lead em Sem interesse que está sendo retomado: a data vira "tentar de novo" (ele continua sem travar a base).
          const extra = l.status === "Sem interesse" && !dec.dados.status ? { tentar_em: d } : { retorno: d, retorno_hora: "", lembrete: "" };
          return gravar(extra, `${dec.dados.status ? "Lead em " + dec.dados.status + ". " : ""}Próximo contato em ${data(d)}. Tudo salvo.`);
        };
        cfBox.querySelectorAll("[data-cf-quando]").forEach(b => b.addEventListener("click", () => {
          if (b.dataset.cfQuando === "outra") { cfBox.querySelector("#cf-data-c").hidden = false; cfBox.querySelector("#cf-data").focus(); return; }
          salvarQuando(b.dataset.cfQuando);
        }));
        cfBox.querySelector("#cf-data-ok").addEventListener("click", () => {
          const d = cfBox.querySelector("#cf-data").value;
          if (!d || d < hojeISO()) { aviso("Escolha hoje ou uma data futura.", true); return; }
          salvarQuando(d);
        });
        cfBox.querySelector("#cf-pular").addEventListener("click", () => { cfBox.remove(); blocoAgenda.hidden = false; blocoAgenda.scrollIntoView({ block: "center", behavior: "smooth" }); });
        setTimeout(() => cfBox.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
      }


      j.querySelector("#l-salvar").addEventListener("click", async (ev) => {
        const falha = (msg) => { erro.textContent = msg; erro.hidden = false; erro.scrollIntoView({ block: "center", behavior: "smooth" }); };
        const bt = ev.currentTarget, rBt = bt.getBoundingClientRect();
        const regra = regraStatus(l, st.value);
        if (regra) { await barrado(regra); irPara(regra.foco); return; }
        const textoAzul = st.value === "Cliente Azul" && l.status !== "Cliente Azul" ? j.querySelector("#l-azul").value.trim() : "";
        if (st.value === "Cliente Azul" && l.status !== "Cliente Azul" && !textoAzul) { await barrado(REGRA_AZUL(l)); irPara("azul"); return; }
        const embarqueNovo = st.value === "Embarque iniciado" && l.status !== "Embarque iniciado";
        const cnpjEmb = embarqueNovo ? cnpjFormatado(eCnpj.value) : "", razaoEmb = embarqueNovo ? j.querySelector("#e-razao").value.trim() : "";
        if (embarqueNovo && (!cnpjValido(cnpjEmb) || razaoEmb.length < 3)) {
          const r = REGRA_EMBARQUE(l);
          if (eCnpj.value.trim() && !cnpjValido(cnpjEmb)) r.texto = `O CNPJ <b>${esc(eCnpj.value.trim())}</b> não é válido. Confira os números no cartão CNPJ e preencha também a razão social.`;
          await barrado(r); irPara("embarque"); return;
        }
        const obsPendente = obsCampo.value.trim();
        const dados = { status: st.value, data_contato: dt.value || null };
        if (embarqueNovo) Object.assign(dados, { cnpj_embarque: cnpjEmb, razao_embarque: razaoEmb });
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
          const novo = await ocupado(bt, async () => {
            const r = await API.atualizarLead(id, dados);
            if (textoAzul) await API.registrar(id, "observacao", "Cliente Azul: " + textoAzul);
            if (embarqueNovo) await API.registrar(id, "observacao", `Embarque iniciado: ${razaoEmb} · CNPJ ${cnpjEmb}`);
            if (obsPendente) { await API.registrar(id, "observacao", obsPendente); obsCampo.value = ""; }
            return r;
          });
          Object.assign(l, novo); salvou = true; voarSolto(rBt); fechar();
          await aposMudarLead((st.value === "Sem interesse" ? `${l.empresa}: Sem interesse (${motivoDe(l)}).` : dados.retorno ? `Lead salvo. Próximo contato em ${data(dados.retorno)}.` : "Lead salvo.") + (obsPendente ? " A observação também foi salva." : ""));
        } catch (e) { aviso(API.traduzir(e), true); }
      });

      if (op.canal) { const b = j.querySelector(`[data-canal="${op.canal}"]`); if (b) b.click(); }
      if (op.status) { st.value = op.status; statusAntes = op.status; j.querySelector("#l-desc").textContent = DESC[op.status] || ""; if (!dt.value) dt.value = hojeISO(); mostrarBlocos(); (op.status === "Sem interesse" ? blocoMotivo : st).scrollIntoView({ block: "center" }); }
      if (op.foco) setTimeout(() => irPara(op.foco), 150);
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
  // Opção do dono: só ele pede a próxima base (padrão: todos da unidade pedem).
  const soDonoBloqueia = (u) => { u = u || unidade(); return !!(u && u.so_dono_pede && u.dono_uid && u.dono_uid !== E.perfil.id); };
  const podePedir = () => !emAndamento() && abertosBase().length === 0 && !soDonoBloqueia();

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
      return `<div class="vazio"><h2>${estaU()} ainda não tem leads</h2><p>Peça a primeira base escolhendo até 3 segmentos fortes e até 3 cidades. São ${MAX} leads por pedido.</p><button class="btn btn-primario" data-acao="novoPedido">Pedir leads</button></div>`;
    }
    let titulo, texto, acao = "";
    if (andamento) {
      titulo = "Seu pedido está com o time";
      texto = `Pedido de ${data(andamento.criada_em)} (${esc(segmentosDe(andamento))}): ${andamento.situacao === "Nova" ? "recebido pelo time" : "o time está separando seus leads"}. Previsão de entrega: ${esc(sexta(andamento.previsao))}, conforme a disponibilidade do time.`;
    } else if (!doBase.length) {
      titulo = `Último pedido: ${esc(situacaoTexto(base.situacao))}`;
      texto = base.observacao_time ? esc(base.observacao_time) : "Você já pode pedir uma nova base.";
      acao = `<button class="btn btn-primario" data-acao="novoPedido">Pedir nova base</button>`;
    } else if (abertos) {
      titulo = `Pedido atual: ${trabalhados} de ${doBase.length} leads trabalhados`;
      texto = `${abertos > 1 ? "Faltam" : "Falta"} ${abertos} lead${abertos > 1 ? "s" : ""} em Novo ou Prospecção para liberar uma nova base.`;
      acao = `<button class="btn btn-primario" data-acao="verFaltam">Ver ${abertos > 1 ? `os ${abertos} leads que faltam` : "o lead que falta"}</button>`;
    } else {
      titulo = `Pedido atual: ${trabalhados} de ${doBase.length} leads trabalhados`;
      texto = `<span class="liberado">Base liberada.</span> Nenhum lead em Novo ou Prospecção. Você já pode pedir uma nova base.`;
      acao = `<button class="btn btn-primario" data-acao="novoPedido">Pedir nova base</button>`;
    }
    if (soDonoBloqueia() && /novoPedido/.test(acao)) acao = `<p class="so-dono">Nesta unidade, quem pede a base é <b>${esc(primeiroNome(unidade().dono_nome || "o dono"))}</b>.</p>`;
    const trilha = doBase.length ? `<div class="trilha" aria-hidden="true">${doBase.slice().sort((a, b) => final(b) - final(a)).map(l =>
      final(l) ? `<span class="fim" style="background:${COR[l.status]}" title="${esc(l.status)}"></span>` : `<span title="${esc(l.status)}" style="border-color:${COR[l.status]}"></span>`).join("")}</div>` : "";
    return `<section class="base">${icone("aviao")}<div><h2>${titulo}</h2><p>${texto}</p>${trilha}</div><div>${acao}</div></section>`;
  }

  // Agenda do dia: próximos contatos vencidos e leads "tentar de novo" que chegaram na data.
  function blocoParaHoje() {
    if (!leadsU().length) return "";
    const hoje = hojeISO();
    const ordem = (l) => (l.retorno && l.retorno < hoje ? "0" : "1") + (l.retorno || l.tentar_em || "") + (l.retorno_hora || "99:99");
    const equipe = temEquipe((unidade() || {}).sigla);
    const soMeus = equipe && (E.hojeQuem || "meus") === "meus";
    const todosHoje = leadsU().filter(paraHoje);
    const lista = todosHoje.filter(l => !soMeus || meuLead(l)).sort((a, b) => ordem(a).localeCompare(ordem(b)));
    const pilQuem = equipe ? `<div class="pilulas pilulas-mini" role="group" aria-label="De quem">
          <button data-hoje-quem="meus" aria-pressed="${soMeus}">Meus (${todosHoje.filter(meuLead).length})</button><button data-hoje-quem="todos" aria-pressed="${!soMeus}">Da unidade (${todosHoje.length})</button></div>` : "";
    if (!lista.length) return `<section class="hoje hoje-vazio"><b>Para hoje</b><span>${soMeus && todosHoje.length ? `Nenhum contato seu para hoje. A unidade tem ${todosHoje.length}: toque em “Da unidade” para ver.` : "Nenhum contato marcado para hoje. Na ficha de cada lead, use “Próximo contato” para montar sua agenda."}</span>${pilQuem}</section>`;
    // Cartões ou Lista: a pessoa escolhe; sem escolha, com mais de 3 contatos abre em Lista.
    let salva = null; try { salva = localStorage.getItem("portal-vista-hoje"); } catch (e) { /* ignora */ }
    const emLista = (E.vistaHoje || salva || (lista.length > 3 ? "lista" : "cartoes")) === "lista";
    return `<section class="hoje" aria-label="Para hoje">
      <div class="hoje-topo"><h2>Para hoje <span class="qtd-hoje">${lista.length} contato${lista.length > 1 ? "s" : ""}</span></h2>
        ${pilQuem}
        <div class="pilulas pilulas-mini" role="group" aria-label="Forma de ver o Para hoje">
          <button data-vista-hoje="cartoes" aria-pressed="${!emLista}">Cartões</button><button data-vista-hoje="lista" aria-pressed="${emLista}">Lista</button></div></div>
      <div class="hoje-lista${emLista ? " em-lista" : ""}">${lista.map(l => {
        const atrasado = l.retorno && l.retorno < hoje;
        const rotuloDia = retornoDevido(l)
          ? (atrasado ? `Atrasado desde ${data(l.retorno)}` : `Hoje${l.retorno_hora ? ", " + esc(l.retorno_hora) : ", sem horário"}`)
          : `Tentar de novo hoje · ${esc(motivoDe(l) || "Sem interesse")}`;
        const tel = API.limparTelefone(l.telefone), mail = API.limparEmail(l.email);
        const n = tentativasDe(l);
        return `<div class="hoje-item${atrasado ? " atrasado" : ""}" data-lead="${esc(l.id)}" role="button" tabindex="0" aria-label="${esc(l.empresa)}">
          <span class="hoje-quando">${rotuloDia}</span>
          <b>${esc(l.empresa)}</b>
          <span class="sec">${esc([l.contato, l.status, n ? `${n} tentativa${n > 1 ? "s" : ""}` : "", !soMeus && l.cuida_nome && l.cuida_uid !== E.perfil.id ? "com " + l.cuida_nome : ""].filter(Boolean).join(" · "))}</span>
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
    if (E.f.faltam && !abertosBase().length) E.f.faltam = false; // a base liberou: volta a mostrar todos
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
          <div class="campo"><label for="f-base">Pedido</label><select id="f-base" data-filtro="base"><option value="atual"${E.f.base === "atual" ? " selected" : ""}>Pedido atual</option><option value="todas"${E.f.base === "todas" ? " selected" : ""}>Todos os pedidos</option></select></div>
          <div class="campo"><label for="f-status">Status</label><select id="f-status" data-filtro="status">${opcoes(NOMES_STATUS, E.f.status, "Todos")}</select></div>
          ${seletorVista()}
        </div>
        ${E.f.faltam ? `<div class="aviso-filtro" id="aviso-faltam"><span>Mostrando só os leads em <b>Novo</b> ou <b>Prospecção</b>. Tire todos daí para liberar uma nova base.</span><button class="btn btn-p" data-acao="verTodos">Mostrar todos</button></div>` : ""}
        ${E.vista === "kanban" ? quadro(lista) : tabelaLeads(lista)}` : ""}`;
  }

  function contagem(p) {
    const ls = E.leads.filter(l => l.solicitacao_id === p.id);
    return ls.length ? `${ls.filter(final).length} de ${ls.length}` : "–";
  }

  function telaPedidosRep() {
    const pode = podePedir();
    const motivo = emAndamento() ? `${estaU()} já tem um pedido em andamento.` : abertosBase().length ? `Tire os ${abertosBase().length} leads de Novo e Prospecção para pedir uma nova base.` : "";
    const donoPede = soDonoBloqueia() ? ` Nesta unidade, quem pede a base é ${primeiroNome((unidade() || {}).dono_nome || "o dono")}.` : "";
    const ps = pedidosU();
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Meus pedidos</h1><p>${pode ? "Você pode pedir uma nova base agora." : esc(motivo + donoPede)}</p></div>
        <div class="acoes"><button class="btn btn-primario" data-acao="novoPedido"${pode ? "" : " disabled"}>Pedir nova base</button></div></div>
      ${barraUnidades()}
      ${quemCuida(ps)}
      ${ps.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Data</th><th>Pedido por</th><th>Previsão</th><th>Segmentos</th><th>Cidades</th><th>Empresas indicadas</th><th>Situação</th><th>Leads trabalhados</th></tr></thead>
        <tbody>${ps.map(p => `<tr>
          <td>${data(p.criada_em)}</td><td>${esc(p.solicitante === E.perfil.id ? "Você" : primeiroNome(p.solicitante_nome) || "–")}</td><td>${data(p.previsao)}</td><td>${esc(segmentosDe(p))}</td><td>${esc(cidadesDe(p) || "–")}</td><td class="sec" style="white-space:pre-line">${esc(p.empresas || "")}</td>
          <td>${chipSituacao(p.situacao)}${donoPedido(p) && !donoPedido(p).porRegiao ? `<div class="sec">com ${esc(primeiroNome(donoPedido(p).nome))}</div>` : ""}${p.observacao_time ? `<div class="sec">${esc(p.observacao_time)}</div>` : ""}</td><td>${contagem(p)}</td></tr>`).join("")}</tbody>
      </table></div>` : `<div class="vazio"><h2>Nenhum pedido ainda</h2><p>O primeiro pedido desta unidade aparece aqui com a situação de cada etapa.</p></div>`}`;
  }

  // Representante: quem do time cuida da unidade dele (ou a fila do time, nas regiões livres).
  function quemCuida(ps) {
    const u = unidade(); if (!u) return "";
    const aberto = ps.find(p => ["Nova", "Em extração", "Enviada"].includes(p.situacao));
    const d = (aberto && donoPedido(aberto) && !donoPedido(aberto).porRegiao) ? donoPedido(aberto) : responsavelRegiao(u.regiao);
    if (!d) return `<div class="quem-cuida fila"><div class="avatar" aria-hidden="true">IS</div>
      <div class="txt"><small>Quem cuida da ${suaU()}</small><b>Time de ${esc(TIME)}</b><span class="sub">${aberto ? "Seu pedido está na fila do time. Quando alguém assumir, o nome aparece aqui." : "O primeiro do time que puxar o seu pedido passa a ser o seu contato."}</span></div></div>`;
    const link = zap(d.celular, `Olá, ${primeiroNome(d.nome)}! Aqui é ${primeiroNome(E.perfil.nome)}, da unidade ${u.sigla}.`);
    return `<div class="quem-cuida"><div class="avatar" aria-hidden="true">${esc((d.nome || "?").charAt(0).toUpperCase())}</div>
      <div class="txt"><small>Quem cuida da ${suaU()}</small><b>${esc(d.nome)} · ${esc(TIME)}${u.regiao ? " " + esc(u.regiao) : ""}</b>${d.substituindo ? `<span class="sub">Cobrindo ${esc(d.substituindo)} nas férias</span>` : ""}</div>
      ${link ? `<a class="btn btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div>`;
  }

  // ------------------------------------------------------------------
  // Dono da unidade: equipe, convites e aprovação
  // ------------------------------------------------------------------
  const unidadeEquipe = () => { const d = unidadesDono(); return d.find(x => x.sigla === E.u) || d[0] || null; };
  const msgConvite = (c) => `Olá, ${primeiroNome(c.nome)}! Aqui é ${primeiroNome(E.perfil.nome)}, da unidade ${c.sigla}. Criei seu acesso ao ${cfg.nomeDoPortal || "Portal de Leads"} da ${EMPRESA}. Abra o link, crie uma senha só para o portal e você já entra liberado: ${linkConvite(c.id)}\n\nO link vale ${VALIDADE_CONVITE} dias e funciona só com o e-mail ${c.email}.`;
  const validoAte = (c) => { const d = new Date(new Date(c.criado_em).getTime() + VALIDADE_CONVITE * DIA); return d.toLocaleDateString("pt-BR"); };
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (e) {
      const t = document.createElement("textarea"); t.value = texto; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      ($janela.open ? $janela : document.body).appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (x) { ok = false; }
      t.remove(); return ok;
    }
  }

  function telaEquipe() {
    const u = unidadeEquipe();
    if (!u) return `<div class="vazio"><h2>Você não é dono de nenhuma unidade</h2><p>Quem cuida da equipe é o dono da unidade. Fale com o time de ${esc(TIME)} se precisar mudar.</p></div>`;
    const donas = unidadesDono();
    const eq = (E.equipe || {})[u.sigla] || { pessoas: [], convites: [] };
    const outros = eq.pessoas.filter(p => p.uid !== E.perfil.id);
    const aguardando = outros.filter(p => p.situacao === "pendente");
    const ativos = eq.pessoas.filter(p => p.situacao === "aprovado").sort((a, b) => (b.uid === E.perfil.id) - (a.uid === E.perfil.id) || String(a.nome).localeCompare(String(b.nome)));
    const fora = outros.filter(p => p.situacao === "recusado");
    const abertos = eq.convites.filter(c => !c.usado).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    const cel = (p) => p.perfil && p.perfil.celular ? foneBonito(p.perfil.celular) : "";
    const pessoaCel = (p) => p.perfil && p.perfil.celular;
    const perfilPendente = (p) => !!(p.perfil && p.perfil.situacao === "pendente");
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Minha equipe</h1>
        <p>Unidade ${esc(rotulo(u.sigla))}${u.cidade_uf ? ", " + esc(u.cidade_uf) : ""}. Você é o dono: convide os vendedores e libere quem pedir acesso. ${u.so_dono_pede ? "Todos trabalham os leads, e só você pede a próxima base." : "Todos da equipe pedem e trabalham os leads da unidade."}</p></div>
        <div class="acoes"><button class="btn btn-primario" data-acao="convidar" data-sigla="${esc(u.sigla)}">+ Convidar pessoa</button></div></div>
      ${donas.length > 1 ? `<div class="pilulas" role="group" aria-label="Unidade" style="margin-bottom:16px">${donas.map(x => `<button data-unidade="${esc(x.sigla)}" aria-pressed="${x.sigla === u.sigla}">${esc(rotulo(x.sigla))}${(E.equipe[x.sigla] || { pessoas: [] }).pessoas.some(p => p.situacao === "pendente" && p.uid !== E.perfil.id) ? " •" : ""}</button>`).join("")}</div>` : ""}
      ${eq.erro ? `<div class="erro-form">${esc(eq.erro)}</div>` : ""}
      ${aguardando.length ? `<section class="bloco equipe-espera"><h2>Aguardando você (${aguardando.length})</h2>
        <p class="sub">Confira se a pessoa é mesmo da sua unidade antes de liberar.</p>
        <div class="tabela-wrap" style="border:0"><table><thead><tr><th>Pessoa</th><th>Celular</th><th>Pediu</th><th>Ações</th></tr></thead><tbody>
        ${aguardando.map(p => `<tr><td><b>${esc(p.nome)}</b><div class="sec">${esc(p.email)}</div>${p.principal ? "" : `<div class="sec">Pediu esta unidade como extra</div>`}</td>
          <td>${esc(cel(p) || "–")}</td><td>${p.perfil && p.perfil.criadoEm ? haDias(p.perfil.criadoEm) : p.criadoEm ? haDias(p.criadoEm) : "–"}</td>
          <td><div class="acoes"><button class="btn btn-p btn-primario" data-acao="liberarEquipe" data-id="${esc(p.uid)}" data-sigla="${esc(u.sigla)}" data-perfil="${perfilPendente(p) ? 1 : ""}">Liberar</button>
            <button class="btn btn-p btn-perigo" data-acao="recusarEquipe" data-id="${esc(p.uid)}" data-sigla="${esc(u.sigla)}" data-perfil="${perfilPendente(p) ? 1 : ""}">Recusar</button></div></td></tr>`).join("")}
        </tbody></table></div></section>` : ""}
      <section class="bloco quem-pede" style="margin-bottom:18px"><h2>Quem pede a próxima base</h2>
        <p class="sub">Todos continuam trabalhando os leads. Isto só decide quem pode pedir a base nova quando a atual for liberada.</p>
        <div class="pilulas" role="group" aria-label="Quem pede a próxima base">
          <button data-acao="quemPede" data-sigla="${esc(u.sigla)}" data-valor="todos" aria-pressed="${!u.so_dono_pede}">Todos da unidade</button>
          <button data-acao="quemPede" data-sigla="${esc(u.sigla)}" data-valor="dono" aria-pressed="${!!u.so_dono_pede}">Só eu (dono)</button></div></section>
      <section class="bloco" style="margin-bottom:18px"><h2>Equipe da unidade (${ativos.length})</h2>
        <div class="tabela-wrap" style="border:0"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Celular</th><th>Ações</th></tr></thead><tbody>
        ${ativos.map(p => { const eu = p.uid === E.perfil.id; const link = !eu && pessoaCel(p) ? zap(pessoaCel(p), `Olá, ${primeiroNome(p.nome)}! Aqui é ${primeiroNome(E.perfil.nome)}, da unidade ${u.sigla}.`) : "";
          return `<tr><td><b>${esc(p.nome)}</b> <span class="etiqueta${eu ? " dono" : ""}">${eu ? "Dono" : "Vendedor"}</span></td><td>${esc(p.email)}</td><td>${esc(eu ? foneBonito(E.perfil.celular || "") : cel(p) || "–")}</td>
          <td><div class="acoes">${eu ? `<span class="sec">Você</span>` : `${link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<button class="btn btn-p btn-perigo-leve" data-acao="tirarEquipe" data-id="${esc(p.uid)}" data-sigla="${esc(u.sigla)}">Tirar da unidade</button>`}</div></td></tr>`; }).join("")}
        </tbody></table></div></section>
      <section class="bloco" style="margin-bottom:18px"><h2>Convites abertos (${abertos.length})</h2>
        ${abertos.length ? `<div class="tabela-wrap" style="border:0"><table><thead><tr><th>Pessoa</th><th>Enviado</th><th>Vale até</th><th>Ações</th></tr></thead><tbody>
        ${abertos.map(c => { const venc = conviteVencido(c); const link = !venc && c.celular ? zap(c.celular, msgConvite(c)) : "";
          return `<tr${venc ? ' class="vencido"' : ""}><td><b>${esc(c.nome)}</b><div class="sec">${esc(c.email)}</div></td><td>${haDias(c.criado_em)}${c.criado_por_nome && c.criado_por !== E.perfil.id ? `<div class="sec">por ${esc(c.criado_por_nome)}</div>` : ""}</td>
          <td>${venc ? `<span class="etiqueta alerta">Venceu</span>` : esc(validoAte(c))}</td>
          <td><div class="acoes">${venc ? `<button class="btn btn-p" data-acao="convidar" data-sigla="${esc(u.sigla)}" data-nome="${esc(c.nome)}" data-email="${esc(c.email)}" data-cel="${esc(c.celular || "")}" data-trocar="${esc(c.id)}">Mandar outro</button>`
            : `${link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">Reenviar no WhatsApp</a>` : ""}<button class="btn btn-p" data-acao="copiarConvite" data-id="${esc(c.id)}">Copiar link</button>`}
            <button class="btn btn-p btn-perigo-leve" data-acao="cancelarConvite" data-id="${esc(c.id)}">Cancelar</button></div></td></tr>`; }).join("")}
        </tbody></table></div>` : `<p class="sub">Nenhum convite aberto. Use <b>+ Convidar pessoa</b> para mandar o link pelo WhatsApp.</p>`}
      </section>
      ${fora.length ? `<section class="bloco" style="margin-bottom:18px"><h2>Sem acesso (${fora.length})</h2>
        <div class="tabela-wrap" style="border:0"><table><tbody>${fora.map(p => `<tr><td><b>${esc(p.nome)}</b><div class="sec">${esc(p.email)}</div></td>
          <td><div class="acoes">${p.perfil && p.perfil.situacao !== "aprovado" ? `<span class="sec">Cadastro recusado. Para reativar, fale com o time de ${esc(TIME)}.</span>`
            : `<button class="btn btn-p" data-acao="liberarEquipe" data-id="${esc(p.uid)}" data-sigla="${esc(u.sigla)}" data-perfil="">Liberar de novo</button>`}</div></td></tr>`).join("")}</tbody></table></div></section>` : ""}
      <section class="bloco como-funciona"><h2>Como funciona o convite</h2>
        <ol><li>Clique em <b>+ Convidar pessoa</b> e preencha nome, e-mail (<b>${esc(u.sigla.toLowerCase())}.nome</b>@…) e celular.</li>
          <li>Mande o link pelo WhatsApp. Ele vale ${VALIDADE_CONVITE} dias e só funciona com o e-mail convidado.</li>
          <li>A pessoa cria a senha e já entra liberada na unidade, sem esperar aprovação.</li></ol>
        <p class="sub">Quem criar o acesso sozinho pela tela de entrada aparece em <b>Aguardando você</b>.</p></section>`;
  }

  // ---- Minha equipe do coordenador ou gerente: carteiras de quem responde a ele, só consulta ----
  function telaGestao() {
    const us = (E.equipeComercial || []).slice().sort((a, b) => String(a.exec_nome || a.nome).localeCompare(String(b.exec_nome || b.nome)));
    const hoje = hojeISO();
    const linhas = us.map(u => {
      const ps = (E.pedidosEquipe || []).filter(p => p.sigla === u.sigla);
      const atual = ps[0];
      const ls = (E.leadsEquipe || []).filter(l => l.sigla === u.sigla);
      const doAtual = atual ? ls.filter(l => l.solicitacao_id === atual.id) : [];
      return { u, atual, total: ls.length, base: doAtual.length, trab: doAtual.filter(final).length, par: ls.filter(parado).length,
        atras: ls.filter(l => l.retorno && l.retorno < hoje).length, emb: ls.filter(l => EMBARQUE.includes(l.status)).length,
        direto: !u.exec_gestor || u.exec_gestor === E.perfil.nome };
    });
    const soma = (k) => linhas.reduce((t, x) => t + x[k], 0);
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Minha equipe</h1><p>Carteiras de quem responde a você. Aqui é só consulta: quem trabalha os leads é cada executivo.</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      ${E.erroEquipe ? `<div class="erro-form">${esc(E.erroEquipe)}</div>` : ""}
      <div class="indicadores">
        <div class="indicador">${icone("leads")}<div class="valor">${linhas.length}</div><div class="rotulo">Executivos acompanhados</div></div>
        <div class="indicador${soma("par") ? " atencao" : ""}">${icone("alerta")}<div class="valor">${soma("par")}</div><div class="rotulo">Leads parados em Novo ou Prospecção há mais de ${PRAZO} dias</div></div>
        <div class="indicador${soma("atras") ? " atencao" : ""}">${icone("retorno")}<div class="valor">${soma("atras")}</div><div class="rotulo">Retornos atrasados</div></div>
        <div class="indicador">${icone("fechado")}<div class="valor">${soma("emb")}</div><div class="rotulo">Embarques iniciados</div></div>
      </div>
      <section class="bloco" style="padding:0;overflow:hidden"><h2 style="padding:18px 20px 0">Por executivo</h2>
        <div class="tabela-wrap" style="border:0;border-radius:0"><table>
          <thead><tr><th>Executivo</th><th>Pedido atual</th><th>Parados</th><th>Retornos atrasados</th><th>Embarques</th><th></th></tr></thead>
          <tbody>${linhas.map(x => `<tr><td><b>${esc(x.u.exec_nome || x.u.nome || x.u.sigla)}</b><div class="sec">${esc(x.u.exec_nivel || "Executivo")}${x.u.exec_gestor && !x.direto ? " · responde a " + esc(primeiroNome(x.u.exec_gestor)) : ""} · ${esc(x.u.cidade_uf || "")}</div></td>
            <td>${x.atual ? `${x.trab} de ${x.base} trabalhados<div class="sec">${esc(situacaoTexto(x.atual.situacao))} · ${data(x.atual.criada_em)}</div>` : `<span class="sec">Nenhum pedido ainda</span>`}</td>
            <td${x.par ? ' style="color:var(--danger);font-weight:600"' : ""}>${x.par}</td><td${x.atras ? ' style="color:var(--danger);font-weight:600"' : ""}>${x.atras}</td><td>${x.emb}</td>
            <td><button class="btn btn-p" data-acao="verCarteira" data-sigla="${esc(x.u.sigla)}"${x.total ? "" : " disabled"}>Ver leads</button></td></tr>`).join("")}</tbody></table></div>
      </section>`;
  }
  function janelaCarteiraEquipe(sigla) {
    const u = (E.equipeComercial || []).find(x => x.sigla === sigla) || {};
    const ls = (E.leadsEquipe || []).filter(l => l.sigla === sigla).sort((a, b) => (parado(b) - parado(a)) || String(a.status).localeCompare(String(b.status)));
    abrir(`
      <div class="janela-topo"><div><h2>${esc(u.exec_nome || u.nome || sigla)}</h2><p>${ls.length} leads · só consulta</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo"><div class="tabela-wrap"><table><thead><tr><th>Empresa</th><th>Status</th><th>Último contato</th><th>Próximo contato</th></tr></thead><tbody>
        ${ls.map(l => `<tr><td><b>${esc(l.empresa)}</b><div class="sec">${esc([l.segmento, l.cidade_uf].filter(Boolean).join(" · "))}</div></td><td>${chipStatus(l.status)}${parado(l) ? `<div class="sec" style="color:var(--danger)">Parado</div>` : ""}</td>
          <td>${l.ultima_tentativa ? data(l.ultima_tentativa) + `<div class="sec">${tentativasDe(l)} tentativa${tentativasDe(l) === 1 ? "" : "s"}</div>` : "–"}</td><td>${l.retorno ? `<span${l.retorno < hojeISO() ? ' style="color:var(--danger);font-weight:600"' : ""}>${data(l.retorno)}</span>` : "–"}</td></tr>`).join("")}
      </tbody></table></div></div>
      <div class="janela-rodape"><button class="btn btn-primario" data-fechar>Fechar</button></div>`, () => rotularTabelasEm($janela));
  }

  function janelaConvidar(sigla, pre) {
    pre = pre || {};
    const dominios = cfg.dominiosPermitidos || ["voeazul.com.br", "azulcargo.com.br"];
    const eq = (E.equipe || {})[sigla] || { pessoas: [], convites: [] };
    abrir(`
      <div class="janela-topo"><div><h2>Convidar pessoa para a unidade ${esc(rotulo(sigla))}</h2><p>O portal cria um link para você mandar pelo WhatsApp.</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="cv-nome">Nome completo</label><input id="cv-nome" type="text" maxlength="120" autocomplete="off" value="${esc(pre.nome || "")}"></div>
        <div class="campo"><label for="cv-email">E-mail Azul da pessoa</label><input id="cv-email" type="email" autocomplete="off" value="${esc(pre.email || sigla.toLowerCase() + ".")}" placeholder="${esc(sigla.toLowerCase())}.nome@${esc(dominios[0])}">
          <span class="dica">Começa com a sigla da unidade: <b>${esc(sigla.toLowerCase())}</b>.nome@${esc(dominios[0])}</span></div>
        <div class="campo"><label for="cv-cel">Celular com DDD</label><input id="cv-cel" type="tel" inputmode="tel" value="${esc(pre.cel ? foneBonito(pre.cel) : "")}" placeholder="(11) 91234-5678"><span class="dica">É para onde vai o link pelo WhatsApp.</span></div>
        <div class="erro-form" id="cv-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="cv-ok">Criar convite</button></div>`,
    (j) => {
      const em = j.querySelector("#cv-email");
      if (!pre.nome) setTimeout(() => j.querySelector("#cv-nome").focus(), 0);
      j.querySelector("#cv-ok").addEventListener("click", async (ev) => {
        const erro = j.querySelector("#cv-erro"), mostrar = (m) => { erro.textContent = m; erro.hidden = false; };
        const nome = j.querySelector("#cv-nome").value.trim(), email = em.value.trim().toLowerCase(), cel = celularLimpo(j.querySelector("#cv-cel").value);
        if (nome.length < 2) return mostrar("Digite o nome da pessoa.");
        if (!dominios.includes(email.split("@")[1] || "")) return mostrar(`Use o e-mail corporativo (${dominios.map(d => "@" + d).join(" ou ")}).`);
        if (API.siglaDoEmail(email) !== sigla || email.split("@")[0].length <= sigla.length + 1) return mostrar(`O e-mail precisa ser ${sigla.toLowerCase()}.nome@${email.split("@")[1] || dominios[0]}.`);
        if (!cel) return mostrar("Digite o celular com DDD, por exemplo (11) 91234-5678.");
        if (eq.pessoas.some(p => p.email === email && p.situacao === "aprovado")) return mostrar("Essa pessoa já está na equipe da unidade.");
        if (eq.convites.some(c => !c.usado && c.email === email && !conviteVencido(c) && c.id !== pre.trocar)) return mostrar("Já tem um convite aberto para esse e-mail. Use “Reenviar no WhatsApp” na lista.");
        const bt = ev.currentTarget;
        if (!(await confirmar({ titulo: `Convidar ${nome}?`, texto: `${esc(email)} · ${esc(foneBonito(cel))}. A pessoa entra liberada na unidade ${esc(sigla)} assim que criar a senha.`, botao: "Criar convite" }))) return;
        try {
          const codigo = await ocupado(bt, async () => { const id = await API.convidar({ sigla, email, nome, celular: cel }); if (pre.trocar) await API.cancelarConvite(pre.trocar).catch(() => {}); return id; });
          await recarregar();
          janelaConviteCriado({ id: codigo, sigla, email, nome, celular: cel, criado_em: new Date().toISOString() });
        } catch (e) { mostrar(API.traduzir(e)); }
      });
    });
  }

  function janelaConviteCriado(c) {
    const link = linkConvite(c.id), wa = zap(c.celular, msgConvite(c));
    abrir(`
      <div class="janela-corpo" style="text-align:center;padding-top:28px">
        <div class="ok-grande">✓</div>
        <h2 style="margin:0 0 6px;font-size:21px">Convite criado</h2>
        <p class="sub" style="margin:0 0 16px">Agora mande o link para <b class="forte">${esc(c.nome)}</b>. Ele vale até ${esc(validoAte(c))}.</p>
        <div class="campo" style="text-align:left"><label for="cc-link">Link do convite</label><input id="cc-link" class="link-convite" type="text" readonly value="${esc(link)}"></div>
      </div>
      <div class="janela-rodape"><button class="btn" id="cc-copiar">Copiar link</button>${wa ? `<a class="btn btn-zap" id="cc-zap" href="${esc(wa)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>` : ""}<button class="btn btn-primario" data-fechar>Pronto</button></div>`,
    (j) => {
      j.querySelector("#cc-link").addEventListener("focus", (e) => e.target.select());
      j.querySelector("#cc-copiar").addEventListener("click", async () => aviso(await copiar(msgConvite(c)) ? "Mensagem com o link copiada. É só colar no WhatsApp." : "Não deu para copiar. Selecione o link e copie.", false));
    });
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
    let ouvinte = null;
    const avisar = () => { if (ouvinte) ouvinte(); };
    chips.addEventListener("click", () => setTimeout(avisar, 0));
    lista.addEventListener("click", () => setTimeout(avisar, 0));
    return {
      adicionar(sg) { if (escolhidos.length >= 3 || escolhidos.includes(sg)) return; escolhidos.push(sg); desenharChips(); filtrar(); avisar(); },
      aoMudar(f) { ouvinte = f; }
    };
  }

  function janelaNovoPedido() {
    const opcoesU = minhasUnidades();
    const atual = unidade();
    if (!podePedir()) { aviso(soDonoBloqueia() ? `Nesta unidade, quem pede a base é ${primeiroNome(atual.dono_nome || "o dono")}. Avise quando os leads estiverem trabalhados.` : emAndamento() ? `${estaU()} já tem um pedido em andamento.` : "Tire todos os leads de Novo e Prospecção para pedir uma nova base.", true); return; }
    const escolhidos = [];
    abrir(`
      <div class="janela-topo"><div><h2>Pedir nova base de leads</h2><p>Cada pedido traz até ${MAX} leads</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="p-unid">${ehExec() ? "Carteira" : "Unidade"}</label><select id="p-unid"${opcoesU.length < 2 ? " disabled" : ""}>${opcoesU.map(u => `<option value="${esc(u.sigla)}"${u.sigla === atual.sigla ? " selected" : ""}>${esc(rotulo(u.sigla))} · ${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}</option>`).join("")}</select></div>
        <div class="campo busca-seg"><label for="p-busca">Segmentos (até 3)</label><input id="p-busca" type="text" autocomplete="off"><div class="lista-seg" id="p-lista" hidden></div><div class="chips" id="p-chips"></div>
          <div class="seg-sugeridos" id="p-sugest" hidden></div></div>
        <div class="campo"><label>Cidades de interesse (até 3, opcional)</label><div class="grade-3"><input type="text" id="p-c1" placeholder="Cidade/UF"><input type="text" id="p-c2" placeholder="Cidade/UF"><input type="text" id="p-c3" placeholder="Cidade/UF"></div></div>
        <div class="campo"><label for="p-emp">Empresas específicas (opcional)</label><textarea id="p-emp" rows="3" placeholder="Razão social, CNPJ ou CNAE, um por linha"></textarea></div>
        <div class="info-pedido">ℹ️ <span>Cada pedido traz <b>até ${MAX} leads</b>. A base chega na <b>sexta-feira</b> seguinte ao pedido, conforme a disponibilidade do time.</span></div>
        <div class="erro-form" id="p-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" id="p-enviar">Enviar pedido</button></div>`,
    (j) => {
      const seg = campoSegmentos(j, escolhidos);
      ["#p-c1", "#p-c2", "#p-c3"].forEach(x => ligarCidade(j.querySelector(x)));
      const sugerir = () => {
        const caixa = j.querySelector("#p-sugest"), u = unidade();
        const lista = segmentosSugeridos(u && u.regiao).filter(x => !escolhidos.includes(x.seg));
        if (!lista.length || escolhidos.length >= 3) { caixa.hidden = true; caixa.innerHTML = ""; return; }
        caixa.innerHTML = `<p class="sug-titulo">Mais viraram negócio na região ${esc(u.regiao)}:</p><div class="sug-lista">${lista.map(x =>
          `<button type="button" class="sug" data-sug="${esc(x.seg)}">+ ${esc(x.seg)}<small>${x.b ? `${x.b} embarque${x.b > 1 ? "s" : ""}` : `${x.n} em negociação`}</small></button>`).join("")}</div>`;
        caixa.hidden = false;
        caixa.querySelectorAll("[data-sug]").forEach(b => b.addEventListener("click", () => { seg.adicionar(b.dataset.sug); }));
      };
      seg.aoMudar(sugerir); sugerir();
      j.querySelector("#p-unid").addEventListener("change", (e) => { escolherUnidade(e.target.value); if (!podePedir()) { fechar(); desenhar(); aviso(`A unidade ${e.target.value} ainda não pode pedir uma nova base.`, true); return; } sugerir(); });
      j.querySelector("#p-enviar").addEventListener("click", async (ev) => {
        const erro = j.querySelector("#p-erro");
        const u = unidade();
        if (!escolhidos.length) { erro.textContent = "Escolha pelo menos um segmento."; erro.hidden = false; return; }
        const cidades = ["#p-c1", "#p-c2", "#p-c3"].map(x => cidadeUf(j.querySelector(x).value)).filter(Boolean);
        const empresas = j.querySelector("#p-emp").value.trim();
        const bt = ev.currentTarget;
        if (!(await confirmar({ titulo: "Enviar este pedido de leads?", texto: `Unidade ${esc(rotulo(u.sigla))} · ${esc(escolhidos.join(", "))}. Depois de enviado, um novo pedido só depois de tratar os leads desta base.`, botao: "Enviar pedido" }))) return;
        try {
          const r = await ocupado(bt, () => API.criarPedido({ sigla: u.sigla, regiao: u.regiao, cidade_uf: u.cidade_uf, segmentos: escolhidos.slice(), cidades, empresas: empresas || null,
            ...(() => { const r = responsavelRegiao(u.regiao); return r ? { responsavel: r.nome, responsavel_uid: r.uid, responsavel_cel: r.celular || null } : {}; })() }));
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
      ligarCidade(j.querySelector("#u-cidade"), j.querySelector("#u-regiao"));
      j.querySelector("#u-enviar").addEventListener("click", async (ev) => {
        const erro = j.querySelector("#u-erro");
        const sigla = j.querySelector("#u-sigla").value.trim().toUpperCase();
        const cidade = cidadeUf(j.querySelector("#u-cidade").value), regiao = j.querySelector("#u-regiao").value;
        if (!/^[A-Z0-9]{2,10}$/.test(sigla) || !cidade || !regiao) { erro.textContent = "Preencha a sigla (2 a 10 letras ou números), a cidade e a região."; erro.hidden = false; return; }
        if ((E.perfil.unidades || []).some(u => u.sigla === sigla)) { erro.textContent = "Você já tem essa unidade no seu cadastro."; erro.hidden = false; return; }
        const bt = ev.currentTarget;
        if (!(await confirmar({ titulo: `Pedir acesso à unidade ${sigla}?`, texto: `${esc(cidade)} · ${esc(regiao)}. O time de ${esc(TIME)} confere e libera.`, botao: "Pedir acesso" }))) return;
        try { await ocupado(bt, () => API.pedirUnidade({ sigla, cidade_uf: cidade, regiao })); fechar(); E.perfil = await API.meuPerfil(); desenhar(); aviso("Pedido de acesso enviado ao time."); }
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
    // Abas: Minha carteira (padrão, se a pessoa cuida de alguma região), Livres e Todas.
    if (!E.f.carteira) E.f.carteira = minhasRegioes().length ? "minha" : "todas";
    const nRegioes = minhasRegioes();
    const doFiltro = (p) => E.f.carteira === "minha" ? meuPedido(p) : E.f.carteira === "livres" ? pedidoLivre(p) : true;
    const regioesLivres = L.regioes.filter(r => !responsavelRegiao(r));
    const livresParados = E.pedidos.filter(p => pedidoLivre(p) && p.situacao === "Nova" && diasUteis(p.criada_em) >= 1);
    const conta = (fn) => E.pedidos.filter(p => fn(p) && (E.f.situacao !== "abertos" || ["Nova", "Em extração"].includes(p.situacao))).length;
    const abas = `<div class="pilulas" role="group" aria-label="Carteira">
      <button data-pilula="carteira" data-valor="minha" aria-pressed="${E.f.carteira === "minha"}">Minha carteira${nRegioes.length ? " · " + esc(listaE(nRegioes)) : ""} (${conta(meuPedido)})</button>
      <button data-pilula="carteira" data-valor="livres" aria-pressed="${E.f.carteira === "livres"}">Livres${regioesLivres.length ? " · " + esc(listaE(regioesLivres)) : ""} (${conta(pedidoLivre)})</button>
      <button data-pilula="carteira" data-valor="todas" aria-pressed="${E.f.carteira === "todas"}">Todas (${conta(() => true)})</button></div>`;
    const lista = E.pedidos.filter(p => {
      if (!doFiltro(p)) return false;
      if (E.f.situacao === "abertos" && !["Nova", "Em extração"].includes(p.situacao)) return false;
      if (E.f.situacao && E.f.situacao !== "abertos" && p.situacao !== E.f.situacao) return false;
      if (E.f.regiao && p.regiao !== E.f.regiao) return false;
      if (b && !norm([p.id, p.sigla, p.solicitante_nome, p.cidade_uf, segmentosDe(p), cidadesDe(p), p.empresas, p.responsavel].join(" ")).includes(b)) return false;
      return true;
    });
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Pedidos</h1><p>Você vê primeiro a sua carteira.${regioesLivres.length ? ` ${esc(listaE(regioesLivres))} ${regioesLivres.length > 1 ? "estão livres" : "está livre"}: quem tiver espaço puxa.` : ""}</p></div>
        <div class="acoes"><button class="btn" data-acao="carteiras">Carteiras do time</button><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      ${abas}
      ${livresParados.length ? `<div class="alerta-livre"><div><b>${livresParados.length} pedido${livresParados.length > 1 ? "s" : ""} livre${livresParados.length > 1 ? "s" : ""} esperando há mais de 1 dia útil</b>
        <span>${livresParados.slice(0, 3).map(p => `${esc(p.id)} · ${esc(p.cidade_uf || "")} · ${esc(p.regiao || "")}`).join("<br>")}</span></div>
        <button class="btn btn-primario" data-acao="puxar" data-id="${esc(livresParados[0].id)}">Puxar ${esc(livresParados[0].id)} para mim</button></div>` : ""}
      <div class="filtros">
        <div class="campo busca"><label for="f-busca">Buscar</label><input id="f-busca" type="search" data-filtro="busca" value="${esc(E.f.busca)}" placeholder="Unidade, representante, segmento, cidade ou responsável"></div>
        <div class="campo"><label for="f-sit">Situação</label><select id="f-sit" data-filtro="situacao"><option value="abertos"${E.f.situacao === "abertos" ? " selected" : ""}>Aguardando o time</option><option value=""${!E.f.situacao ? " selected" : ""}>Todas</option>${opcoes(L.situacoesPedido, E.f.situacao)}</select></div>
        <div class="campo"><label for="f-reg">Região</label><select id="f-reg" data-filtro="regiao">${opcoes(regioesVisiveis(), E.f.regiao, "Todas")}</select></div>
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
          <td>${chipSituacao(p.situacao)}${p.enviada_em ? `<div class="aviso-selo">${seloAviso(p)}</div>` : ""}</td><td>${(() => { const d = donoPedido(p);
            if (!d) return `<span class="sec">Livre</span><br><button class="btn btn-p btn-primario nao-abre" data-acao="puxar" data-id="${esc(p.id)}">Puxar para mim</button>`;
            return `<b>${esc(d.nome)}</b>${d.porRegiao ? `<div class="sec">pela região${d.substituindo ? ", cobrindo " + esc(d.substituindo) : ""}</div>` : ""}`; })()}</td><td>${contagem(p)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>` : `<div class="vazio"><h2>${E.f.carteira === "minha" ? "Nenhum pedido aguardando na sua carteira" : E.f.carteira === "livres" ? "Nenhum pedido livre" : "Nenhum pedido aguardando"}</h2><p>Quando uma unidade pedir leads, o pedido aparece aqui. Mude a aba ou a situação para ver os outros.</p></div>`}`;
  }

  // Aviso à unidade: o portal registra quando o time clicou no WhatsApp para avisar ou cobrar.
  function seloAviso(p, longo) {
    if (!p.enviada_em) return `<span class="sec">–</span>`;
    const partes = [];
    partes.push(p.avisado_em ? `<span class="etiqueta ok">Avisado ✓</span>${longo ? ` <span class="sec">em ${data(p.avisado_em)}${p.avisado_por ? " por " + esc(p.avisado_por) : ""}</span>` : ""}` : `<span class="etiqueta alerta">Sem aviso</span>`);
    if (p.cobrado_em) partes.push(`<span class="sec">${longo ? "Cobrado em " + data(p.cobrado_em) + (p.cobrado_por ? " por " + esc(p.cobrado_por) : "") : "cobrado " + (dias(p.cobrado_em) ? "há " + dias(p.cobrado_em) + " dia(s)" : "hoje")}</span>`);
    return partes.join(longo ? "<br>" : " ");
  }
  async function marcarAviso(pid, tipo, depois) {
    const quem = primeiroNome(E.perfil.nome);
    const dados = tipo === "cobrado" ? { cobrado_em: true, cobrado_por: quem } : { avisado_em: true, avisado_por: quem };
    try {
      await API.atualizarPedido(pid, dados);
      await carregar(); desenhar();
      aviso(tipo === "cobrado" ? `Cobrança de ${pid} registrada.` : `Aviso de ${pid} registrado.`);
      if (depois) depois();
    } catch (e) { aviso(API.traduzir(e), true); }
  }

  // Tarefas do dia do time: o que falta fazer, já em ordem.
  function tarefasHoje() {
    const hoje = hojeISO();
    const meu = (p) => !minhasRegioes().length || meuPedido(p) || pedidoLivre(p);
    const ps = (E.pedidos || []).filter(meu);
    const importar = ps.filter(p => ["Nova", "Em extração"].includes(p.situacao))
      .sort((a, b) => ((a.previsao && a.previsao < hoje) ? "0" : "1").concat(a.criada_em || "").localeCompare(((b.previsao && b.previsao < hoje) ? "0" : "1").concat(b.criada_em || "")));
    const semAviso = ps.filter(p => ["Enviada", "Concluída"].includes(p.situacao) && p.enviada_em && !p.avisado_em);
    const cobrar = ps.filter(p => p.situacao === "Enviada" && p.enviada_em && dias(p.enviada_em) >= 7 && E.leads.some(l => l.solicitacao_id === p.id && trava(l)) && (!p.cobrado_em || dias(p.cobrado_em) >= 7));
    const cadastros = ehAdmin() ? E.perfis.filter(p => p.situacao === "pendente") : [];
    return { importar, semAviso, cobrar, cadastros, total: importar.length + semAviso.length + cobrar.length + cadastros.length };
  }

  function telaHojeTime() {
    const t = tarefasHoje();
    const hoje = hojeISO();
    const rep = (p) => perfilDe(p.solicitante);
    const linha = (p, extra, acao) => `<li class="tarefa">
        <div class="tarefa-txt"><b>${esc(p.id)} · ${esc(rotulo(p.sigla))}</b><span class="sec">${esc([p.solicitante_nome, p.cidade_uf, p.regiao].filter(Boolean).join(" · "))}</span>${extra ? `<span class="sec">${extra}</span>` : ""}</div>
        <div class="tarefa-acoes">${acao}<button class="btn btn-p" data-pedido="${esc(p.id)}">Abrir pedido</button></div></li>`;
    const zapBtn = (p, tipo, marcar, rotuloB) => { const link = zap(rep(p).celular, mensagemPedido(p, tipo));
      return link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener" data-marcar="${marcar}" data-pid="${esc(p.id)}">${rotuloB}</a>` : `<span class="sec">Sem celular cadastrado</span>`; };
    const secao = (titulo, explica, itens, extraTopo) => `<section class="bloco tarefas"><div class="tarefas-topo"><h2>${titulo} <span class="qtd-hoje">${itens.length}</span></h2>${extraTopo || ""}</div><p class="sub">${explica}</p>${itens.length ? `<ul class="lista-tarefas">${itens.join("")}</ul>` : `<p class="tarefa-ok">✓ Nada pendente aqui.</p>`}</section>`;
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Hoje</h1><p>${t.total ? `Você tem <b>${t.total}</b> ${t.total > 1 ? "coisas" : "coisa"} para fazer, em ordem de prioridade.` : "Tudo em dia. Nenhuma pendência na sua carteira."}${minhasRegioes().length ? ` Sua carteira: ${esc(listaE(minhasRegioes()))}, mais as regiões livres.` : ""}</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      ${secao("Pedidos para importar", "Pedidos que chegaram e ainda não têm leads. Os atrasados vêm primeiro.", t.importar.map(p => {
        const atraso = p.previsao && p.previsao < hoje;
        return linha(p, `${atraso ? `<b style="color:var(--danger)">Atrasado: previsão era ${data(p.previsao)}</b>` : `Previsão: ${data(p.previsao)}`} · ${esc(segmentosDe(p))}`, `<button class="btn btn-p btn-primario" data-acao="importarDe" data-id="${esc(p.id)}">Importar leads</button>`);
      }))}
      ${secao("Leads enviados sem aviso", "A unidade ainda não foi avisada de que os leads chegaram. Ao tocar no WhatsApp, o portal marca como avisado.",
        t.semAviso.map(p => linha(p, `Enviados em ${data(p.enviada_em)}`, zapBtn(p, "enviada", "avisado", "Avisar no WhatsApp"))))}
      ${secao("Unidades para cobrar", "Leads enviados há 7 dias ou mais que continuam em Novo ou Prospecção. O portal registra a cobrança e só volta a sugerir depois de 7 dias.",
        t.cobrar.map(p => { const ab = E.leads.filter(l => l.solicitacao_id === p.id && trava(l)).length;
          return linha(p, `${ab} lead${ab > 1 ? "s" : ""} em Novo ou Prospecção · enviados há ${dias(p.enviada_em)} dias${p.cobrado_em ? ` · última cobrança há ${dias(p.cobrado_em)} dias` : ""}`, zapBtn(p, "cobrar", "cobrado", "Cobrar no WhatsApp")); }),
        t.cobrar.length > 1 ? `<button class="btn btn-primario" data-acao="cobrarSequencia">Cobrar as ${t.cobrar.length}, uma por vez</button>` : "")}
      ${ehAdmin() ? secao("Cadastros esperando aprovação", "Pessoas que pediram acesso ao portal.", t.cadastros.map(p => `<li class="tarefa"><div class="tarefa-txt"><b>${esc(p.nome)}</b><span class="sec">${esc(p.email)} · pediu há ${dias(p.criadoEm)} dia(s)</span></div><div class="tarefa-acoes"><button class="btn btn-p" data-acao="irCadastros">Ver cadastros</button></div></li>`)) : ""}`;
  }

  // Cobrar várias unidades: uma janela por vez, com o WhatsApp já pronto.
  function cobrarSequencia(fila, i) {
    const p = fila[i];
    if (!p) { fechar(); aviso("Cobranças registradas."); desenhar(); return; }
    const link = zap(perfilDe(p.solicitante).celular, mensagemPedido(p, "cobrar"));
    const ab = E.leads.filter(l => l.solicitacao_id === p.id && trava(l)).length;
    abrir(`
      <div class="janela-topo"><div><h2>Cobrar ${i + 1} de ${fila.length}: ${esc(rotulo(p.sigla))}</h2><p>${esc(p.solicitante_nome || "")} · ${ab} lead${ab > 1 ? "s" : ""} em Novo ou Prospecção</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo"><p>Toque no botão verde, envie a mensagem no WhatsApp e volte aqui para ir à próxima unidade.</p>
        <pre class="msg-previa">${esc(mensagemPedido(p, "cobrar"))}</pre>
        ${link ? `<a class="btn btn-zap" href="${esc(link)}" target="_blank" rel="noopener" id="seq-zap">Abrir o WhatsApp de ${esc(primeiroNome(p.solicitante_nome))}</a>` : `<p class="sec">Esta pessoa não tem celular cadastrado.</p>`}</div>
      <div class="janela-rodape"><button class="btn" data-fechar>Parar</button><button class="btn btn-primario" id="seq-prox">${i + 1 < fila.length ? "Próxima unidade" : "Terminar"}</button></div>`,
    (j) => {
      const z = j.querySelector("#seq-zap");
      if (z) z.addEventListener("click", () => { API.atualizarPedido(p.id, { cobrado_em: true, cobrado_por: primeiroNome(E.perfil.nome) }).catch(e => aviso(API.traduzir(e), true)); j.querySelector("#seq-prox").focus(); });
      j.querySelector("#seq-prox").addEventListener("click", async () => { await carregar(); cobrarSequencia(fila, i + 1); });
    });
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
    const marcarTipo = tipoMsg === "cobrar" ? "cobrado" : tipoMsg === "enviada" ? "avisado" : "";
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
          ${p.enviada_em ? `<dt>Aviso à unidade</dt><dd>${seloAviso(p, true)}</dd>` : ""}
        </dl>
        <div class="contatos">
          ${linkZap ? `<a class="btn btn-zap btn-p" href="${esc(linkZap)}" target="_blank" rel="noopener" id="pt-zap">${rotuloZap}</a>` : ""}
          <button class="btn btn-p btn-primario" id="pt-importar"${ls.length >= MAX ? ` disabled title="Este pedido já tem ${MAX} leads"` : ""}>${ls.length ? "Importar mais leads" : "Importar leads"}</button>
          ${p.situacao === "Nova" ? `<button class="btn btn-p" id="pt-assumir">Assumir pedido</button>` : ""}
        </div>
        <div class="grade-2">
          <div class="campo"><label for="pt-sit">Situação</label><select id="pt-sit">${opcoes(L.situacoesPedido, p.situacao)}</select></div>
          <div class="campo"><label for="pt-prev">Previsão de entrega</label><input id="pt-prev" type="date" value="${esc(p.previsao || "")}"></div>
        </div>
        <div class="campo"><label for="pt-resp">Responsável</label><select id="pt-resp">
          <option value="">${(() => { const r = responsavelRegiao(p.regiao); return r ? `Pela região (${esc(r.nome)})` : "Livre: quem puxar"; })()}</option>
          ${timeAprovado().map(x => `<option value="${esc(x.id)}"${(donoPedido(p) && !donoPedido(p).porRegiao && donoPedido(p).uid === x.id) ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}
          ${p.responsavel && !p.responsavel_uid && !timeAprovado().some(x => x.nome === p.responsavel) ? `<option value="nome:${esc(p.responsavel)}" selected>${esc(p.responsavel)}</option>` : ""}
        </select></div>
        <div class="campo"><label for="pt-obs">Observação para a unidade</label><textarea id="pt-obs" placeholder="Aparece para o representante em Meus pedidos">${esc(p.observacao_time || "")}</textarea></div>
        ${ls.length && ehAdmin() ? `<button class="btn btn-p btn-perigo" id="pt-apagar">Apagar os ${ls.length} leads deste pedido</button>` : ""}
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button><button class="btn btn-primario" id="pt-salvar">Salvar</button></div>`,
    (j) => {
      const salvar = async (dados, msg, botao, pergunta) => {
        if (!(await confirmar(pergunta))) return;
        try { await ocupado(botao, () => API.atualizarPedido(p.id, dados)); await recarregar(); aviso(msg); janelaPedidoTime(p.id); }
        catch (e) { aviso(API.traduzir(e), true); }
      };
      j.querySelector("#pt-salvar").addEventListener("click", (ev) => {
        const sit = j.querySelector("#pt-sit").value;
        const rv = j.querySelector("#pt-resp").value, quem = timeAprovado().find(x => x.id === rv);
        const resp = quem ? { responsavel: quem.nome, responsavel_uid: quem.id, responsavel_cel: quem.celular || null }
          : rv.startsWith("nome:") ? { responsavel: rv.slice(5), responsavel_uid: null, responsavel_cel: null } : { responsavel: null, responsavel_uid: null, responsavel_cel: null };
        const dados = { situacao: sit, previsao: j.querySelector("#pt-prev").value || p.previsao, ...resp, observacao_time: j.querySelector("#pt-obs").value.trim() || null };
        if (sit === "Enviada" && !p.enviada_em) dados.enviada_em = true;
        if (["Enviada", "Concluída"].includes(sit) && !ls.length) { aviso("Importe os leads antes de marcar como Enviada.", true); return; }
        if (sit === "Concluída" && ls.some(trava)) { aviso("Ainda há leads em Novo ou Prospecção. A situação muda sozinha quando a unidade atualizar todos.", true); return; }
        salvar(dados, "Pedido salvo.", ev.currentTarget, { titulo: `Salvar o pedido ${p.id}?`, texto: `Situação: ${esc(sit)}.${dados.responsavel ? ` Responsável: ${esc(dados.responsavel)}.` : ""}`, botao: "Salvar" });
      });
      const assumir = j.querySelector("#pt-assumir");
      if (assumir) assumir.addEventListener("click", (ev) => salvar({ situacao: "Em extração", ...((donoPedido(p) && !donoPedido(p).porRegiao) ? {} : euComoResponsavel()) }, "Pedido assumido.", ev.currentTarget, { titulo: `Assumir o pedido ${p.id}?`, texto: (donoPedido(p) && !donoPedido(p).porRegiao && donoPedido(p).uid !== E.perfil.id) ? `O responsável continua ${esc(donoPedido(p).nome)}, e o pedido vai para Em extração.` : "Você passa a ser o responsável e o pedido vai para Em extração.", botao: "Assumir pedido" }));
      j.querySelector("#pt-importar").addEventListener("click", () => janelaImportar(p.id));
      const ptZap = j.querySelector("#pt-zap");
      if (ptZap && marcarTipo) ptZap.addEventListener("click", () => marcarAviso(p.id, marcarTipo, () => { if ($janela.open) janelaPedidoTime(p.id); }));
      const apagar = j.querySelector("#pt-apagar");
      if (apagar) apagar.addEventListener("click", async (ev) => {
        const bt = ev.currentTarget;
        if (!(await confirmar({ titulo: `Apagar os ${ls.length} leads do pedido ${p.id}?`, texto: "Os status e o histórico preenchidos pela unidade também serão apagados. Não tem volta.", botao: "Apagar leads", perigo: true }))) return;
        try { await ocupado(bt, () => API.apagarLeadsDoPedido(p.id)); await recarregar(); aviso("Leads apagados."); janelaPedidoTime(p.id); }
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
        const bt = ev.currentTarget;
        if (!(await confirmar({ titulo: `Enviar ${prontos.length} leads para ${rotulo(p.sigla)}?`, texto: "Eles aparecem na hora para a unidade e o pedido vai para Enviada.", botao: "Enviar leads" }))) return;
        try {
          await ocupado(bt, () => API.incluirLeads(p.id, prontos, { situacao: "Enviada", ...((donoPedido(p) && !donoPedido(p).porRegiao) ? {} : euComoResponsavel()), ...(p.enviada_em ? {} : { enviada_em: true }) }));
          await recarregar();
          const atualizado = E.pedidos.find(x => x.id === p.id);
          const link = zap(perfilDe(p.solicitante).celular, mensagemPedido(atualizado, "enviada"));
          const rep = perfilDe(p.solicitante);
          abrir(`<div class="janela-topo"><div><h2>Leads enviados ✓</h2><p>${prontos.length} leads já aparecem para ${esc(rotuloLongo(p.sigla))}.</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
            <div class="janela-corpo"><p class="passo-final"><b>Último passo:</b> avise ${esc(primeiroNome(p.solicitante_nome) || "o representante")} para começar os contatos.${link ? " Ao tocar no botão, o portal marca o pedido como avisado." : ""}</p>
              ${link ? `<a class="btn btn-zap btn-grande" href="${esc(link)}" target="_blank" rel="noopener" id="imp-avisar">Avisar ${esc(primeiroNome(p.solicitante_nome))} no WhatsApp</a>` : `<p class="sec">${esc(rep.nome || "O representante")} não tem celular cadastrado. Avise por outro canal.</p>`}</div>
            <div class="janela-rodape"><button class="btn" data-fechar>${link ? "Avisar depois" : "Fechar"}</button></div>`,
          (j2) => { const z = j2.querySelector("#imp-avisar"); if (z) z.addEventListener("click", () => marcarAviso(p.id, "avisado", () => fechar())); });
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
        <div class="campo"><label for="f-reg">Região</label><select id="f-reg" data-filtro="regiao">${opcoes(regioesVisiveis(), E.f.regiao, "Todas")}</select></div>
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
      return { "Pedido": l.solicitacao_id, "Unidade": l.sigla, "Região": p.regiao || "", "Representante": p.solicitante_nome || "", "Empresa": l.empresa, "CNPJ": l.cnpj || "", "CNPJ do embarque": l.cnpj_embarque || "", "Razão social do embarque": l.razao_embarque || "",
        "Nome fantasia": l.fantasia || "", "Segmento": l.segmento || "", "Cidade/UF": l.cidade_uf || "", "Contato": l.contato || "", "Telefone": foneTxt(l.telefone), "E-mail": API.limparEmail(l.email),
        "Todos os telefones": telefonesDe(l).filter(t => !t.errado).map(t => foneTxt(t.n)).join("; "),
        "Contatos que funcionam": [...marcas(l).ok].map(c => /^\d+$/.test(c) ? foneTxt(c) : c).join("; "),
        "Contatos que não funcionam": [...marcas(l).nao].map(c => /^\d+$/.test(c) ? foneTxt(c) : c).join("; "),
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
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Cadastros</h1><p>${ehAdmin() ? "Confira se a sigla no começo do e-mail é da unidade da pessoa antes de aprovar. Para mudar senha, acesso ou excluir, use Gerenciar." : "Aqui você consulta quem tem acesso e chama a pessoa no WhatsApp. Só administradores aprovam, mudam o acesso e excluem cadastros."}</p></div>
        <div class="acoes"><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      ${ehAdmin() && donosSugeridos().length ? `<section class="bloco faixa-donos" style="margin-bottom:18px"><h2>${donosSugeridos().length} unidade${donosSugeridos().length > 1 ? "s" : ""} sem dono</h2>
        <p class="sub">O dono convida e libera os vendedores da unidade. Sugestão: o primeiro representante aprovado de cada uma.</p>
        <p class="donos-lista">${donosSugeridos().slice(0, 12).map(x => `<span><b>${esc(x.sigla)}</b> ${esc(x.nome)}</span>`).join("")}${donosSugeridos().length > 12 ? `<span>e mais ${donosSugeridos().length - 12}</span>` : ""}</p>
        <button class="btn btn-primario" data-acao="definirDonos">Definir os donos sugeridos</button></section>` : ""}
      ${extras.length && ehAdmin() ? `<section class="bloco" style="margin-bottom:18px"><h2>Pedidos de acesso a outras unidades</h2>
        <div class="tabela-wrap" style="border:0"><table><thead><tr><th>Pessoa</th><th>Unidade pedida</th><th>Unidades que já tem</th><th>Ações</th></tr></thead><tbody>
        ${extras.map(a => { const u = unidadeInfo(a.sigla); return `<tr><td><b>${esc(a.nome)}</b><div class="sec">${esc(a.email)}</div></td>
          <td><b>${esc(rotulo(a.sigla))}</b><div class="sec">${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}</div></td>
          <td>${esc(unidadesDe(a.uid).filter(x => x.situacao === "aprovado").map(x => x.sigla).join(", "))}</td>
          <td><div class="acoes"><button class="btn btn-p btn-primario" data-acao="aprovarUnidade" data-id="${esc(a.id)}">Liberar</button><button class="btn btn-p btn-perigo" data-acao="recusarUnidade" data-id="${esc(a.id)}">Recusar</button></div></td></tr>`; }).join("")}
        </tbody></table></div></section>` : ""}
      <div class="filtros">
        <div class="pilulas" role="group" aria-label="Situação do cadastro">
          ${[["pendente", "Aguardando"], ["aprovado", "Aprovados"], ["recusado", "Recusados"], ["excluido", "Inativos"]].map(([v, r]) => `<button data-pilula="cadastro" data-valor="${v}" aria-pressed="${E.f.cadastro === v}">${r} (${contar(v)})</button>`).join("")}
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
            <td><b>${esc(p.nome)}</b> <span class="etiqueta">${esc(p.cargo === "Executivo" ? nivelDe(p) : p.cargo || "Representante")}</span><div class="sec">${esc(p.email)}${p.cargo === "Executivo" && p.gestor_nome ? ` · responde a ${esc(primeiroNome(p.gestor_nome))}` : ""}</div></td>
            <td>${us.length ? us.map(a => { const u = unidadeInfo(a.sigla); const dono = u.dono_uid === p.id;
              const podeDono = ehAdmin() && !dono && !u.tipo && a.situacao === "aprovado" && p.situacao === "aprovado" && (p.papel || "representante") === "representante" && (p.cargo || "Representante") === "Representante";
              return `<div><b>${esc(u.nome || a.sigla)}</b>${a.principal ? "" : " (extra)"} ${dono ? `<span class="etiqueta dono">Dono</span> ` : ""}<span class="sec">${esc(u.cidade_uf || "")} · ${esc(u.regiao || "")}${a.situacao !== "aprovado" ? " · " + esc(a.situacao) : ""}</span>${podeDono ? ` <button class="link-mini" data-acao="tornarDono" data-id="${esc(p.id)}" data-sigla="${esc(a.sigla)}">Tornar dono</button>` : ""}</div>`; }).join("") : `<span class="sec">${p.papel === "time" || !p.siglaPrincipal ? "Time (sem unidade)" : "–"}</span>`}
              ${p.convite ? `<div class="sec">Entrou por convite do dono</div>` : ""}
              ${!siglaOk ? `<div class="sec" style="color:var(--danger)">A sigla não bate com o e-mail</div>` : ""}</td>
            <td>${esc(foneBonito(p.celular || ""))}</td>
            <td>${p.papel === "admin" ? "<b>Administrador</b><div class=\"sec\">Vê tudo e gerencia cadastros</div>" : p.papel === "time" ? "Time<div class=\"sec\">Vê e trabalha pedidos e leads</div>" : "Só as próprias unidades"}</td>
            <td>${data(p.criadoEm)}${p.situacao === "pendente" ? `<div class="sec espera-quem">${(() => { const u = unidadeInfo(p.siglaPrincipal); const d = u.dono_uid && u.dono_uid !== p.id ? perfilDe(u.dono_uid) : null;
              return `${d && d.nome ? `Aguardando o dono (${esc(primeiroNome(d.nome))}) ou o time` : "Aguardando o time"} · pediu ${dias(p.criadoEm) ? "há " + dias(p.criadoEm) + " dia(s)" : "hoje"}`; })()}</div>` : ""}${p.situacao === "excluido" ? `<div class="sec">Inativo desde ${p.excluido_em ? data(p.excluido_em) : "–"}${p.excluido_por ? " por " + esc(p.excluido_por) : ""}</div>` : ""}</td>
            <td><div class="acoes">
              ${!ehAdmin() ? (link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : `<span class="sec">–</span>`)
              : p.situacao === "excluido" ? `<button class="btn btn-p" data-acao="reativar" data-id="${esc(p.id)}">Reativar</button><button class="btn btn-p btn-perigo-leve" data-acao="excluirDeVez" data-id="${esc(p.id)}">Excluir de vez</button>` : `
              ${p.situacao !== "aprovado" ? (p.cargo === "Inside Sales"
                ? `<button class="btn btn-p btn-primario" data-acao="aprovar" data-papel="time" data-id="${esc(p.id)}">Aprovar como time</button><button class="btn btn-p" data-acao="aprovar" data-papel="admin" data-id="${esc(p.id)}">Aprovar como administrador</button>`
                : `<button class="btn btn-p btn-primario" data-acao="aprovar" data-id="${esc(p.id)}">Aprovar</button>`) : ""}
              ${p.situacao === "aprovado" && p.cargo === "Inside Sales" && (p.papel || "representante") === "representante" ? `<span class="etiqueta alerta">Falta liberar o acesso de time</span>` : ""}
              ${p.situacao === "aprovado" ? `${link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<button class="btn btn-p" data-acao="gerenciar" data-id="${esc(p.id)}">Gerenciar</button>` : `
              ${p.situacao !== "recusado" && !eu ? `<button class="btn btn-p btn-perigo" data-acao="recusar" data-id="${esc(p.id)}">Recusar</button>` : ""}
              <button class="btn btn-p" data-acao="editarPessoa" data-id="${esc(p.id)}">Editar dados</button>
              ${link ? `<a class="btn btn-p btn-zap" href="${esc(link)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
              ${!eu ? `<button class="btn btn-p btn-perigo-leve" data-acao="excluir" data-id="${esc(p.id)}">Excluir cadastro</button>` : ""}`}`}
            </div></td></tr>`;
        }).join("")}</tbody></table></div>`
      : `<div class="vazio"><h2>${E.f.cadastro === "pendente" ? "Nenhum cadastro aguardando" : E.f.cadastro === "excluido" ? "Nenhum cadastro inativo" : "Nenhum cadastro aqui"}</h2><p>${E.f.cadastro === "pendente" ? "Quando um representante criar o acesso, ele aparece aqui para aprovação." : "Mude a aba para ver os outros cadastros."}</p></div>`}`;
  }

  // ---- Equipe comercial: gerente → coordenador → executivos ----
  const NIVEIS = ["Executivo", "Coordenador", "Gerente"];
  const nivelDe = (p) => (p && p.nivel) || "Executivo";
  const execs = () => (E.perfis || []).filter(p => p.cargo === "Executivo" && p.situacao === "aprovado");
  // Cadeia de quem a pessoa responde (direto e acima), sem repetir (protege de ciclos).
  function cadeiaGestores(uid, mapa) {
    const vistos = [], m = mapa || Object.fromEntries(execs().map(p => [p.id, p]));
    let atual = m[uid];
    while (atual && atual.gestor_uid && !vistos.includes(atual.gestor_uid) && atual.gestor_uid !== uid && vistos.length < 6) { vistos.push(atual.gestor_uid); atual = m[atual.gestor_uid]; }
    return vistos;
  }
  // Quem pode ser gestor de "p": coordenadores e gerentes (gerente acima de coordenador), sem criar ciclo.
  function opcoesGestor(p, nivel) {
    const acima = nivel === "Coordenador" ? ["Gerente"] : nivel === "Gerente" ? [] : ["Coordenador", "Gerente"];
    return execs().filter(x => x.id !== p.id && acima.includes(nivelDe(x)) && !cadeiaGestores(x.id).includes(p.id));
  }
  async function salvarEquipeComercial(p, nivel, gestorUid) {
    const mapa = Object.fromEntries(execs().map(x => [x.id, { ...x }]));
    const g = gestorUid ? mapa[gestorUid] : null;
    mapa[p.id] = { ...(mapa[p.id] || p), nivel, gestor_uid: g ? g.id : null, gestor_nome: g ? g.nome : null };
    // Cada carteira de executivo guarda quem a acompanha (as regras do banco usam isso para liberar a consulta).
    const unidades = [];
    Object.values(mapa).forEach(x => {
      const sigla = x.siglaPrincipal; if (!sigla) return;
      const u = E.unidades.find(y => y.sigla === sigla); if (!u || u.tipo !== "executivo") return;
      const gestores = cadeiaGestores(x.id, mapa);
      const info = { gestores, exec_nome: x.nome, exec_nivel: nivelDe(x), exec_gestor: x.gestor_nome || null };
      if (JSON.stringify(u.gestores || []) !== JSON.stringify(gestores) || u.exec_nome !== info.exec_nome || u.exec_nivel !== info.exec_nivel || (u.exec_gestor || null) !== info.exec_gestor) unidades.push({ sigla, ...info });
    });
    await API.salvarEquipeComercial(p.id, { nivel, gestor_uid: mapa[p.id].gestor_uid, gestor_nome: mapa[p.id].gestor_nome }, unidades);
  }
  function blocoEquipeComercial(p) {
    if (p.cargo !== "Executivo") return "";
    const nivel = nivelDe(p), ops = opcoesGestor(p, nivel);
    const subordinados = execs().filter(x => cadeiaGestores(x.id).includes(p.id));
    return `<section class="equipe-comercial"><h3>Equipe comercial</h3>
      <p class="sub">Define quem acompanha a carteira de quem. Coordenador e gerente veem, só para consulta, as carteiras de quem responde a eles.</p>
      <div class="grade-2">
        <div class="campo"><label for="g-nivel">Nível</label><select id="g-nivel">${NIVEIS.map(n => `<option${n === nivel ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="campo"><label for="g-gestor">Responde a</label><select id="g-gestor"><option value="">Ninguém</option>${ops.map(x => `<option value="${esc(x.id)}"${p.gestor_uid === x.id ? " selected" : ""}>${esc(x.nome)} (${esc(nivelDe(x))})</option>`).join("")}</select></div>
      </div>
      ${subordinados.length ? `<p class="sub">Acompanha hoje: ${esc(listaE(subordinados.map(x => primeiroNome(x.nome))))}.</p>` : ""}
      <div class="erro-form" id="g-erro" hidden></div>
      <button type="button" class="btn" id="g-salvar">Salvar equipe comercial</button></section>`;
  }

  // Gerenciar um cadastro aprovado: tudo agrupado numa janela, com o que é perigoso separado no fim.
  function janelaGerenciar(id) {
    const p = perfilDe(id);
    if (!p || !p.id) return;
    const eu = p.id === E.perfil.id;
    const papel = p.papel || "representante";
    const bt = (acao, txt, cls, extra) => `<button type="button" class="btn ${cls || ""}" data-g="${acao}" data-id="${esc(p.id)}"${extra || ""}>${txt}</button>`;
    abrir(`
      <div class="janela-topo"><div><h2>Gerenciar ${esc(p.nome)}</h2><p>${esc(p.email)}${p.celular ? " · " + esc(foneBonito(p.celular)) : ""}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo gerenciar">
        <section><h3>Dados</h3><p class="sub">Nome, celular e unidades da pessoa.</p>${bt("editarPessoa", "Editar dados")}</section>
        ${blocoEquipeComercial(p)}
        ${eu ? "" : `<section><h3>Senha</h3><p class="sub">A pessoa esqueceu a senha? Gere um link para ela criar outra.</p>${bt("senha", "Senha nova")}</section>
        <section><h3>Tipo de acesso</h3><p class="sub">Hoje: <b>${esc(PAPEL[papel])}</b>. ${papel === "admin" ? "Vê tudo e gerencia cadastros." : papel === "time" ? "Vê e trabalha pedidos e leads." : "Vê só as próprias unidades."}</p>
          <div class="acoes">${["representante", "time", "admin"].filter(x => x !== papel).map(x => bt("papel", "Tornar " + PAPEL[x].toLowerCase(), "", ` data-papel="${x}"`)).join("")}</div></section>
        <section class="zona-perigo"><h3>Zona de perigo</h3><p class="sub">Bloquear tira o acesso na hora. Excluir deixa o cadastro inativo (dá para reativar).</p>
          <div class="acoes">${bt("recusar", "Bloquear acesso", "btn-perigo")}${bt("excluir", "Excluir cadastro", "btn-perigo-leve")}</div></section>`}
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button></div>`,
    (j) => {
      j.querySelectorAll("[data-g]").forEach(b => b.addEventListener("click", () => {
        const fake = { dataset: { ...b.dataset, acao: b.dataset.g } };
        fechar(); acoes[b.dataset.g](fake);
      }));
      const nv = j.querySelector("#g-nivel");
      if (nv) {
        const gs = j.querySelector("#g-gestor");
        nv.addEventListener("change", () => {
          const atual = gs.value, ops = opcoesGestor(p, nv.value);
          gs.innerHTML = `<option value="">Ninguém</option>${ops.map(x => `<option value="${esc(x.id)}"${atual === x.id ? " selected" : ""}>${esc(x.nome)} (${esc(nivelDe(x))})</option>`).join("")}`;
        });
        j.querySelector("#g-salvar").addEventListener("click", async (ev) => {
          const erro = j.querySelector("#g-erro");
          try {
            await ocupado(ev.currentTarget, () => salvarEquipeComercial(p, nv.value, gs.value));
            await carregar(); desenhar(); janelaGerenciar(id);
            const g = gs.value ? perfilDe(gs.value) : null;
            aviso(`${primeiroNome(p.nome)}: ${nv.value}${g ? ", responde a " + primeiroNome(g.nome) : ""}.`);
          } catch (e) { erro.textContent = API.traduzir(e); erro.hidden = false; }
        });
      }
    });
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
        const bt = ev.currentTarget;
        if (!(await confirmar({ titulo: "Salvar o celular novo?", texto: `${esc(foneBonito(cel))}. É por ele que o time avisa pelo WhatsApp.`, botao: "Salvar" }))) return;
        try { await ocupado(bt, () => API.mudarMeuCelular(cel)); E.perfil.celular = cel; fechar(); aviso("Celular atualizado."); if (E.perfil.situacao === "aprovado" && (ehTime() || minhasUnidades().length)) desenhar(); else telaEspera(); }
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
        const bt = ev.currentTarget;
        if (!(await confirmar({ titulo: `Salvar os dados de ${p.nome}?`, texto: [dados.nome && `Nome: ${esc(dados.nome)}`, dados.celular && `Celular: ${esc(foneBonito(dados.celular))}`].filter(Boolean).join(" · "), botao: "Salvar" }))) return;
        try { await ocupado(bt, () => API.atualizarPerfil(id, dados)); fechar(); await recarregar(); aviso("Dados atualizados."); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }

  // Carteiras do time: quem cuida de cada região. Só administrador muda; o time vê.
  function janelaCarteiras() {
    const c = E.carteiras || { regioes: {} }, pode = ehAdmin(), time = timeAprovado();
    const unid = (r) => new Set(E.unidades.filter(u => u.regiao === r).map(u => u.sigla)).size;
    const subs = substitutosDe(c);
    const op = (sel) => `<option value="">Livre: quem puxar</option>${time.map(x => `<option value="${esc(x.id)}"${sel === x.id ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}`;
    const regioesDe = (uid) => L.regioes.filter(r => ((c.regioes || {})[r] || {}).uid === uid);
    const linhaSub = (x) => { const s = subs[x.id] || {}, vencido = s.ate && s.ate < hojeISO();
      return `<tr><td><b>${esc(x.nome)}</b><div class="sec">${esc(listaE(regioesDe(x.id)) || "Sem região fixa")}</div></td>
        <td>${pode ? `<select data-sub-de="${esc(x.id)}" aria-label="Quem cobre ${esc(x.nome)}"><option value="">Ninguém</option>${time.filter(y => y.id !== x.id).map(y => `<option value="${esc(y.id)}"${!vencido && s.para && s.para.uid === y.id ? " selected" : ""}>${esc(y.nome)}</option>`).join("")}</select>`
          : esc(!vencido && s.para ? s.para.nome : "–")}</td>
        <td>${pode ? `<input type="date" data-sub-ate="${esc(x.id)}" min="${hojeISO()}" value="${esc(!vencido ? s.ate || "" : "")}" aria-label="Até quando ${esc(x.nome)} fica fora">` : esc(!vencido && s.ate ? data(s.ate) : "–")}</td></tr>`; };
    const fora = time.filter(x => substitutoAtivo(c, x.id));
    abrir(`
      <div class="janela-topo"><div><h2>Carteiras do time</h2><p>Quem cuida de cada região.${pode ? "" : " Só administradores mudam."}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="tabela-wrap"><table><thead><tr><th>Região</th><th>Unidades</th><th>Responsável</th></tr></thead><tbody>
        ${L.regioes.map(r => { const atual = (c.regioes || {})[r]; return `<tr class="${atual ? "" : "livre"}"><td><b>${esc(r)}</b></td><td>${unid(r)}</td>
          <td>${pode ? `<select data-regiao="${esc(r)}" aria-label="Responsável por ${esc(r)}">${op(atual && atual.uid)}</select>` : esc(atual ? atual.nome : "Livre: quem puxar")}</td></tr>`; }).join("")}
        </tbody></table></div>
        <fieldset class="extra" style="margin-top:14px"><legend>Férias e ausências</legend>
          <p class="sub">${pode ? "Cada pessoa pode ter o seu substituto e a sua data. Duas pessoas podem estar fora ao mesmo tempo." : fora.length ? fora.map(x => { const s = substitutoAtivo(c, x.id); return `${esc(x.nome)} está sendo coberto por ${esc(s.para.nome)}${s.ate ? " até " + data(s.ate) : ""}.`; }).join(" ") : "Ninguém em férias ou ausência."}</p>
          ${pode ? `<div class="tabela-wrap"><table class="tabela-subs"><thead><tr><th>Pessoa do time</th><th>Quem cobre</th><th>Até</th></tr></thead><tbody>${time.map(linhaSub).join("")}</tbody></table></div>
            <p class="sub">No período, os pedidos novos das regiões de quem sai vão para quem cobre. Depois voltam sozinhos.</p>` : ""}
        </fieldset>
        <p class="sub">Pedidos que já têm dono não mudam; só os novos seguem a carteira. Quando alguém novo entrar no time, aprove como Time e escolha as regiões dele aqui.</p>
        <div class="erro-form" id="s-erro" hidden></div>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>${pode ? "Cancelar" : "Fechar"}</button>${pode ? `<button class="btn btn-primario" id="s-ok">Salvar carteiras</button>` : ""}</div>`,
    (j) => {
      const ok = j.querySelector("#s-ok"); if (!ok) return;
      ok.addEventListener("click", async (ev) => {
        const bt = ev.currentTarget, erro = j.querySelector("#s-erro");
        const falha = (t) => { erro.textContent = t; erro.hidden = false; };
        const pessoa = (id) => { const x = time.find(y => y.id === id); return x ? { uid: x.id, nome: x.nome, celular: x.celular || null } : null; };
        const regioes = Object.fromEntries(L.regioes.map(r => [r, pessoa(j.querySelector(`[data-regiao="${r}"]`).value)]));
        const substitutos = {};
        for (const x of time) {
          const para = j.querySelector(`[data-sub-de="${x.id}"]`).value, ate = j.querySelector(`[data-sub-ate="${x.id}"]`).value;
          if (!para) continue;
          if (!ate) return falha(`Escolha até quando ${primeiroNome(x.nome)} fica fora.`);
          if (ate < hojeISO()) return falha(`A data de ${primeiroNome(x.nome)} já passou. Escolha hoje ou uma data futura.`);
          substitutos[x.id] = { para: pessoa(para), ate };
        }
        // Quem cobre não pode estar fora no mesmo dia.
        const cobreFora = Object.entries(substitutos).find(([, v]) => substitutos[v.para.uid]);
        if (cobreFora) return falha(`${primeiroNome(pessoa(cobreFora[0]).nome)} ficaria com ${primeiroNome(cobreFora[1].para.nome)}, que também está fora. Escolha outra pessoa para cobrir.`);
        const resumo = L.regioes.map(r => `${esc(r)}: ${esc(regioes[r] ? regioes[r].nome : "livre")}`).join(" · ");
        const resumoSub = Object.entries(substitutos).map(([de, v]) => `${esc(primeiroNome(pessoa(de).nome))} coberto por ${esc(primeiroNome(v.para.nome))} até ${data(v.ate)}`).join("; ");
        if (!(await confirmar({ titulo: "Salvar as carteiras do time?", texto: resumo + (resumoSub ? `. ${resumoSub}.` : "."), botao: "Salvar carteiras" }))) return;
        try { await ocupado(bt, () => API.salvarCarteiras({ regioes, substitutos })); fechar(); await recarregar(); aviso("Carteiras salvas."); }
        catch (e) { falha(API.traduzir(e)); }
      });
    });
  }

  // Excluir cadastro: deixar inativo (dá para reativar) ou excluir de vez (some do portal).
  function janelaExcluir(id) {
    const p = E.perfis.find(x => x.id === id);
    const us = E.acessos.filter(a => a.uid === id).map(a => rotulo(a.sigla));
    const qtd = E.pedidos.filter(x => E.acessos.some(a => a.uid === id && a.sigla === x.sigla)).length;
    abrir(`
      <div class="janela-topo"><div><h2>Excluir cadastro</h2><p>${esc(p.nome)} · ${esc(p.email)}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <p>A pessoa perde o acesso ${us.length ? "a " + esc(us.join(", ")) : "às unidades"} e não consegue mais ver nem mexer em nada. Escolha como:</p>
        <fieldset class="opcoes-excluir"><legend class="sr">Como excluir</legend>
          <label class="opcao-excluir"><input type="radio" name="x-modo" value="inativo" checked>
            <span><b>Deixar inativo</b><span class="sub">O cadastro fica na aba Inativos, com a data e quem desativou. Dá para reativar depois.</span></span></label>
          <label class="opcao-excluir"><input type="radio" name="x-modo" value="de-vez">
            <span><b>Excluir de vez</b><span class="sub">O cadastro e os acessos somem do portal e não aparecem em nenhuma aba. Não tem volta.</span></span></label>
        </fieldset>
        <p class="sub"><b>Nos dois casos continua salvo:</b> ${qtd === 1 ? "o pedido dessas unidades, com" : qtd ? `os ${qtd} pedidos dessas unidades, com` : "os pedidos,"} os leads e todo o histórico. O login no Firebase continua existindo; para bloquear de vez, exclua em Authentication.</p>
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-perigo" id="x-ok">Continuar</button></div>`,
    (j) => {
      j.querySelector("#x-ok").addEventListener("click", async (ev) => {
        const modo = j.querySelector("input[name=x-modo]:checked").value, bt = ev.currentTarget;
        if (modo === "de-vez") { fechar(); return excluirDeVez(id); }
        if (!(await confirmar({ titulo: `Deixar ${p.nome} inativo?`, texto: "A pessoa perde o acesso. O cadastro fica na aba Inativos e dá para reativar depois.", botao: "Deixar inativo", perigo: true }))) return;
        try { await ocupado(bt, () => API.excluirCadastro(id)); fechar(); await recarregar(); aviso("Cadastro inativo. Ele fica na aba Inativos; os pedidos e leads continuam salvos."); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }
  async function excluirDeVez(id) {
    const p = E.perfis.find(x => x.id === id);
    if (!(await confirmar({ titulo: `Excluir ${p.nome} de vez?`, texto: `O cadastro e os acessos de <b>${esc(p.email)}</b> somem do portal e não dá para desfazer. Os pedidos, leads e histórico continuam salvos.`, botao: "Excluir de vez", perigo: true }))) return;
    try { await API.excluirDeVez(id); await recarregar(); aviso("Cadastro excluído de vez."); }
    catch (e) { aviso(API.traduzir(e), true); }
  }

  // Senha esquecida: o e-mail de redefinição não chega na caixa da Azul. O time refaz o acesso em 2 passos:
  // 1) exclui o login no Firebase (só dá pelo console no plano gratuito); 2) o portal gera um link de senha nova e manda pelo WhatsApp.
  const consoleUsuarios = () => `https://console.firebase.google.com/project/${encodeURIComponent((cfg.firebase && cfg.firebase.projectId) || "portal-leads-azul")}/authentication/users`;
  function janelaSenha(id) {
    const p = E.perfis.find(x => x.id === id);
    const unidades = E.acessos.filter(a => a.uid === id && a.situacao === "aprovado").map(a => a.sigla);
    const principal = E.unidades.find(u => u.sigla === p.siglaPrincipal) || {};
    const porLink = (p.cargo || "Representante") === "Representante" && (p.papel || "representante") === "representante" && principal.sigla && !principal.tipo && API.siglaDoEmail(p.email) === p.siglaPrincipal;
    const outras = unidades.filter(sg => sg !== p.siglaPrincipal);
    const eraDono = E.unidades.filter(u => u.dono_uid === id).map(u => u.sigla);
    const notas = [
      outras.length ? `Ela também usava ${esc(outras.map(rotulo).join(", "))}. Depois que entrar, ela pede essas unidades de novo em Minha conta.` : "",
      eraDono.length ? `Ela era dona de ${esc(eraDono.map(rotulo).join(", "))}. Depois que entrar, clique em <b>Tornar dono</b> na linha dela.` : ""
    ].filter(Boolean);
    abrir(`
      <div class="janela-topo"><div><h2>Senha nova</h2><p>${esc(p.nome)} · ${esc(p.email)}</p></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <p style="margin-top:0">São 2 passos. No fim, ${esc(primeiroNome(p.nome))} recebe um link pelo WhatsApp e cria a senha nova sozinha. Pedidos, leads e histórico continuam salvos.</p>
        <ol class="passos-senha">
          <li><span class="n">1</span><span><b>Exclua o login antigo no Firebase.</b> O botão copia o e-mail e abre a lista de usuários. Cole na busca e clique em <b>⋮ › Excluir conta</b>.
            <span class="acao"><button class="btn btn-p" id="ps-firebase">Copiar e-mail e abrir o Firebase</button></span></span></li>
          <li><span class="n">2</span><span><b>Gere o link da senha nova.</b> ${porLink
            ? `A pessoa cria a senha e já entra liberada na unidade ${esc(rotulo(p.siglaPrincipal))}, sem aprovar de novo. O link vale ${VALIDADE_CONVITE} dias.`
            : `O cadastro antigo sai do portal. A pessoa cria o acesso de novo, com o mesmo e-mail, e você aprova em Cadastros.`}
            <span class="acao"><button class="btn btn-primario btn-p" id="ps-link">Já excluí, gerar o link</button></span></span></li>
        </ol>
        ${notas.length ? `<p class="sub" style="font-size:13px">${notas.join(" ")}</p>` : ""}
      </div>
      <div class="janela-rodape"><button class="btn" data-fechar>Fechar</button></div>`,
    (j) => {
      j.querySelector("#ps-firebase").addEventListener("click", async () => {
        const ok = await copiar(p.email);
        window.open(consoleUsuarios(), "_blank", "noopener");
        aviso(ok ? "E-mail copiado. Cole na busca do Firebase e exclua a conta." : `Não deu para copiar. Procure por ${p.email} no Firebase.`);
      });
      j.querySelector("#ps-link").addEventListener("click", async (ev) => {
        const bt = ev.currentTarget;
        if (!(await confirmar({ titulo: "Já excluiu o login no Firebase?", texto: `O cadastro antigo de <b>${esc(p.email)}</b> sai do portal e o link da senha nova é criado. Se o login ainda existir no Firebase, o link não funciona.`, botao: "Sim, gerar o link" }))) return;
        try {
          let codigo = null;
          await ocupado(bt, async () => {
            if (porLink) codigo = await API.convidar({ sigla: p.siglaPrincipal, email: p.email, nome: p.nome, celular: p.celular || null });
            await API.excluirDeVez(id);
          });
          await recarregar();
          janelaSenhaPronta(p, codigo);
        } catch (e) { aviso(API.traduzir(e), true); }
      });
    });
  }
  function janelaSenhaPronta(p, codigo) {
    const link = codigo ? linkConvite(codigo, true) : urlPortal();
    const msg = codigo
      ? `Olá, ${primeiroNome(p.nome)}! Aqui é ${primeiroNome(E.perfil.nome)}, do time de ${TIME}. Refiz o seu acesso ao ${cfg.nomeDoPortal || "Portal de Leads"}. Abra o link e crie uma senha nova (só para o portal): ${link}\n\nO link vale ${VALIDADE_CONVITE} dias e funciona só com o e-mail ${p.email}. Seus leads e pedidos continuam lá.`
      : `Olá, ${primeiroNome(p.nome)}! Aqui é ${primeiroNome(E.perfil.nome)}, do time de ${TIME}. Refiz o seu acesso ao ${cfg.nomeDoPortal || "Portal de Leads"}. Abra ${link}, clique em Criar meu acesso e use o mesmo e-mail (${p.email}) com uma senha nova. Assim que terminar, me avise que eu libero.`;
    const wa = zap(p.celular, msg);
    abrir(`
      <div class="janela-corpo" style="text-align:center;padding-top:28px">
        <div class="ok-grande">✓</div>
        <h2 style="margin:0 0 6px;font-size:21px">Acesso refeito</h2>
        <p class="sub" style="margin:0 0 16px">Agora mande o link para <b class="forte">${esc(p.nome)}</b>.${codigo ? ` Ele vale até ${esc(validoAte({ criado_em: new Date().toISOString() }))}.` : " Quando ela refizer o cadastro, aprove em Cadastros."}</p>
        <div class="campo" style="text-align:left"><label for="sp-link">${codigo ? "Link da senha nova" : "Link do portal"}</label><input id="sp-link" class="link-convite" type="text" readonly value="${esc(link)}"></div>
      </div>
      <div class="janela-rodape"><button class="btn" id="sp-copiar">Copiar mensagem</button>${wa ? `<a class="btn btn-zap" href="${esc(wa)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>` : ""}<button class="btn btn-primario" data-fechar>Pronto</button></div>`,
    (j) => {
      j.querySelector("#sp-link").addEventListener("focus", (e) => e.target.select());
      j.querySelector("#sp-copiar").addEventListener("click", async () => aviso(await copiar(msg) ? "Mensagem com o link copiada. É só colar no WhatsApp." : "Não deu para copiar. Selecione o link e copie."));
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

  // ---- Conversão por segmento ----
  // Cada lead conta para o segmento do pedido: o do próprio lead, se for um dos pedidos; se o pedido tinha um segmento só, esse.
  const NEGOCIO = ["Em negociação", "Em implantação", "Embarque iniciado", "Cliente Azul"];
  const EMBARQUE = ["Embarque iniciado", "Cliente Azul"];
  function segmentoDoLead(l) {
    const p = pedidoDe(l) || {}, segs = p.segmentos || [];
    return segs.find(sg => norm(sg) === norm(l.segmento)) || (segs.length === 1 ? segs[0] : "") || l.segmento || "Sem segmento";
  }
  // { "Sudeste": { "Confecções": { e: enviados, n: negociação ou depois, b: embarques } } }
  function resumoSegmentos(leads) {
    const r = {};
    leads.forEach(l => {
      const reg = (pedidoDe(l) || {}).regiao || "Sem região", sg = segmentoDoLead(l);
      const o = ((r[reg] = r[reg] || {})[sg] = r[reg][sg] || { e: 0, n: 0, b: 0 });
      o.e++; if (NEGOCIO.includes(l.status)) o.n++; if (EMBARQUE.includes(l.status)) o.b++;
    });
    return r;
  }
  // Sugestões do pedido: segmentos da lista oficial que mais viraram negócio na região (dados que o administrador publica).
  function segmentosSugeridos(regiao) {
    const d = ((E.segmentosRegiao || {}).regioes || {})[regiao] || {};
    return Object.entries(d).map(([seg, o]) => ({ seg, e: o.e || 0, n: o.n || 0, b: o.b || 0 }))
      .filter(x => L.segmentos.includes(x.seg) && (x.n || x.b))
      .sort((a, b) => b.b - a.b || b.n - a.n || (b.n / b.e) - (a.n / a.e)).slice(0, 5);
  }
  // Administrador: publica o resumo por região e segmento (só números, sem empresas), uma vez por sessão, se mudou.
  async function publicarSegmentos() {
    const regioes = resumoSegmentos(E.leads);
    const atual = JSON.stringify(((E.segmentosRegiao || {}).regioes) || {});
    if (JSON.stringify(regioes) === atual) return;
    try { await API.salvarSegmentos(regioes); E.segmentosRegiao = { regioes }; } catch (e) { /* só ajuda as sugestões: se falhar, tenta na próxima sessão */ }
  }
  function blocoSegmentos(leads, reg) {
    const r = resumoSegmentos(leads);
    const linhas = [];
    Object.entries(r).forEach(([regiao, segs]) => Object.entries(segs).forEach(([seg, o]) => linhas.push({ regiao, seg, ...o })));
    linhas.sort((a, b) => b.b - a.b || b.n - a.n || b.e - a.e);
    const pct = (x, t) => t ? Math.round((x / t) * 100) + "%" : "–";
    const linha = (o) => `<tr><td><b>${esc(o.seg)}</b></td>${reg ? "" : `<td>${esc(o.regiao)}</td>`}<td>${o.e}</td><td>${o.n} <span class="sec">(${pct(o.n, o.e)})</span></td><td${o.b ? ' style="color:var(--ok,#1E7A3D);font-weight:600"' : ""}>${o.b} <span class="sec">(${pct(o.b, o.e)})</span></td></tr>`;
    const cab = `<thead><tr><th>Segmento</th>${reg ? "" : "<th>Região</th>"}<th>Leads enviados</th><th>Viraram negociação</th><th>Embarques</th></tr></thead>`;
    const MOSTRA = 10;
    return `<section class="bloco" style="padding:0;overflow:hidden">
        <h2 style="padding:18px 20px 0">Conversão por segmento${reg ? " · " + esc(reg) : " e região"}</h2>
        <p class="sub" style="padding:0 20px">Quais segmentos viram negociação e embarque. Os melhores aparecem como sugestão quando a unidade pede uma base.</p>
        ${linhas.length ? `<div class="tabela-wrap" style="border:0;border-radius:0"><table>${cab}<tbody>${linhas.slice(0, MOSTRA).map(linha).join("")}</tbody></table></div>
          ${linhas.length > MOSTRA ? `<details class="mais-linhas"><summary>Ver os outros ${linhas.length - MOSTRA}</summary><div class="tabela-wrap" style="border:0;border-radius:0"><table>${cab}<tbody>${linhas.slice(MOSTRA).map(linha).join("")}</tbody></table></div></details>` : ""}`
        : `<p class="sub" style="padding:0 20px 18px;color:var(--muted)">Nenhum lead enviado ainda.</p>`}
      </section>`;
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
        <div class="acoes"><div class="campo" style="margin:0;min-width:180px"><select aria-label="Região" data-filtro="regiao">${opcoes(regioesVisiveis(), reg, "Todas as regiões")}</select></div><button class="btn" data-acao="atualizar">Atualizar</button></div></div>
      <div class="indicadores">
        <div class="indicador">${icone("pedido")}<div class="valor">${aguardando}</div><div class="rotulo">Pedidos aguardando o time</div></div>
        <div class="indicador">${icone("leads")}<div class="valor">${leads.length}</div><div class="rotulo">Leads enviados</div></div>
        <div class="indicador">${icone("retorno")}<div class="valor">${pct}%</div><div class="rotulo">Leads com retorno da unidade</div></div>
        <div class="indicador${parados ? " atencao" : ""}">${icone("alerta")}<div class="valor">${parados}</div><div class="rotulo">Leads parados em Novo ou Prospecção há mais de ${PRAZO} dias</div></div>
        <div class="indicador">${icone("fechado")}<div class="valor">${embarques}</div><div class="rotulo">Embarques iniciados</div></div>
      </div>
      <div class="paineis">
        <section class="bloco"><h2>Leads por status</h2>${barras(STATUS.map(s => [s.nome, leads.filter(l => l.status === s.nome).length, s.cor]))}</section>
        <section class="bloco"><h2>Pedidos por região</h2>${barras(regioesVisiveis().map(r => [r, E.pedidos.filter(p => p.regiao === r && (!reg || r === reg)).length]))}</section>
      </div>
      ${blocoProspeccao(leads)}
      ${blocoSegmentos(leads, reg)}
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
        const a = document.getElementById("n-senha").value;
        if (a.length < 8) return aviso("A senha precisa ter pelo menos 8 caracteres.", true);
        if (!(await confirmar({ titulo: "Trocar a sua senha?", texto: "Na próxima vez, entre com a senha nova.", botao: "Trocar senha" }))) return;
        try { await ocupado(f.querySelector("button"), () => API.trocarSenha(a)); f.reset(); aviso("Senha alterada."); }
        catch (e) { aviso(API.traduzir(e), true); }
      });
    });
    const us = p.unidades || [];
    return `
      <div class="topo"><div><p class="sobrelinha">${sobre()}</p><h1>Minha conta</h1><p>Você mesmo pode alterar o celular. Para corrigir o nome, fale com o time de ${esc(TIME)}.</p></div>
        <div class="acoes"><button class="btn" data-acao="tour">Ver o tour do portal</button></div></div>
      <div class="paineis">
        <section class="bloco"><h2>Meus dados</h2>
          <dl class="dados">
            <dt>Nome</dt><dd>${esc(p.nome)}</dd><dt>E-mail</dt><dd>${esc(p.email)}</dd><dt>Celular</dt><dd>${esc(foneBonito(p.celular || ""))} <button class="link-mini" data-acao="meuCelular">Alterar</button></dd>
            <dt>Cargo</dt><dd>${esc(p.cargo || "Representante")}</dd>
            <dt>Acesso</dt><dd>${p.papel === "admin" ? "Administrador (" + esc(TIME) + ")" : p.papel === "time" ? "Time de " + esc(TIME) : "Unidades"}</dd>
          </dl>
          ${!ehTime() ? `<h2 style="margin-top:18px">Minhas unidades</h2>
            <div class="tabela-wrap"><table><thead><tr><th>Unidade</th><th>Cidade/UF</th><th>Região</th><th>Dono</th><th>Situação</th></tr></thead><tbody>
            ${us.map(u => `<tr><td><b>${esc(rotulo(u.sigla))}</b>${u.principal ? "" : " (extra)"}</td><td>${esc(u.cidade_uf || "")}</td><td>${esc(u.regiao || "")}</td><td>${u.dono_uid === p.id ? `<span class="etiqueta dono">Você</span>` : esc(u.dono_nome || "–")}</td><td>${u.acesso === "aprovado" ? "Liberada" : u.acesso === "recusado" ? `Não liberada <button class="link-mini" data-acao="pedirDeNovo" data-sigla="${esc(u.sigla)}">Pedir de novo</button>` : "Aguardando o time"}</td></tr>`).join("")}
            </tbody></table></div>
            ${us.length < MAX_UNID ? `<button class="btn" style="margin-top:12px" data-acao="pedirUnidade">+ Pedir acesso a outra unidade</button>` : ""}` : ""}
        </section>
        <section class="bloco instalar" id="bloco-instalar"><h2>Colocar o portal na tela do celular</h2>
          <p class="sub">Fica um ícone igual ao de um aplicativo. Um toque e o portal abre, sem procurar o link.</p>
          ${instalarPrompt ? `<button class="btn btn-primario" data-acao="instalar">Colocar na tela agora</button>` : ""}
          <div class="instalar-passos">
            <div><h3>Android (Chrome)</h3><ol><li>Abra o portal no Chrome.</li><li>Toque nos <b>três pontinhos</b> no alto, à direita.</li><li>Toque em <b>Adicionar à tela inicial</b> (ou <b>Instalar app</b>).</li><li>Confirme em <b>Adicionar</b>.</li></ol></div>
            <div><h3>iPhone (Safari)</h3><ol><li>Abra o portal no Safari.</li><li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima).</li><li>Role e toque em <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>.</li></ol></div>
          </div></section>
        ${blocoAvisos()}
        <section class="bloco"><h2>Trocar senha</h2>
          <form id="f-senha">
            <div class="campo"><label for="n-senha">Nova senha</label><input id="n-senha" type="password" autocomplete="new-password" minlength="8" required><span class="dica">Mínimo de 8 caracteres. Não use a senha da sua conta Azul. Use “Mostrar” para conferir o que digitou.</span></div>
            <button class="btn btn-primario" type="submit">Trocar senha</button>
          </form></section>
      </div>`;
  }

  // ------------------------------------------------------------------
  // Tour de primeiro acesso: um roteiro curto para cada perfil
  // ------------------------------------------------------------------
  const TOUR_VERSAO = "2";
  const chaveTour = () => `portal-tour-${TOUR_VERSAO}-${E.perfil && E.perfil.id}`;
  const tourVisto = () => { try { return !!localStorage.getItem(chaveTour()); } catch (e) { return true; } };
  const marcarTourVisto = () => { try { localStorage.setItem(chaveTour(), new Date().toISOString()); } catch (e) { /* sem armazenamento */ } };
  function passosTour() {
    const nome = primeiroNome(E.perfil.nome);
    const nav = (t) => `nav [data-tela="${t}"]`;
    if (!ehTime()) {
      const dono = unidadesDono().length > 0;
      return [
        { titulo: `Olá, ${nome}! Boas-vindas ao ${cfg.nomeDoPortal || "Portal de Leads"}`, texto: `Em menos de um minuto mostramos onde fica cada coisa. Dá para rever este tour quando quiser em Minha conta.` },
        { tela: "leads", alvo: nav("leads"), titulo: "Meus leads", texto: `Aqui ficam os leads da ${suaU()}. O número amarelo mostra quantos contatos estão marcados para hoje.` },
        { tela: "leads", alvo: "section.base, .vazio [data-acao=novoPedido]", titulo: "Pedir uma base", texto: `Cada pedido traz até ${MAX} leads, com até 3 segmentos e 3 cidades. Para pedir a próxima base, tire todos os leads de Novo e Prospecção.` },
        { tela: "leads", alvo: "section.hoje", titulo: "Para hoje", texto: `Os retornos marcados para hoje aparecem aqui, com WhatsApp e ligação a um toque. Se não der hoje, use Adiar.${temEquipe((unidade() || {}).sigla) ? " Em “Meus” ficam os leads que você cuida; em “Da unidade”, os de todo mundo." : ""}` },
        { tela: "leads", alvo: ".quadro, .tabela-wrap", titulo: "Seus leads por status", texto: `${ehCelular() ? "Toque no lead" : "Clique no cartão"} para abrir a ficha com telefones, e-mails, próximo contato e histórico. Depois de cada WhatsApp, ligação ou e-mail, o portal pergunta “Como foi?”: duas respostas e pronto, tudo fica salvo.` },
        { tela: "pedidos", alvo: nav("pedidos"), titulo: "Meus pedidos", texto: `Acompanhe cada pedido: Recebido pelo time, Separando seus leads, Seus leads chegaram e Pedido fechado. Aqui também aparece quem do ${TIME} cuida da ${suaU()}, com o WhatsApp.` },
        ...(dono ? [{ tela: "equipe", alvo: nav("equipe"), titulo: "Minha equipe", texto: "Você é o dono da unidade. Convide seus vendedores por um link no WhatsApp e libere quem pedir acesso. Todos da equipe pedem e trabalham os leads." }] : []),
        { tela: "conta", alvo: nav("conta"), titulo: "Minha conta", texto: "Altere seu celular e sua senha, peça acesso a outra unidade, coloque o portal na tela do celular e reveja este tour." },
        { titulo: "Pronto!", texto: `Qualquer dúvida, chame o time de ${TIME} pelo WhatsApp em Meus pedidos. Bom trabalho!`, fim: true }
      ];
    }
    const admin = ehAdmin();
    return [
      { titulo: `Olá, ${nome}! Boas-vindas ao ${cfg.nomeDoPortal || "Portal de Leads"}`, texto: `Você entrou como ${admin ? "administrador" : "time de " + TIME}. Em menos de um minuto mostramos onde fica cada coisa.` },
      { tela: "hoje", alvo: nav("hoje"), titulo: "Hoje", texto: "Sua lista do dia, em ordem: pedidos para importar, leads enviados sem aviso e unidades para cobrar. O WhatsApp já vem com a mensagem pronta, e o portal registra que você avisou ou cobrou." },
      { tela: "pedidos", alvo: nav("pedidos"), titulo: "Pedidos", texto: "Os pedidos de base das unidades. O número mostra os pedidos novos da sua carteira e das regiões livres." },
      { tela: "pedidos", alvo: '[data-pilula="carteira"]', alvoGrupo: true, titulo: "Minha carteira, Livres e Todas", texto: "Minha carteira tem as regiões que são suas. Em Livres ficam as regiões sem responsável: quem puxar fica com o pedido. Pedido livre parado há mais de 1 dia útil ganha um aviso." },
      { tela: "pedidos", alvo: "[data-acao=carteiras]", titulo: "Carteiras do time", texto: admin ? "Escolha quem cuida de cada região e quem cobre férias e ausências." : "Veja quem cuida de cada região e quem está cobrindo férias." },
      { tela: "leads", alvo: nav("leads"), titulo: "Leads", texto: "Todos os leads enviados, com filtros por região, unidade e status. Dá para exportar para o Excel." },
      { tela: "cadastros", alvo: nav("cadastros"), titulo: "Cadastros", texto: admin ? "Aprove cadastros, libere unidades, defina o dono de cada unidade e mude o acesso das pessoas. O número mostra quantos aguardam você." : "Consulte quem tem acesso a cada unidade e fale com a pessoa pelo WhatsApp." },
      { tela: "painel", alvo: nav("painel"), titulo: "Painel", texto: "O retorno das unidades: leads com resposta, leads parados, motivos de Sem interesse e a agenda de cada unidade." },
      { tela: "conta", alvo: nav("conta"), titulo: "Minha conta", texto: "Altere seu celular e sua senha e reveja este tour." },
      { titulo: "Pronto!", texto: "As telas se atualizam sozinhas quando algo muda. Bom trabalho!", fim: true }
    ];
  }
  function iniciarTour() {
    const passos = passosTour();
    const telaInicial = E.tela;
    let i = 0;
    fecharTour(true);
    const raiz = document.createElement("div");
    raiz.className = "tour"; raiz.setAttribute("role", "dialog"); raiz.setAttribute("aria-modal", "true"); raiz.setAttribute("aria-labelledby", "tour-titulo");
    raiz.innerHTML = `<div class="tour-fundo"></div><div class="tour-luz" hidden></div><div class="tour-balao" tabindex="-1"></div>`;
    document.body.appendChild(raiz);
    const fundo = raiz.querySelector(".tour-fundo"), luz = raiz.querySelector(".tour-luz"), balao = raiz.querySelector(".tour-balao");
    const achar = (p) => {
      if (!p.alvo) return null;
      const els = [...document.querySelectorAll(p.alvo)].filter(el => el.offsetParent !== null || el.getClientRects().length);
      if (!els.length) return null;
      if (!p.alvoGrupo) return [els[0]];
      return els;
    };
    let rolou = -1;
    const irPara = (p) => { if (p.tela && E.tela !== p.tela) { E.tela = p.tela; desenhar(); } return achar(p); };
    const mostrar = () => {
      let p = passos[i], alvos = irPara(p);
      // Passo cujo alvo não existe nesta tela (ex.: unidade ainda sem leads): pula para o próximo (ou o anterior, ao voltar).
      while (p.alvo && !alvos) {
        const j = i + dir;
        if (j < 0 || j >= passos.length) break;
        i = j; p = passos[i]; alvos = irPara(p);
      }
      const ultimo = i === passos.length - 1;
      balao.innerHTML = `<p class="tour-conta">${i + 1} de ${passos.length}</p><h2 id="tour-titulo">${esc(p.titulo)}</h2><p>${esc(p.texto)}</p>
        <div class="tour-botoes">${i === 0 ? `<button type="button" class="btn" data-tour="pular">Pular o tour</button>` : `<button type="button" class="btn" data-tour="voltar">Voltar</button>`}
        <button type="button" class="btn btn-primario" data-tour="${ultimo ? "fim" : "proximo"}">${i === 0 ? "Começar" : ultimo ? "Concluir" : "Próximo"}</button></div>
        ${i > 0 && !ultimo ? `<button type="button" class="link-btn tour-sair" data-tour="pular">Sair do tour</button>` : ""}`;
      balao.querySelectorAll("[data-tour]").forEach(b => b.onclick = () => acao(b.dataset.tour));
      if (!alvos) {
        luz.hidden = true; fundo.classList.add("escuro");
        balao.className = "tour-balao centro";
        balao.style.left = ""; balao.style.top = "";
      } else {
        fundo.classList.remove("escuro");
        // no celular o menu rola de lado: traz o item para a vista
        alvos.forEach(el => { const n = el.closest("nav"); if (n && n.scrollWidth > n.clientWidth) n.scrollLeft = el.offsetLeft - n.offsetLeft - (n.clientWidth - el.offsetWidth) / 2; });
        const rs = alvos.map(el => el.getBoundingClientRect());
        const r0 = { left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)), right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom)) };
        // traz o alvo para a tela, se precisar
        if (rolou !== i && (r0.top < 70 || r0.top > window.innerHeight * .6)) { rolou = i; window.scrollBy(0, r0.top - 110); return requestAnimationFrame(mostrar); }
        const m = 6, r = { left: r0.left - m, top: r0.top - m, width: Math.min(r0.right - r0.left, window.innerWidth) + 2 * m, height: Math.min(r0.bottom - r0.top, window.innerHeight * .55) + 2 * m };
        Object.assign(luz.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" }); luz.hidden = false;
        balao.className = "tour-balao";
        const bw = Math.min(360, window.innerWidth - 32), bh = balao.offsetHeight || 200;
        let x, y;
        if (r.left + r.width + 16 + bw < window.innerWidth && r.width < window.innerWidth * .4) { x = r.left + r.width + 14; y = Math.max(16, Math.min(r.top, window.innerHeight - bh - 16)); }
        else if (r.top + r.height + 14 + bh < window.innerHeight) { x = Math.max(16, Math.min(r.left, window.innerWidth - bw - 16)); y = r.top + r.height + 14; }
        else { x = Math.max(16, Math.min(r.left, window.innerWidth - bw - 16)); y = Math.max(16, r.top - bh - 14); }
        balao.style.left = x + "px"; balao.style.top = y + "px";
      }
      balao.querySelector(`[data-tour="${ultimo ? "fim" : "proximo"}"]`).focus();
    };
    let dir = 1;
    const acao = (a) => {
      if (a === "proximo") { dir = 1; i = Math.min(i + 1, passos.length - 1); mostrar(); }
      else if (a === "voltar") { dir = -1; i = Math.max(i - 1, 0); mostrar(); }
      else { marcarTourVisto(); fecharTour(); if (E.tela !== telaInicial) { E.tela = telaInicial; desenhar(); } window.scrollTo(0, 0); if (a === "fim") aviso("Tour concluído. Para ver de novo, vá em Minha conta."); }
    };
    raiz.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); acao("pular"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); acao(i === passos.length - 1 ? "fim" : "proximo"); }
      else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); acao("voltar"); }
      else if (e.key === "Tab") { const f = [...balao.querySelectorAll("button")]; const k = f.indexOf(document.activeElement); if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    });
    raiz._ajustar = () => mostrar();
    window.addEventListener("resize", raiz._ajustar);
    window.scrollTo(0, 0);
    mostrar();
  }
  function fecharTour() {
    const t = document.querySelector(".tour");
    if (!t) return;
    window.removeEventListener("resize", t._ajustar);
    t.remove();
    if (atualizarDepois) setTimeout(atualizarSozinho, 300);
  }
  // Primeiro acesso de cada pessoa (no modo demonstração, só pelo botão em Minha conta).
  function talvezTour() { if ((!API.demo || /[?&]tour\b/.test(location.search)) && E.perfil && E.perfil.situacao === "aprovado" && !tourVisto() && window.innerWidth >= 360) setTimeout(iniciarTour, 600); }

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
      const t = $toast; if (!t.isConnected) document.body.appendChild(t);
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
