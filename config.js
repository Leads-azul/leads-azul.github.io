// =====================================================================
// Configuração do Portal de Leads
// Depois de criar o projeto no Supabase, cole aqui o endereço do projeto
// e a chave pública (Project Settings > API Keys). A chave pública foi
// feita para ficar no site; a segurança dos dados está nas regras do banco.
// Com os dois campos vazios, o site abre em modo demonstração.
// =====================================================================
window.PORTAL_CONFIG = {
  supabaseUrl: "",          // ex.: "https://abcdefghijk.supabase.co"
  supabaseKey: "",          // chave "publishable" ou "anon public"

  nomeDoPortal: "Portal de Leads",
  nomeDoTime: "Inside Sales",
  dominiosPermitidos: ["voeazul.com.br"], // o banco também confere isso
  prazoRetornoDias: 7                     // lead sem retorno há mais dias que isso fica em alerta
};
