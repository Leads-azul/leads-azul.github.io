// =====================================================================
// Robô dos avisos no celular do Portal de Leads (roda no GitHub Actions a cada 15 minutos).
//
// O que ele avisa:
//   Unidade (representantes):  "Seus leads chegaram" (pedido enviado pelo time)
//                              "Seu acesso foi liberado" (cadastro aprovado)
//                              Resumo das 8h, dias úteis: contatos atrasados e para hoje
//   Time de Inside Sales:      "Novo pedido de leads" (para quem cuida da região; região livre = todo o time)
//                              Resumo das 8h, dias úteis: pedidos esperando leads (e cadastros, para o administrador)
//   Administradores:           "Novo cadastro para aprovar" e "Pedido de acesso a outra unidade"
//                              (o dono da unidade também recebe quando é alguém da unidade dele)
//
// Como ele lembra o que já avisou: documento robo_avisos/estado (só o robô lê e grava; as regras fecham para o site).
// Na primeira vez que roda, ele só anota o que já existe e não manda nada (para ninguém receber avisos antigos).
//
// Os registros do GitHub (logs) podem ser públicos: o robô só escreve números, nunca nomes, e-mails ou endereços.
// =====================================================================
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export const SITE = "https://leads-azul.github.io/";
const ICONE = SITE + "img/icone-192.png";
const JANELA_DIAS = 3;          // olha pedidos criados/enviados nos últimos 3 dias
const GUARDA_DIAS = 10;         // esquece o que já avisou depois de 10 dias
const RESUMO_HORA = 8;          // resumo do dia às 8h (horário de Brasília), dias úteis
const RESUMO_ATE = 11;          // se o GitHub atrasar, ainda manda até as 11h
const AGUARDANDO = ["Nova", "Em extração"];

// ---------- datas no horário de Brasília ----------
export function agoraBR(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24, util: !["Sat", "Sun"].includes(p.weekday) };
}
const ms = (v) => v && v.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : v ? new Date(v).getTime() : 0;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// ---------- quem cuida de cada região (mesma regra do site) ----------
function substitutosDe(c) {
  const lista = { ...(c.substitutos || {}) };
  const antigo = c.substituto;
  if (antigo && antigo.de && !lista[antigo.de]) lista[antigo.de] = { para: antigo.para, ate: antigo.ate };
  return lista;
}
function substitutoAtivo(c, uid, hoje) {
  const s = uid ? substitutosDe(c)[uid] : null;
  return s && s.para && s.para.uid && (!s.ate || hoje <= s.ate) ? s : null;
}
export function responsavelRegiao(c, regiao, hoje) {
  const r = ((c || {}).regioes || {})[regiao] || null;
  if (!r) return null;
  const sub = substitutoAtivo(c, r.uid, hoje);
  return sub ? sub.para : r;
}
function donoPedido(p, c, hoje) {
  if (p.responsavel_uid) return p.responsavel_uid;
  const r = responsavelRegiao(c, p.regiao, hoje);
  return r && r.uid ? r.uid : null;
}

// ---------- leads de hoje (mesma regra do site) ----------
const retornoDevido = (l, hoje) => !!l.retorno && l.retorno <= hoje;
const tentarDevido = (l, hoje) => l.status === "Sem interesse" && !!l.tentar_em && l.tentar_em <= hoje;

// =====================================================================
// decidir(): parte "pura" (sem banco e sem envio). Recebe os dados e o estado, devolve os avisos e o estado novo.
// É ela que os testes conferem.
// =====================================================================
export function decidir(d, estadoAntes, agora = new Date()) {
  const { dia: hoje, hora, util } = agoraBR(agora);
  const primeira = !estadoAntes;
  const est = primeira ? { novos: {}, enviados: {}, cadastros: {}, acessos: {}, pendentes: [], resumo: "" } : JSON.parse(JSON.stringify(estadoAntes));
  ["novos", "enviados", "cadastros", "acessos"].forEach(k => { est[k] = est[k] || {}; });
  est.pendentes = est.pendentes || [];
  const avisos = [];
  const mandar = (uids, titulo, texto, tipo) => {
    const lista = [...new Set(uids.filter(Boolean))];
    if (lista.length) avisos.push({ uids: lista, titulo, texto, tipo });
  };
  const agoraMs = agora.getTime();
  const marca = agoraMs;

  const perfil = (uid) => d.perfis.find(p => p.id === uid) || null;
  const aprovado = (uid) => { const p = perfil(uid); return !!p && p.situacao === "aprovado"; };
  const time = d.perfis.filter(p => p.situacao === "aprovado" && ["time", "admin"].includes(p.papel)).map(p => p.id);
  const admins = d.perfis.filter(p => p.situacao === "aprovado" && p.papel === "admin").map(p => p.id);
  const unidade = (sigla) => d.unidades.find(u => u.id === sigla || u.sigla === sigla) || {};
  const daUnidade = (sigla) => d.acessos.filter(a => a.sigla === sigla && a.situacao === "aprovado").map(a => a.uid).filter(aprovado);

  // 1) Pedido novo -> time (quem cuida da região; livre = todo o time)
  for (const p of d.pedidos) {
    if (ms(p.criada_em) < agoraMs - JANELA_DIAS * 86400000 || est.novos[p.id]) continue;
    est.novos[p.id] = marca;
    if (primeira || !AGUARDANDO.includes(p.situacao)) continue;
    const dono = donoPedido(p, d.carteiras, hoje);
    const quem = dono && aprovado(dono) ? [dono] : time;
    const segs = (p.segmentos || []).slice(0, 3).join(", ");
    mandar(quem.filter(u => u !== p.solicitante), "Novo pedido de leads",
      `Unidade ${p.sigla}${p.cidade_uf ? " (" + p.cidade_uf + ")" : ""} pediu ${segs || "uma base"}.`, "novo-pedido");
  }

  // 2) Pedido enviado -> todos da unidade
  for (const p of d.pedidos) {
    if (!p.enviada_em || ms(p.enviada_em) < agoraMs - JANELA_DIAS * 86400000 || est.enviados[p.id]) continue;
    est.enviados[p.id] = marca;
    if (primeira) continue;
    const n = Object.keys(p.leads || {}).length;
    mandar(daUnidade(p.sigla), "Seus leads chegaram",
      `${n ? plural(n, "lead novo", "leads novos") : "A base"} da unidade ${p.sigla} já ${n === 1 ? "está" : "estão"} no portal. Bom trabalho!`, "leads-chegaram");
  }

  // 3) Cadastro novo -> administradores (e o dono da unidade, se houver)
  const pendentesAgora = d.perfis.filter(p => p.situacao === "pendente").map(p => p.id);
  for (const uid of pendentesAgora) {
    if (est.cadastros[uid]) continue;
    est.cadastros[uid] = marca;
    if (primeira) continue;
    const p = perfil(uid), sigla = p.siglaPrincipal || "";
    const dono = sigla ? unidade(sigla).dono_uid : null;
    mandar([...admins, dono && aprovado(dono) ? dono : null].filter(u => u !== uid), "Novo cadastro para aprovar",
      `${p.cargo === "Inside Sales" ? "Alguém do time" : "Uma pessoa" + (sigla && !sigla.startsWith("EX") ? " da unidade " + sigla : "")} pediu acesso ao portal.`, "cadastro");
  }

  // 4) Cadastro que saiu de "pendente" e foi aprovado -> a própria pessoa
  if (!primeira) {
    for (const uid of est.pendentes) {
      if (pendentesAgora.includes(uid)) continue;
      if (aprovado(uid)) mandar([uid], "Seu acesso foi liberado", "Já dá para entrar no Portal de Leads e começar a usar. Bom trabalho!", "acesso-liberado");
    }
  }
  est.pendentes = pendentesAgora;

  // 5) Pedido de acesso a outra unidade (não é o cadastro) -> administradores e dono da unidade
  for (const a of d.acessos) {
    if (a.situacao !== "pendente" || a.principal || est.acessos[a.id]) continue;
    est.acessos[a.id] = marca;
    if (primeira || !aprovado(a.uid)) continue;
    const dono = unidade(a.sigla).dono_uid;
    mandar([...admins, dono && aprovado(dono) ? dono : null].filter(u => u !== a.uid), "Pedido de acesso a uma unidade",
      `Alguém pediu acesso à unidade ${a.sigla}. Confira em ${dono ? "Minha equipe ou " : ""}Cadastros.`, "acesso-unidade");
  }

  // 6) Resumo do dia (8h, dias úteis), só para quem ativou os avisos e só se houver algo
  if (primeira) est.resumo = hoje;
  else if (util && hora >= RESUMO_HORA && hora < RESUMO_ATE && est.resumo !== hoje) {
    est.resumo = hoje;
    for (const uid of d.comAvisos) {
      const p = perfil(uid);
      if (!p || p.situacao !== "aprovado") continue;
      if (["time", "admin"].includes(p.papel)) {
        const esperando = d.pedidos.filter(x => AGUARDANDO.includes(x.situacao) && (() => { const dn = donoPedido(x, d.carteiras, hoje); return !dn || dn === uid; })()).length;
        const cads = p.papel === "admin" ? pendentesAgora.length : 0;
        const partes = [esperando && plural(esperando, "pedido esperando leads", "pedidos esperando leads"), cads && plural(cads, "cadastro para aprovar", "cadastros para aprovar")].filter(Boolean);
        if (partes.length) mandar([uid], "Bom dia! Seu resumo de hoje", partes.join(" e ") + ".", "resumo");
      } else {
        const siglas = d.acessos.filter(a => a.uid === uid && a.situacao === "aprovado").map(a => a.sigla);
        let atrasados = 0, paraHoje = 0;
        for (const x of d.pedidos) {
          if (!siglas.includes(x.sigla)) continue;
          for (const l of Object.values(x.leads || {})) {
            if (l.cuida_uid && l.cuida_uid !== uid) continue;
            if (!(retornoDevido(l, hoje) || tentarDevido(l, hoje))) continue;
            if (l.retorno && l.retorno < hoje) atrasados++; else paraHoje++;
          }
        }
        const partes = [atrasados && plural(atrasados, "contato atrasado", "contatos atrasados"), paraHoje && plural(paraHoje, "contato para hoje", "contatos para hoje")].filter(Boolean);
        if (partes.length) mandar([uid], "Bom dia! Seus contatos de hoje", `Você tem ${partes.join(" e ")}. Abra o portal para ver.`, "resumo");
      }
    }
  }

  // Esquece o que já passou da guarda
  const limite = agoraMs - GUARDA_DIAS * 86400000;
  ["novos", "enviados", "cadastros", "acessos"].forEach(k => { for (const id of Object.keys(est[k])) if (est[k][id] < limite) delete est[k][id]; });
  return { avisos, estado: est, primeira };
}

// =====================================================================
// Parte com banco e envio
// =====================================================================
async function carregar(db, agora) {
  const desde = Timestamp.fromMillis(agora.getTime() - JANELA_DIAS * 86400000);
  const [estadoDoc, recentes, enviados, aguardando, perfis, acessosPend, carteiras, avisosDocs] = await Promise.all([
    db.doc("robo_avisos/estado").get(),
    db.collection("pedidos").where("criada_em", ">=", desde).get(),
    db.collection("pedidos").where("enviada_em", ">=", desde).get(),
    db.collection("pedidos").where("situacao", "in", AGUARDANDO).get(),
    db.collection("perfis").get(),
    db.collection("acessos").where("situacao", "==", "pendente").get(),
    db.doc("config/carteiras").get(),
    db.collection("avisos").get()
  ]);
  const comAvisos = avisosDocs.docs.filter(x => (x.data().tokens || []).length).map(x => x.id);
  const tokens = Object.fromEntries(avisosDocs.docs.map(x => [x.id, x.data().tokens || []]));
  const pedidos = new Map();
  [recentes, enviados, aguardando].forEach(q => q.docs.forEach(x => pedidos.set(x.id, { id: x.id, ...x.data() })));
  const estado = estadoDoc.exists ? estadoDoc.data() : null;
  const { dia, hora, util } = agoraBR(agora);
  const vaiResumir = estado && util && hora >= RESUMO_HORA && hora < RESUMO_ATE && estado.resumo !== dia;
  // O resumo dos representantes precisa dos leads de todos os pedidos das unidades: só lê tudo uma vez por dia.
  if (vaiResumir) (await db.collection("pedidos").get()).docs.forEach(x => pedidos.set(x.id, { id: x.id, ...x.data() }));
  // Acessos: os pendentes sempre; os aprovados só quando precisa (pedido enviado ou resumo).
  let acessos = acessosPend.docs.map(x => ({ id: x.id, ...x.data() }));
  if (vaiResumir || enviados.size || acessosPend.size) acessos = (await db.collection("acessos").get()).docs.map(x => ({ id: x.id, ...x.data() }));
  const unidades = (await db.collection("unidades").get()).docs.map(x => ({ id: x.id, ...x.data() }));
  return {
    estado,
    dados: { pedidos: [...pedidos.values()], perfis: perfis.docs.map(x => ({ id: x.id, ...x.data() })), acessos, unidades, carteiras: carteiras.exists ? carteiras.data() : {}, comAvisos },
    tokens
  };
}

let SIMULAR = false;
export const simulados = [];
async function enviar(db, aviso, tokensDe) {
  const alvo = [];
  aviso.uids.forEach(uid => (tokensDe[uid] || []).forEach(t => alvo.push({ uid, t })));
  if (SIMULAR) { simulados.push({ ...aviso, aparelhos: alvo.length }); return { enviados: alvo.length, falhas: 0, semAparelho: aviso.uids.filter(u => !(tokensDe[u] || []).length).length }; }
  if (!alvo.length) return { enviados: 0, falhas: 0, semAparelho: aviso.uids.length };
  let enviados = 0, falhas = 0;
  const invalidos = [];
  for (let i = 0; i < alvo.length; i += 500) {
    const parte = alvo.slice(i, i + 500);
    const r = await getMessaging().sendEachForMulticast({
      tokens: parte.map(x => x.t),
      notification: { title: aviso.titulo, body: aviso.texto },
      webpush: { notification: { icon: ICONE, badge: ICONE, tag: aviso.tipo }, fcmOptions: { link: SITE } }
    });
    r.responses.forEach((x, j) => {
      if (x.success) enviados++;
      else {
        falhas++;
        const cod = x.error && x.error.code;
        if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(cod)) invalidos.push(parte[j]);
      }
    });
  }
  // Aparelho que não existe mais (desinstalou, trocou de celular): tira o endereço da lista.
  for (const x of invalidos) await db.doc("avisos/" + x.uid).update({ tokens: FieldValue.arrayRemove(x.t) }).catch(() => {});
  return { enviados, falhas, semAparelho: aviso.uids.filter(u => !(tokensDe[u] || []).length).length };
}

async function principal() {
  const emulador = !!process.env.FIRESTORE_EMULATOR_HOST; // só nos testes do Cloud Shell: banco de mentira e nenhum envio
  const chave = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!chave && !emulador) { console.log("Falta o segredo FIREBASE_SERVICE_ACCOUNT no GitHub. Nada foi feito."); process.exit(1); }
  initializeApp(emulador ? { projectId: process.env.GCLOUD_PROJECT || "demo-portal" } : { credential: cert(JSON.parse(chave)) });
  if (emulador) SIMULAR = true;
  const db = getFirestore();
  const agora = new Date();
  const { estado, dados, tokens } = await carregar(db, agora);

  // Botão "Run workflow" com teste = sim: um aviso de teste para os administradores.
  if (String(process.env.AVISO_TESTE || "").toLowerCase() === "sim") {
    const admins = dados.perfis.filter(p => p.situacao === "aprovado" && p.papel === "admin").map(p => p.id);
    const r = await enviar(db, { uids: admins, titulo: "Teste de aviso", texto: "Se este aviso chegou, os avisos do Portal de Leads estão funcionando.", tipo: "teste" }, tokens);
    console.log(`Teste: ${r.enviados} aparelho(s) avisado(s), ${r.falhas} falha(s), ${r.semAparelho} administrador(es) sem avisos ativados.`);
  }

  const { avisos, estado: novo, primeira } = decidir(dados, estado, agora);
  await db.doc("robo_avisos/estado").set({ ...novo, atualizado_em: FieldValue.serverTimestamp() });
  if (primeira) { console.log("Primeira execução: o robô anotou o que já existia e não mandou nenhum aviso."); return; }
  const soma = { avisos: avisos.length, enviados: 0, falhas: 0 };
  const porTipo = {};
  for (const a of avisos) {
    const r = await enviar(db, a, tokens);
    soma.enviados += r.enviados; soma.falhas += r.falhas;
    porTipo[a.tipo] = (porTipo[a.tipo] || 0) + r.enviados;
  }
  console.log(`Avisos decididos: ${soma.avisos}. Aparelhos avisados: ${soma.enviados}. Falhas: ${soma.falhas}. Por tipo: ${JSON.stringify(porTipo)}`);
  if (emulador) console.log("SIMULADOS " + JSON.stringify(simulados.map(x => ({ tipo: x.tipo, uids: x.uids, aparelhos: x.aparelhos }))));
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch(e => { console.log("Erro no robô: " + (e && e.code ? e.code : "") + " " + (e && e.message ? e.message.slice(0, 200) : "")); process.exit(1); });
