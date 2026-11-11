// =====================================================================
// Configuração do Portal de Leads
// "firebase": dados do app web do projeto no Firebase (Configurações do projeto > Seus apps).
// A apiKey do Firebase foi feita para ficar no site; a segurança dos dados está nas regras
// do Firestore (arquivo firebase/firestore.rules).
// Sem o bloco "firebase", o site abre em modo demonstração.
// =====================================================================
window.PORTAL_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCNeK3UZ_XxurVv7f6YlFYO8jMF0XUKBBM",
    authDomain: "portal-leads-azul.firebaseapp.com",
    projectId: "portal-leads-azul",
    storageBucket: "portal-leads-azul.firebasestorage.app",
    messagingSenderId: "81848107209",
    appId: "1:81848107209:web:18b940fd89017cfc1f8d18"
  },

  nomeDoPortal: "Portal de Leads",
  nomeDoTime: "Inside Sales",
  empresa: "Azul Logística",
  logoUrl: "img/logo-azul-logistica.png", // logo branco, usado no fundo azul (entrada e menu)
  dominiosPermitidos: ["voeazul.com.br", "azulcargo.com.br"], // as regras do Firestore também conferem isso
  prazoRetornoDias: 7                     // lead parado em Novo ou Prospecção há mais dias que isso fica em alerta
};
