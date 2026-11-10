// =====================================================================
// Configuração do Portal de Leads
// Depois de criar o projeto no Supabase, cole aqui o endereço do projeto
// e a chave pública (Project Settings > API Keys). A chave pública foi
// feita para ficar no site; a segurança dos dados está nas regras do banco.
// Com os dois campos vazios, o site abre em modo demonstração.
// =====================================================================
window.PORTAL_CONFIG = {
  supabaseUrl: "https://jgdwdkmqylrqboqinmxt.supabase.co",          // ex.: "https://abcdefghijk.supabase.co"
  supabaseKey: "sb_publishable_9HbMMrtPPfwfDW2LE-ud2g_vN5rlEr6",          // chave "publishable" ou "anon public"

  nomeDoPortal: "Portal de Leads",
  nomeDoTime: "Inside Sales",
  empresa: "Azul Logística",
  logoUrl: "",              // ex.: "img/logo-azul-logistica.png" (deixe vazio enquanto não houver o arquivo aprovado)
  dominiosPermitidos: ["voeazul.com.br", "azulcargo.com.br"], // o banco também confere isso
  prazoRetornoDias: 7,                    // lead sem retorno há mais dias que isso fica em alerta
  confirmacaoEmail: false                 // true só depois de ligar "Confirm email" e configurar o remetente (SMTP) no Supabase
};
