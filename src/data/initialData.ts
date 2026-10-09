import type {
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
  ConfigItem,
  BillItem
} from "../types.ts";

export const initialBusinesses: Business[] = [
  {
    id: "lavo",
    royaltyType: "pct",
    name: "LAVO",
    royalty: 0,
    color: "#3c63da",
    brand: "LAVO",
  },
  {
    id: "mexicano",
    brand: "MEXICANISSIMO",
    color: "#3c63da",
    name: "MEXICANISSIMO",
    royaltyType: "pct",
    royalty: 0,
  },
];

export const initialFranchises: FranchiseUnit[] = [
  {
    id: "f_1791493345753",
    code: "LV-01",
    name: "Vila Olímpia",
    businessId: "lavo",
    city: "São Paulo",
    region: "Sudeste",
    address: "Rua Alvorada, 550",
    lat: -23.7761745,
    lng: -46.6757729,
    resp: "Rodrigo",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5,
  },
  {
    id: "f_1791493393092",
    code: "LV-02",
    name: "Clodomiro",
    businessId: "lavo",
    city: "SÃO PAULO",
    region: "Sudeste",
    address: "Rua Clodomiro Amazonas 980",
    lat: -23.5928422,
    lng: -46.6773993,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5,
  },
  {
    id: "f_1791493433153",
    code: "LV-03",
    name: "Brooklin",
    businessId: "lavo",
    city: "SÃO PAULO",
    region: "Sudeste",
    address: "Av santo Amaro 3252",
    lat: -23.6127394,
    lng: -46.6782742,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5,
  },
  {
    id: "f_1791493489437",
    code: "LV-04",
    name: "Morumbi",
    businessId: "lavo",
    city: "SÃO PAULO",
    region: "Sudeste",
    address: "Av Giovanni Gronchi 3577",
    lat: -23.6376932,
    lng: -46.7369104,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5,
  },
  {
    id: "f_1791493539509",
    code: "LV-05",
    name: "Santo André",
    businessId: "lavo",
    city: "SÃO PAULO",
    region: "Sudeste",
    address: "Av dos estados, 1586",
    lat: -23.6263972,
    lng: -46.540195,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5,
  },
  {
    id: "f_1791493654697",
    code: "M-01",
    name: "MEXICANO",
    businessId: "mexicano",
    city: "Santo André",
    region: "Sudeste",
    address: "Rua das Figueiras, 780, Santo André - SP, 09080-300",
    lat: -23.6470113,
    lng: -46.5410612,
    resp: "RODRIGO",
    email: "",
    phone: "",
    faturamento: 0,
    status: "green",
    active: true,
    coordinatesVerified: true,
    pendencias: 0,
    rpDone: 5,
  },
];

export const dreExpenseDefs: DreExpenseDef[] = [
  { id: "folha", name: "Folha + encargos", group: "pessoal", pct: 0.180, fromConciliation: false, icon: "👥" },
  { id: "vt", name: "Vale Transporte", group: "pessoal", pct: 0.012, fromConciliation: false, icon: "🚌" },
  { id: "aluguel", name: "Aluguel", group: "ocupacao", pct: 0.080, fromConciliation: false, icon: "🏢" },
  { id: "luz", name: "Energia elétrica", group: "utilidades", pct: 0.023, fromConciliation: true, icon: "⚡" },
  { id: "agua", name: "Água e esgoto", group: "utilidades", pct: 0.012, fromConciliation: true, icon: "💧" },
  { id: "internet", name: "Internet / Telefonia", group: "utilidades", pct: 0.004, fromConciliation: true, icon: "🌐" },
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

export const initialEmployees: Employee[] = [];

export const initialUsers: UserAccount[] = [
  { id: "u1", nome: "Administrador", email: "", login: "dono", perfil: "dono", unidade: "dono", status: "ativo", last: "Agora", employeeId: "e1" }
];

export const defaultUsers: User[] = [
  { id: "u1", name: "Administrador", username: "dono", role: "admin", email: "" }
];

export const initialManualEntries: ManualEntry[] = [
];

/** Compromissos exibidos quando a base ainda não possui a seção de contas a pagar. */
export const initialBills: BillItem[] = [];

export const rpCatalog: RoutineRP[] = [
  { id: "rp01", name: "Fechamento semanal de caixa", desc: "Consolida entradas e saídas da semana e gera prévia do resultado.", sched: "Seg 08:00", status: "done" },
  { id: "rp02", name: "Cálculo de VT", desc: "Calcula diárias, faltas e Uber dos colaboradores da unidade.", sched: "Sex 17:00", status: "sched" },
  { id: "rp03", name: "Conciliação automática", desc: "Cruza extrato importado com lançamentos e sugere correspondências.", sched: "Diário 07:30", status: "sched" },
  { id: "rp04", name: "Repasse da franqueadora", desc: "Calcula royalties e repasses devidos pela unidade no período.", sched: "Dia 5", status: "idle" },
  { id: "rp05", name: "Fechamento do DRE", desc: "Consolida receitas, custos e despesas do período e gera o DRE.", sched: "Dia 1", status: "idle" },
  { id: "rp06", name: "Apuração de taxas e recebíveis", desc: "Calcula taxas por meio de pagamento e agenda recebíveis (D+0/D+1/D+30).", sched: "Diário 22:00", status: "idle" }
];

export const sampleConciliation: ConciliationItem[] = [
];

export const initialConfigs: ConfigItem[] = [
  {
    key: "app_name",
    name: "Nome da Plataforma",
    value: "Gestão de Franquias — SaaS Financeiro para Franquias",
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
    name: "Sincronização em Tempo Real",
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
