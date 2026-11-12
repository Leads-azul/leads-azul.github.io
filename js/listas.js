// Listas fixas do portal. Para mudar um segmento, edite aqui (um por linha).
window.LISTAS = {
  regioes: ["Sudeste", "Sul", "Centro Oeste", "Nordeste", "Norte"],

  // Status do lead, na ordem da prospecção (é a ordem das colunas do Kanban).
  // trava: true = enquanto houver lead neste status, a unidade não pode pedir uma nova base.
  status: [
    { nome: "Novo",              cor: "#8A94A6", trava: true,  desc: "Lead recebido, ainda sem nenhum contato." },
    { nome: "Prospecção",        cor: "#C9820C", trava: true,  desc: "Tentando falar com a empresa por ligação, WhatsApp ou e-mail." },
    { nome: "Em negociação",     cor: "#1A8FD6", trava: false, desc: "Conversa em andamento, com proposta ou cotação em análise." },
    { nome: "Em implantação",    cor: "#0E9AA7", trava: false, desc: "Cliente aceitou a proposta e está em cadastro e ajustes antes do primeiro envio." },
    { nome: "Embarque iniciado", cor: "#1E9157", trava: false, desc: "Cliente já fez o primeiro embarque." },
    { nome: "Cliente Azul",      cor: "#12306F", trava: false, desc: "A empresa já embarca com a Azul. Registre os detalhes na observação." },
    { nome: "Sem interesse",     cor: "#7357C2", trava: false, desc: "A empresa não quer o serviço agora." },
    { nome: "Contato inválido",  cor: "#D14343", trava: false, desc: "Telefone ou e-mail não existem ou não são da empresa." }
  ].map(s => ({ ...s, final: !s.trava })),

  situacoesPedido: ["Nova", "Em extração", "Enviada", "Concluída", "Sem leads", "Cancelada"],

  // Quem se cadastra. "Inside Sales" não tem unidade.
  cargos: ["Representante", "Executivo", "Inside Sales"],

  // Máximo de leads por pedido e limite de unidades por representante.
  leadsPorPedido: 10,
  unidadesPorPessoa: 5,

  // Mensagens prontas. Variáveis: {contato} {empresa} {nome} {sigla} {cidade} {celular}
  mensagens: {
    whatsapp: "Olá{contato}, tudo bem? Aqui é {nome}, da Azul Logística (unidade {sigla}, {cidade}).\nTrabalhamos com envios para todo o Brasil e gostaria de apresentar uma proposta para a {empresa}.\nPodemos conversar rapidamente sobre o volume de envios de vocês?",
    emailAssunto: "Azul Logística: proposta de envios para {empresa}",
    email: "Olá{contato}, tudo bem?\n\nAqui é {nome}, da Azul Logística (unidade {sigla}, {cidade}).\nTrabalhamos com envios para todo o Brasil e gostaria de apresentar uma proposta para a {empresa}.\n\nPosso te ligar para entender o volume de envios de vocês?\n\nAbraço,\n{nome}\nAzul Logística · {celular}",
    // Retomada: usada a partir da 2ª tentativa, quando a empresa ainda não respondeu.
    whatsappRetomada: "Oi{contato}! Aqui é {nome}, da Azul Logística em {cidade}.\nTe mandei uma mensagem há alguns dias sobre os envios da {empresa}.\nConsegue me dizer um bom horário para uma conversa rápida, de 5 minutos?",
    emailRetomadaAssunto: "Retomando: envios da {empresa} com a Azul Logística",
    emailRetomada: "Olá{contato}, tudo bem?\n\nTe escrevi há alguns dias sobre os envios da {empresa}.\nSe fizer sentido, me diga um bom horário para uma conversa rápida, de 5 minutos, ou com quem devo falar sobre os envios da empresa.\n\nAbraço,\n{nome}\nAzul Logística, unidade {sigla} · {celular}"
  },

  // Depois de quantas tentativas sem avanço o portal pede uma decisão sobre o lead.
  tentativasParaDecidir: 3,

  // Motivos ao marcar "Sem interesse". "Outro motivo" abre um campo para escrever.
  motivosPerda: ["Já usa outra transportadora", "Achou o preço alto", "Não faz envios", "Sem volume agora", "Decisor não atende", "Outro motivo"],

  // Status em que aparecem os dados de qualificação (volume, destinos, transportadora atual).
  statusQualificacao: ["Em negociação", "Em implantação", "Embarque iniciado", "Cliente Azul"],

  // Dicas de abordagem que aparecem na ficha do lead.
  dicas: [
    ["“Já tenho transportadora.”", "Ótimo, então vocês já enviam. Pergunte para onde mais enviam e se algum destino sofre com prazo ou custo. Ofereça uma cotação só desse trecho, sem compromisso."],
    ["“Manda por e-mail.”", "Envie, mas combine o retorno: “Te mando agora e te ligo quinta às 10h para tirar dúvidas, pode ser?”. Marque o próximo contato no portal."],
    ["“Está caro.”", "Pergunte com o que está comparando e qual o volume. Preço muda com volume e frequência: anote esses dados e peça apoio ao time."],
    ["“Não é comigo.”", "Peça o nome e o melhor horário de quem cuida dos envios ou das compras. Anote no lembrete do próximo contato."],
    ["“Agora não é um bom momento.”", "Pergunte quando aumenta a demanda (datas sazonais, lançamentos) e marque Sem interesse com “Sem volume agora” e “Tentar de novo” na data certa."]
  ],

  segmentos: `Abatedouros
Academias
Açougues e peixarias
Administração pública
Aeroportos
Agência de publicidade
Agências de Recursos Humanos
Agências de Turismo
Agricultura
Água e esgoto
Associações em geral
Atividades artísticas
Atividades auxiliares dos transportes
Atividades de comunicação e informação
Atividades esportivas
Bancos e serviços financeiros
Bares
Bibliotecas e museus
Cartórios
Casas lotéricas
Clínicas médicas e odontológicas
Comércio atacadista agrícola
Comércio atacadista de alimentos e bebidas
Comércio atacadista de lubrificantes
Comércio atacadista de madeira, ferragens e ferramentas
Comércio atacadista em geral
Comércio de autopeças
Comércio de calçados
Comércio de instrumentos musicais
Comércio de roupas
Comércio e reparação de veículos
Comércio varejista de cosméticos
Comércio varejista de lubrificantes
Comércio varejista em geral
Comércio varejista de materiais de construção
Condomínios
Confecções
Construção em geral
Construção pesada
Construtoras e incorporadoras
Consultorias
Contabilidade
Correios e outras atividades de entrega
Corretores de seguro e planos de saúde
Design de interiores
Educação infantil
Educação superior
Eletricidade e gás
Ensino de idiomas
Ensino médio
Ensino técnico
Estacionamento de veículos
Farmácias
Fotógrafos
Franquias e Leasing
Hospitais
Hotéis, motéis e pousadas
Igrejas
Imobiliárias
Indústria automotiva
Indústria de alimentos
Indústria de bebidas
Indústria de borracha e plástico
Indústria de calçados
Indústria de eletrônicos e informática
Indústria de fumo
Indústria de máquinas e equipamentos
Indústria de materiais elétricos
Indústria de minerais não metálicos
Indústria de móveis
Indústria de papel e celulose
Indústria de petróleo e biocombustíveis
Indústria de produtos diversos
Indústria farmacêutica
Indústria gráfica
Indústria madeireira
Indústria metalúrgica
Indústria química
Indústria têxtil
Indústrias extrativas
Joalherias
Jogos de azar
Laboratórios clínicos
Lavanderias
Locação de veículos
Locações em geral
Manutenção de máquinas e equipamentos
Minimercados, mercearias e armazéns
Oficina mecânica
Organismos internacionais
Organização de eventos
Óticas
Outras atividades de ensino
Outros atendimentos à saúde
Outros serviços
Outros tipos de transporte
Padarias e panificadoras
Pecuária
Pet Shop
Piscicultura
Planos de saúde
Portos
Postos de combustível
Publicidade
Representantes comerciais
Reprodução audiovisual
Restaurantes e lanchonetes
Salão de beleza
Seguradoras
Serviços funerários
Serviço de call center
Serviços advocatícios
Serviços de apoio administrativo
Serviços de arquitetura
Serviços de cobrança
Serviços de engenharia
Serviços de fisioterapia e nutrição
Serviços de manutenção de informática e eletrônicos
Serviços de paisagismo
Serviços de pesquisas e testes
Serviços de psicologia
Serviços de reparação em geral
Serviços de saúde
Serviços de segurança
Serviços de zeladoria e manutenção
Serviços em geral
Serviços para construção
Serviços veterinários
Sindicatos
Supermercados
Tecnologia da informação
Telecomunicações
Telefonia
Transportadoras
Transporte aéreo
Transporte aquaviário
Transporte escolar
Transporte ferroviário
Transporte rodoviário de passageiros`.split("\n")
};
