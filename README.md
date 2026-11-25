# Portal de Leads

Site para os representantes pedirem bases de leads da Leads2b e atualizarem o status de cada contato. O time de Inside Sales aprova cadastros, importa a planilha da Leads2b em cada pedido e acompanha o retorno das lojas.

- `index.html`, `css/`, `js/`, `img/`, `manifest.webmanifest`: o site (GitHub Pages); o manifesto e os ícones em `img/` deixam colocar o portal na tela do celular; `js/municipios.js` é a lista de cidades do IBGE (só baixa quando alguém digita uma cidade)
- `config.js`: configuração pública do Firebase (sem ela, o site abre em modo demonstração)
- `firebase/firestore.rules`: regras de segurança do banco (colar em Firestore › Regras e publicar)

Banco de dados e login: Firebase (projeto `portal-leads-azul`, plano Spark).
