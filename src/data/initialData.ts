import {
  Business,
  FranchiseUnit,
  DreExpenseDef,
  DreParams,
  PaymentMethod,
  BusinessRule,
  Employee,
  UserAccount,
  User,
  ManualEntry,
  RoutineRP,
  ConciliationItem,
  ConfigItem
} from "../types";

export const initialBusinesses: Business[] = [
  { id: "biz1", name: "Rede Café Prime", brand: "Café Prime", color: "#3c63da", royalty: 0.06 },
  { id: "biz2", name: "Rede Beleza & Co", brand: "Beleza & Co", color: "#6a4ecb", royalty: 0.05 },
  { id: "biz3", name: "Rede EduKids", brand: "EduKids", color: "#118464", royalty: 0.07 }
];

export const initialFranchises: FranchiseUnit[] = [
  // Café Prime
  {
    id: "f001", businessId: "biz1", name: "Café Paulista", code: "CP-SP01", resp: "Renata Campos",
    address: "Av. Paulista, 1000 — Bela Vista, São Paulo/SP", city: "São Paulo", region: "Sudeste",
    lat: -23.5613, lng: -46.6565, faturamento: 148320, pendencias: 4, rpDone: 3, status: "green"
  },
  {
    id: "f002", businessId: "biz1", name: "Café Vila Mariana", code: "CP-SP02", resp: "Marcos Silva",
    address: "Rua Vergueiro, 2000 — Vila Mariana, São Paulo/SP", city: "São Paulo", region: "Sudeste",
    lat: -23.5896, lng: -46.6349, faturamento: 132540, pendencias: 5, rpDone: 2, status: "amber"
  },
  {
    id: "f003", businessId: "biz1", name: "Café Curitiba", code: "CP-CTB01", resp: "Paulo Mendes",
    address: "Rua XV de Novembro, 500 — Centro, Curitiba/PR", city: "Curitiba", region: "Sul",
    lat: -25.4284, lng: -49.2733, faturamento: 98000, pendencias: 1, rpDone: 4, status: "green"
  },
  // Beleza & Co
  {
    id: "f004", businessId: "biz2", name: "Beleza Copacabana", code: "BC-RJ01", resp: "Juliana Prado",
    address: "Av. Atlântica, 1700 — Copacabana, Rio de Janeiro/RJ", city: "Rio de Janeiro", region: "Sudeste",
    lat: -22.9711, lng: -43.1823, faturamento: 121000, pendencias: 3, rpDone: 3, status: "green"
  },
  {
    id: "f005", businessId: "biz2", name: "Beleza BH Centro", code: "BC-BH01", resp: "Carla Nunes",
    address: "Av. Afonso Pena, 1200 — Centro, Belo Horizonte/MG", city: "Belo Horizonte", region: "Sudeste",
    lat: -19.9245, lng: -43.9352, faturamento: 87500, pendencias: 6, rpDone: 1, status: "amber"
  },
  {
    id: "f006", businessId: "biz2", name: "Beleza Brasília", code: "BC-BSB01", resp: "Ricardo Alves",
    address: "SCS Quadra 3 — Asa Sul, Brasília/DF", city: "Brasília", region: "Centro-Oeste",
    lat: -15.7942, lng: -47.8822, faturamento: 102300, pendencias: 2, rpDone: 3, status: "green"
  },
  // EduKids
  {
    id: "f007", businessId: "biz3", name: "EduKids Moema", code: "EK-SP01", resp: "Ana Beatriz Lima",
    address: "Av. Ibirapuera, 3100 — Moema, São Paulo/SP", city: "São Paulo", region: "Sudeste",
    lat: -23.6015, lng: -46.6633, faturamento: 156800, pendencias: 2, rpDone: 5, status: "green"
  },
  {
    id: "f008", businessId: "biz3", name: "EduKids Porto Alegre", code: "EK-POA01", resp: "Felipe Costa",
    address: "Av. Borges de Medeiros, 800 — Centro, Porto Alegre/RS", city: "Porto Alegre", region: "Sul",
    lat: -30.0346, lng: -51.2177, faturamento: 91200, pendencias: 4, rpDone: 2, status: "amber"
  },
  {
    id: "f009", businessId: "biz3", name: "EduKids Salvador", code: "EK-SSA01", resp: "Mariana Souza",
    address: "Av. Sete de Setembro, 600 — Centro, Salvador/BA", city: "Salvador", region: "Nordeste",
    lat: -12.9714, lng: -38.5014, faturamento: 78400, pendencias: 1, rpDone: 4, status: "green"
  }
];

export const dreExpenseDefs: DreExpenseDef[] = [
  { id: "folha", name: "Folha + encargos", group: "pessoal", pct: 0.180, fromConciliation: false, icon: "👥" },
  { id: "vt", name: "Vale Transporte", group: "pessoal", pct: 0.012, fromConciliation: false, icon: "🚌" },
  { id: "aluguel", name: "Aluguel", group: "ocupacao", pct: 0.080, fromConciliation: false, icon: "🏢" },
  { id: "luz", name: "Energia elétrica", group: "utilidades", pct: 0.023, fromConciliation: true, icon: "⚡" },
  { id: "agua", name: "Água e esgoto", group: "utilidades", pct: 0.012, fromConciliation: true, icon: "💧" },
  { id: "internet", name: "Internet / Telefonia", group: "utilidades", pct: 0.004, fromConciliation: true, icon: "🌐" },
  { id: "marketing", name: "Marketing", group: "operacional", pct: 0.020, fromConciliation: false, icon: "📣" },
  { id: "royalties", name: "Royalties franqueadora", group: "franquia", pct: 0.060, fromConciliation: false, icon: "🤝" },
  { id: "outros", name: "Outros / Tarifas", group: "operacional", pct: 0.008, fromConciliation: true, icon: "📄" }
];

export const defaultDreParams: DreParams = {
  impostos: 0.08,
  cmv: 0.30,
  fees: 0.025,
  discount: 0.015,
  despesas: {
    folha: 0.180,
    vt: 0.012,
    aluguel: 0.080,
    luz: 0.023,
    agua: 0.012,
    internet: 0.004,
    marketing: 0.020,
    royalties: 0.060,
    outros: 0.008
  }
};

export const defaultPaymentMethods: PaymentMethod[] = [
  { id: "dinheiro", name: "Dinheiro", icon: "💵", fee: 0.000, prazoDias: 0, cutoffHour: 23, parcelas: false, bandeira: null },
  { id: "pix", name: "PIX", icon: "⚡", fee: 0.005, prazoDias: 0, cutoffHour: 23, parcelas: false, bandeira: null },
  { id: "debito", name: "Cartão de Débito", icon: "💳", fee: 0.012, prazoDias: 1, cutoffHour: 18, parcelas: false, bandeira: "Visa/Master" },
  { id: "credito", name: "Cartão de Crédito", icon: "💳", fee: 0.030, prazoDias: 30, cutoffHour: 18, parcelas: true, bandeira: "Visa/Master" },
  { id: "credito2", name: "Crédito 2-6x", icon: "🪙", fee: 0.038, prazoDias: 30, cutoffHour: 18, parcelas: true, bandeira: "Visa/Master" },
  { id: "credito12", name: "Crédito 7-12x", icon: "🪙", fee: 0.045, prazoDias: 30, cutoffHour: 18, parcelas: true, bandeira: "Visa/Master" },
  { id: "boleto", name: "Boleto Bancário", icon: "📄", fee: 0.015, prazoDias: 2, cutoffHour: 14, parcelas: false, bandeira: null },
  { id: "voucher", name: "Vale / Voucher", icon: "🎟️", fee: 0.035, prazoDias: 15, cutoffHour: 18, parcelas: false, bandeira: "Alelo/VR" }
];

export const defaultBusinessRules: BusinessRule = {
  maxDiscount: 10,
  minTicket: 20,
  advance: false
};

export const initialEmployees: Employee[] = [
  { id: "e1", nome: "Luís Matos", matricula: "0001", cargo: "Diretor Executivo", unidade: "dono", email: "luis@rede.com", vt: false, login: "dono" },
  { id: "e2", nome: "Renata Campos", matricula: "0012", cargo: "Gerente Geral", unidade: "f001", email: "renata@f001.com", vt: true, login: "renata.f001" },
  { id: "e3", nome: "Carlos Eduardo", matricula: "0018", cargo: "Consultor de Vendas", unidade: "f001", email: "carlos@f001.com", vt: true, login: "" },
  { id: "e4", nome: "Mariana Costa", matricula: "0021", cargo: "Recepcionista", unidade: "f001", email: "mariana@f001.com", vt: true, login: "" },
  { id: "e5", nome: "Marcos Silva", matricula: "0030", cargo: "Gerente", unidade: "f002", email: "marcos@f002.com", vt: true, login: "marcos.f002" },
  { id: "e6", nome: "Juliana Prado", matricula: "0044", cargo: "Gerente Franquia", unidade: "f004", email: "juliana@f004.com", vt: true, login: "juliana.f004" },
  { id: "e7", nome: "Ana Beatriz Lima", matricula: "0051", cargo: "Gestora Operacional", unidade: "f007", email: "ana@f007.com", vt: true, login: "ana.f007" }
];

export const initialUsers: UserAccount[] = [
  { id: "u1", nome: "Dono da Plataforma", email: "dono@sofiacfo.com", login: "dono", perfil: "dono", unidade: "dono", status: "ativo", last: "Agora", employeeId: "e1" },
  { id: "u2", nome: "Equipe de Suporte", email: "equipe@sofiacfo.com", login: "equipe", perfil: "equipe", unidade: "dono", status: "ativo", last: "Hoje 09:30" },
  { id: "u3", nome: "Admin Café Prime", email: "admin@cafeprime.com", login: "admin.cafe", perfil: "admin", unidade: "biz1", status: "ativo", last: "Hoje 08:15" },
  { id: "u4", nome: "Admin Beleza & Co", email: "admin@beleza.com", login: "admin.beleza", perfil: "admin", unidade: "biz2", status: "ativo", last: "Ontem 17:40" },
  { id: "u5", nome: "Admin EduKids", email: "admin@edukids.com", login: "admin.edukids", perfil: "admin", unidade: "biz3", status: "ativo", last: "Ontem 16:10" },
  { id: "u6", nome: "Renata Campos", email: "renata@f001.com", login: "renata.f001", perfil: "franqueado", unidade: "f001", status: "ativo", last: "Hoje 08:40", employeeId: "e2" },
  { id: "u7", nome: "Marcos Silva", email: "marcos@f002.com", login: "marcos.f002", perfil: "franqueado", unidade: "f002", status: "ativo", last: "Ontem 18:22", employeeId: "e5" },
  { id: "u8", nome: "Juliana Prado", email: "juliana@f004.com", login: "juliana.f004", perfil: "franqueado", unidade: "f004", status: "ativo", last: "Ontem 17:05", employeeId: "e6" },
  { id: "u9", nome: "Ana Beatriz Lima", email: "ana@f007.com", login: "ana.f007", perfil: "franqueado", unidade: "f007", status: "ativo", last: "Hoje 07:50", employeeId: "e7" }
];

export const defaultUsers: User[] = [
  { id: "u1", name: "Dono da Plataforma", username: "dono", role: "admin", email: "dono@sofiacfo.com" },
  { id: "u2", name: "Equipe de Suporte", username: "equipe", role: "team", email: "equipe@sofiacfo.com" },
  { id: "u3", name: "Admin Café Prime", username: "admin.cafe", role: "admin", tenantId: "biz1", unitName: "Rede Café Prime", email: "admin@cafeprime.com" },
  { id: "u6", name: "Renata Campos", username: "renata.f001", role: "franchisee", tenantId: "f001", unitName: "Café Paulista", email: "renata@f001.com" },
  { id: "u7", name: "Marcos Silva", username: "marcos.f002", role: "franchisee", tenantId: "f002", unitName: "Café Vila Mariana", email: "marcos@f002.com" }
];

export const initialManualEntries: ManualEntry[] = [
  {
    id: "m1",
    tenant: "f001",
    type: "entrada",
    date: new Date().toISOString().slice(0, 10),
    value: 3450.00,
    desc: "Venda corporativa — Coffee Break",
    catId: "receita",
    catName: "Receita operacional",
    pay: "pix",
    note: "Contrato mensal faturado",
    created: new Date().toISOString()
  },
  {
    id: "m2",
    tenant: "f001",
    type: "despesa",
    date: new Date().toISOString().slice(0, 10),
    value: 820.50,
    desc: "Manutenção máquina de café expresso",
    catId: "outros",
    catName: "Outros / Tarifas",
    pay: "transferencia",
    note: "Técnico autorizado",
    created: new Date().toISOString()
  }
];

export const rpCatalog: RoutineRP[] = [
  { id: "rp01", name: "Fechamento semanal de caixa", desc: "Consolida entradas e saídas da semana e gera prévia do resultado.", sched: "Seg 08:00", status: "done" },
  { id: "rp02", name: "Cálculo de VT", desc: "Calcula diárias, faltas e Uber dos colaboradores da unidade.", sched: "Sex 17:00", status: "sched" },
  { id: "rp03", name: "Conciliação automática", desc: "Cruza extrato importado com lançamentos e sugere correspondências.", sched: "Diário 07:30", status: "sched" },
  { id: "rp04", name: "Repasse da franqueadora", desc: "Calcula royalties e repasses devidos pela unidade no período.", sched: "Dia 5", status: "idle" },
  { id: "rp05", name: "Fechamento do DRE", desc: "Consolida receitas, custos e despesas do período e gera o DRE.", sched: "Dia 1", status: "idle" },
  { id: "rp06", name: "Apuração de taxas e recebíveis", desc: "Calcula taxas por meio de pagamento e agenda recebíveis (D+0/D+1/D+30).", sched: "Diário 22:00", status: "idle" }
];

export const sampleConciliation: ConciliationItem[] = [
  { date: "17/09/2026", desc: "PIX recebido — Cliente A", value: "+ R$ 3.250,00", numericValue: 3250.00, categoria: "Receita operacional", match: "Recebimento — Cliente A", status: "match", label: "Encontrado", tone: "green", previsao: "D+0" },
  { date: "17/09/2026", desc: "Boleto fornecedor — Grãos e Insumos", value: "− R$ 1.120,00", numericValue: -1120.00, categoria: "CMV / Insumos", match: "Conta a pagar — Fornecedor", status: "review", label: "Revisar", tone: "amber", previsao: "—" },
  { date: "17/09/2026", desc: "Energia elétrica — Enel Distribuição", value: "− R$ 842,30", numericValue: -842.30, categoria: "Energia elétrica", match: "Despesa recorrente — Luz", status: "match", label: "Encontrado", tone: "green", toDre: true, previsao: "—" },
  { date: "16/09/2026", desc: "Conta de água — Sabesp", value: "− R$ 312,50", numericValue: -312.50, categoria: "Água e esgoto", match: "Despesa recorrente — Água", status: "match", label: "Encontrado", tone: "green", toDre: true, previsao: "—" },
  { date: "16/09/2026", desc: "Internet Fibra Óptica — Vivo Empresas", value: "− R$ 189,90", numericValue: -189.90, categoria: "Internet / Telefonia", match: "Despesa recorrente — Internet", status: "match", label: "Encontrado", tone: "green", toDre: true, previsao: "—" },
  { date: "16/09/2026", desc: "Taxa de cartão de crédito — Adquirente", value: "− R$ 128,40", numericValue: -128.40, categoria: "Taxas de negócio", match: "Taxa cartão crédito", status: "match", label: "Encontrado", tone: "green", toDre: true, previsao: "—" },
  { date: "16/09/2026", desc: "Tarifa manutenção conta corrente", value: "− R$ 49,90", numericValue: -49.90, categoria: "Outros / Tarifas", match: "Tarifa bancária", status: "review", label: "Sem correspondência", tone: "red", toDre: true, previsao: "—" },
  { date: "15/09/2026", desc: "Transferência recebida — Evento corporativo", value: "+ R$ 4.800,00", numericValue: 4800.00, categoria: "Receita operacional", match: "Receita balcão", status: "match", label: "Encontrado", tone: "green", previsao: "D+0" }
];

export const initialConfigs: ConfigItem[] = [
  {
    key: "app_name",
    name: "Nome da Plataforma",
    value: "Sofia CFO — SaaS Financeiro para Franquias",
    type: "string",
    category: "Geral",
    description: "Nome exibido no cabeçalho e relatórios",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "tax_default",
    name: "Alíquota Padrão de Impostos (%)",
    value: "8.00",
    type: "number",
    category: "Financeiro",
    description: "Imposto sobre vendas padrão aplicado às franquias",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "cmv_default",
    name: "CMV Padrão (%)",
    value: "30.00",
    type: "number",
    category: "Financeiro",
    description: "Custo de Mercadoria Vendida padrão estimado",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "royalty_default",
    name: "Royalty Médio de Franquia (%)",
    value: "6.00",
    type: "number",
    category: "Financeiro",
    description: "Percentual sobre receita bruta pago à matriz",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "max_discount_limit",
    name: "Limite Máximo de Desconto (%)",
    value: "15.00",
    type: "number",
    category: "Regras de Negócio",
    description: "Desconto máximo permitido sem autorização da diretoria",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "bank_cutoff_hour",
    name: "Horário de Corte Bancário Padrão",
    value: "18:00",
    type: "string",
    category: "Regras de Negócio",
    description: "Vendas após este horário são liquidadas no ciclo seguinte",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "realtime_sync_enabled",
    name: "Sincronização em Tempo Real na Nuvem",
    value: "true",
    type: "boolean",
    category: "Sincronização",
    description: "Propagação instantânea de alterações para todos os aparelhos conectados",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "audit_log_retention_days",
    name: "Retenção de Logs de Auditoria (dias)",
    value: "90",
    type: "number",
    category: "Segurança",
    description: "Tempo de armazenamento do histórico de alterações administrativas",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "two_factor_auth_required",
    name: "Exigir 2FA para Administradores",
    value: "false",
    type: "boolean",
    category: "Segurança",
    description: "Obrigatoriedade de autenticação de dois fatores no painel administrativo",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "auto_conciliation_threshold",
    name: "Tolerância de Conciliação Automática (R$)",
    value: "0.05",
    type: "number",
    category: "Operação",
    description: "Diferença máxima aceita para correspondência automática de extrato",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  },
  {
    key: "system_maintenance_mode",
    name: "Modo de Manutenção",
    value: "false",
    type: "boolean",
    category: "Geral",
    description: "Bloqueia edições por franqueados mantendo apenas leitura",
    lastModified: new Date().toISOString(),
    modifiedBy: "Sistema"
  }
];
