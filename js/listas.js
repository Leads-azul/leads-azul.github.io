// Listas fixas do portal. Para mudar um segmento, edite aqui (um por linha).
window.LISTAS = {
  regioes: ["Sudeste", "Sul", "Centro Oeste", "Nordeste", "Norte"],

  // Status do lead, na ordem das colunas do Kanban.
  status: [
    { nome: "Novo",             cor: "#8A94A6", final: false },
    { nome: "Tentando contato", cor: "#C9820C", final: false },
    { nome: "Em negociação",    cor: "#1A8FD6", final: false },
    { nome: "Fechou",           cor: "#1E9157", final: true  },
    { nome: "Sem interesse",    cor: "#7357C2", final: true  },
    { nome: "Contato inválido", cor: "#D14343", final: true  }
  ],

  situacoesPedido: ["Nova", "Em extração", "Enviada", "Concluída", "Sem leads", "Cancelada"],

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
