export type ScreenType =
  | "home"
  | "network"
  | "map"
  | "dashboard"
  | "dre"
  | "fees"
  | "dreparams"
  | "lancamentos"
  | "conciliation"
  | "vt"
  | "rp"
  | "pagamentos_despesas"
  | "reports"
  | "permissoes"
  | "tenants"
  | "employees"
  | "users"
  | "configuracao"
  | "settings";

export interface ConfigItem {
  key: string;
  name: string;
  value: string;
  type: "string" | "number" | "boolean" | "select";
  category: "Geral" | "Financeiro" | "Regras de Negócio" | "Sincronização" | "Segurança" | "Operação" | string;
  description: string;
  lastModified: string;
  modifiedBy: string;
  options?: string[];
}

export type CloudConfigItem = ConfigItem;

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  key: string;
  oldValue: any;
  newValue: any;
  user: string;
  ip?: string;
}

export interface Business {
  id: string;
  name: string;
  brand: string;
  color: string;
  royalty?: number;
}

export interface FranchiseUnit {
  id: string;
  businessId: string;
  name: string;
  code: string;
  resp: string;
  address: string;
  city: string;
  state?: string;
  region: string;
  lat: number;
  lng: number;
  faturamento: number;
  pendencias: number;
  rpDone: number;
  status: "green" | "amber" | "red";
  email?: string;
  phone?: string;
}

export interface DreExpenseDef {
  id: string;
  name: string;
  group: "pessoal" | "ocupacao" | "utilidades" | "franquia" | "operacional";
  pct: number;
  fromConciliation: boolean;
  icon: string;
}

export interface DreParams {
  impostos: number;
  cmv: number;
  fees: number;
  discount: number;
  despesas: Record<string, number>;
}

export interface DreExpenseItem extends DreExpenseDef {
  value: number;
}

export interface DreCalculation {
  fatBruta: number;
  desconto: number;
  receitaAjustada: number;
  impostos: number;
  receitaLiquida: number;
  cmv: number;
  taxasNegocio: number;
  lucroBruto: number;
  despesas: DreExpenseItem[];
  totalDesp: number;
  lucroLiquido: number;
  margemBruta: number;
  margemLiquida: number;
  despRatio: number;
  params: DreParams;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  fee: number;
  prazoDias: number;
  cutoffHour: number;
  parcelas: boolean;
  bandeira: string | null;
}

export interface BusinessRule {
  maxDiscount: number;
  minTicket: number;
  advance: boolean;
}

export interface ManualEntry {
  id: string;
  tenant: string;
  type: "entrada" | "despesa";
  date: string;
  value: number;
  desc: string;
  catId: string;
  catName: string;
  pay: string;
  note?: string;
  created: string;
}

export interface Employee {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  unidade: string;
  email: string;
  vt: boolean;
  login?: string;
  phone?: string;
  salary?: number;
  active?: boolean;
}

export interface UserAccount {
  id: string;
  nome: string;
  email: string;
  login: string;
  perfil: "dono" | "equipe" | "admin" | "franqueado" | "operador" | string;
  unidade: string;
  status: "ativo" | "inativo";
  last?: string;
  employeeId?: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: "admin" | "team" | "franchisee" | "dono" | "equipe" | "franqueado";
  tenantId?: string;
  unitName?: string;
  email?: string;
}

export interface UserSession {
  login: string;
  name: string;
  tenant: string;
  profile: "dono" | "equipe" | "admin" | "franqueado" | "operador";
  token?: string;
}

export interface VTEmployeeItem {
  id: string;
  nome: string;
  mat: string;
  setor: string;
  operadora: string;
  cartaoNumero?: string;
  tarifaIda: number;
  tarifaVolta: number;
  diasPrevistos: number;
  faltas: number;
  salarioBase: number;
  uberAdicional?: number;
  statusRecarga?: "pendente" | "processado" | "creditado" | "pago_pix";
}

export interface VTConfig {
  title: string;
  period: string;
  rate: number;
  days: number;
  format: "both" | "excel" | "pdf";
  prefix: string;
  pix: boolean;
  notes: boolean;
  tenant: string;
  periodoTipo?: "semanal" | "quinzenal" | "mensal";
  descontoCltPct?: number;
  employees?: VTEmployeeItem[];
}

export interface BillItem {
  id: string;
  desc: string;
  vencimento: string;
  value: number;
  cat: string;
  status: "open" | "paid";
  payMethod: string;
}

export interface SystemSettings {
  appName: string;
  companyName: string;
  cnpjMatriz: string;
  theme?: string;
  currency?: string;
  autoSync?: boolean;
  syncInterval?: number;
  contactEmail?: string;
}

export interface RoutineRP {
  id: string;
  name: string;
  desc: string;
  sched: string;
  status: "done" | "sched" | "idle";
}

export interface ConciliationItem {
  date: string;
  desc: string;
  value: string;
  numericValue: number;
  categoria: string;
  match: string;
  status: "match" | "review";
  label: string;
  tone: "green" | "amber" | "red";
  toDre?: boolean;
  previsao?: string;
}

export interface CloudState {
  businesses: Business[];
  franchises: FranchiseUnit[];
  employees: Employee[];
  users: UserAccount[];
  manualEntries: ManualEntry[];
  configs: ConfigItem[];
  cloudConfigs?: ConfigItem[];
  dreParams: Record<string, DreParams>;
  paymentMethods: PaymentMethod[] | Record<string, PaymentMethod[]>;
  businessRules: BusinessRule | Record<string, BusinessRule>;
  royalties: Record<string, number>;
  permissions: Record<string, any>;
  vtConfigs: Record<string, VTConfig>;
  systemSettings: SystemSettings;
  lastUpdated: string;
}
