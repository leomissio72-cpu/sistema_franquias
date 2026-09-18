import React, { useState } from "react";
import { VTConfig, VTEmployeeItem, ScreenType } from "../../types";
import { formatBrl, formatBrl2, formatPct } from "../../utils/calculations";
import {
  FileSpreadsheet,
  Save,
  Download,
  Printer,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Search,
  CreditCard,
  Building2,
  Users,
  AlertCircle,
  HelpCircle,
  Sliders,
  DollarSign,
  TrendingUp,
  X,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface VtScreenProps {
  currentTenantId: string;
  vtConfigs: Record<string, VTConfig>;
  onSaveVtConfig: (tenantId: string, config: VTConfig) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
}

const defaultEmployees: VTEmployeeItem[] = [
  {
    id: "vt_1",
    nome: "Renata Souza Martins",
    mat: "0012",
    setor: "Atendimento & Balcão",
    operadora: "Bilhete Único SP (SPTrans)",
    cartaoNumero: "9823.4412.0911",
    tarifaIda: 5.0,
    tarifaVolta: 5.0,
    diasPrevistos: 22,
    faltas: 0,
    salarioBase: 2100.0,
    uberAdicional: 0,
    statusRecarga: "creditado",
  },
  {
    id: "vt_2",
    nome: "Carlos Eduardo Silveira",
    mat: "0018",
    setor: "Vendas & Caixa",
    operadora: "Cartão TOP Metropolitano",
    cartaoNumero: "7721.8902.1243",
    tarifaIda: 5.35,
    tarifaVolta: 5.35,
    diasPrevistos: 22,
    faltas: 1,
    salarioBase: 2450.0,
    uberAdicional: 0,
    statusRecarga: "pendente",
  },
  {
    id: "vt_3",
    nome: "Mariana Costa Santos",
    mat: "0021",
    setor: "Recepção & Suporte",
    operadora: "Bilhete Único SP (SPTrans)",
    cartaoNumero: "9823.1102.8765",
    tarifaIda: 5.0,
    tarifaVolta: 5.0,
    diasPrevistos: 22,
    faltas: 0,
    salarioBase: 1950.0,
    uberAdicional: 35.0,
    statusRecarga: "processado",
  },
  {
    id: "vt_4",
    nome: "Lucas Oliveira Nogueira",
    mat: "0026",
    setor: "Operação & Estoque",
    operadora: "RioCard Mais / Ônibus",
    cartaoNumero: "4412.9812.5532",
    tarifaIda: 4.8,
    tarifaVolta: 4.8,
    diasPrevistos: 26,
    faltas: 2,
    salarioBase: 1850.0,
    uberAdicional: 0,
    statusRecarga: "creditado",
  },
  {
    id: "vt_5",
    nome: "Beatriz Lima Rocha",
    mat: "0031",
    setor: "Supervisão Operacional",
    operadora: "Vale Combustível / Cartão Ticket",
    cartaoNumero: "6032.1902.4410",
    tarifaIda: 9.0,
    tarifaVolta: 9.0,
    diasPrevistos: 22,
    faltas: 0,
    salarioBase: 3600.0,
    uberAdicional: 0,
    statusRecarga: "pago_pix",
  },
];

export const VtScreen: React.FC<VtScreenProps> = ({
  currentTenantId,
  vtConfigs,
  onSaveVtConfig,
  onNavigate,
}) => {
  const currentConfig: VTConfig = vtConfigs[currentTenantId] || {
    title: "Planilha VT Mensal - Benefício e Recarga",
    period: "Mês Vigente",
    rate: 10.0,
    days: 22,
    format: "both",
    prefix: "VT_Folha",
    pix: true,
    notes: true,
    tenant: currentTenantId,
    periodoTipo: "mensal",
    descontoCltPct: 0.06,
    employees: defaultEmployees,
  };

  const [form, setForm] = useState<VTConfig>(currentConfig);
  const [employees, setEmployees] = useState<VTEmployeeItem[]>(
    currentConfig.employees && currentConfig.employees.length > 0
      ? currentConfig.employees
      : defaultEmployees
  );
  const [isSaved, setIsSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<VTEmployeeItem | null>(null);
  const [isBatchDaysModalOpen, setIsBatchDaysModalOpen] = useState(false);
  const [batchDaysValue, setBatchDaysValue] = useState(22);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptEmp, setSelectedReceiptEmp] = useState<VTEmployeeItem | null>(null);

  // New Employee Form
  const [empForm, setEmpForm] = useState<Partial<VTEmployeeItem>>({
    nome: "",
    mat: "",
    setor: "Atendimento",
    operadora: "Bilhete Único SP (SPTrans)",
    cartaoNumero: "",
    tarifaIda: 5.0,
    tarifaVolta: 5.0,
    diasPrevistos: form.days || 22,
    faltas: 0,
    salarioBase: 2000.0,
    uberAdicional: 0,
    statusRecarga: "pendente",
  });

  // Calculate stats for each employee
  const calculateEmpValues = (emp: VTEmployeeItem) => {
    const diaria = (emp.tarifaIda || 0) + (emp.tarifaVolta || 0);
    const diasEfetivos = Math.max(0, (emp.diasPrevistos || form.days) - (emp.faltas || 0));
    const custoVtPassagens = diaria * diasEfetivos;
    const custoTotalVt = custoVtPassagens + (emp.uberAdicional || 0);

    // Regra CLT: Desconto limitado a 6% do salário base ou ao valor total do benefício
    const tetoDescontoClt = (emp.salarioBase || 0) * (form.descontoCltPct || 0.06);
    const descontoEfetivo = Math.min(custoTotalVt, tetoDescontoClt);
    const subsidioEmpresa = Math.max(0, custoTotalVt - descontoEfetivo);

    return {
      diaria,
      diasEfetivos,
      custoTotalVt,
      tetoDescontoClt,
      descontoEfetivo,
      subsidioEmpresa,
    };
  };

  // Aggregated totals
  const totals = employees.reduce(
    (acc, emp) => {
      const calc = calculateEmpValues(emp);
      acc.totalConcedido += calc.custoTotalVt;
      acc.totalDescontoClt += calc.descontoEfetivo;
      acc.totalSubsidioEmpresa += calc.subsidioEmpresa;
      if (emp.statusRecarga === "creditado" || emp.statusRecarga === "pago_pix") {
        acc.totalProcessado += calc.custoTotalVt;
      } else {
        acc.totalPendente += calc.custoTotalVt;
      }
      return acc;
    },
    {
      totalConcedido: 0,
      totalDescontoClt: 0,
      totalSubsidioEmpresa: 0,
      totalProcessado: 0,
      totalPendente: 0,
    }
  );

  // Save to cloud
  const handleSave = async () => {
    const updatedConfig: VTConfig = {
      ...form,
      employees,
    };
    await onSaveVtConfig(currentTenantId, updatedConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    if (statusFilter !== "all" && emp.statusRecarga !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      emp.nome.toLowerCase().includes(q) ||
      emp.mat.toLowerCase().includes(q) ||
      emp.setor.toLowerCase().includes(q) ||
      emp.operadora.toLowerCase().includes(q) ||
      (emp.cartaoNumero && emp.cartaoNumero.toLowerCase().includes(q))
    );
  });

  // Inline adjuster
  const updateEmployeeFaltas = (id: string, delta: number) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const newFaltas = Math.max(0, (e.faltas || 0) + delta);
        return { ...e, faltas: newFaltas };
      })
    );
  };

  const updateEmployeeStatus = (id: string, status: VTEmployeeItem["statusRecarga"]) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, statusRecarga: status } : e))
    );
  };

  // Add or update
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.nome?.trim()) return;

    if (editingEmployee) {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === editingEmployee.id
            ? ({
                ...emp,
                ...empForm,
              } as VTEmployeeItem)
            : emp
        )
      );
      setEditingEmployee(null);
    } else {
      const newEmp: VTEmployeeItem = {
        id: "vt_" + Date.now(),
        nome: empForm.nome.trim(),
        mat: empForm.mat?.trim() || String(Math.floor(1000 + Math.random() * 9000)),
        setor: empForm.setor || "Geral",
        operadora: empForm.operadora || "Bilhete Único SP",
        cartaoNumero: empForm.cartaoNumero || "0000.0000.0000",
        tarifaIda: Number(empForm.tarifaIda) || 5.0,
        tarifaVolta: Number(empForm.tarifaVolta) || 5.0,
        diasPrevistos: Number(empForm.diasPrevistos) || form.days,
        faltas: Number(empForm.faltas) || 0,
        salarioBase: Number(empForm.salarioBase) || 2000.0,
        uberAdicional: Number(empForm.uberAdicional) || 0,
        statusRecarga: (empForm.statusRecarga as any) || "pendente",
      };
      setEmployees((prev) => [...prev, newEmp]);
    }

    setIsAddModalOpen(false);
    setEmpForm({
      nome: "",
      mat: "",
      setor: "Atendimento",
      operadora: "Bilhete Único SP (SPTrans)",
      cartaoNumero: "",
      tarifaIda: 5.0,
      tarifaVolta: 5.0,
      diasPrevistos: form.days || 22,
      faltas: 0,
      salarioBase: 2000.0,
      uberAdicional: 0,
      statusRecarga: "pendente",
    });
  };

  const openEditModal = (emp: VTEmployeeItem) => {
    setEditingEmployee(emp);
    setEmpForm({ ...emp });
    setIsAddModalOpen(true);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm("Deseja remover este colaborador da folha de Vale Transporte?")) {
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    }
  };

  // Batch actions
  const applyBatchDays = () => {
    setEmployees((prev) =>
      prev.map((e) => ({ ...e, diasPrevistos: batchDaysValue }))
    );
    setForm((prev) => ({ ...prev, days: batchDaysValue }));
    setIsBatchDaysModalOpen(false);
  };

  const markAllAsProcessed = () => {
    setEmployees((prev) =>
      prev.map((e) => ({ ...e, statusRecarga: "creditado" }))
    );
  };

  // Exports
  const handleDownloadCsvRecarga = () => {
    const rows = [
      ["Nome do Colaborador", "Matrícula", "Operadora do Cartão", "Número do Cartão", "Dias Efetivos", "Valor de Recarga (R$)", "Status"],
    ];
    employees.forEach((emp) => {
      const calc = calculateEmpValues(emp);
      rows.push([
        emp.nome,
        emp.mat,
        emp.operadora,
        emp.cartaoNumero || "Não informado",
        String(calc.diasEfetivos),
        calc.custoTotalVt.toFixed(2),
        emp.statusRecarga || "pendente",
      ]);
    });

    const csvContent = "\ufeff" + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Pedido_Recarga_VT_${currentTenantId}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleDownloadCsvFolha = () => {
    const rows = [
      [
        "Colaborador",
        "Matrícula",
        "Setor",
        "Salário Base (R$)",
        "Diária (R$)",
        "Dias Previstos",
        "Faltas",
        "Dias Efetivos",
        "Custo Total VT (R$)",
        "Desconto CLT 6% (R$)",
        "Custo Franqueadora/Loja (R$)",
      ],
    ];
    employees.forEach((emp) => {
      const calc = calculateEmpValues(emp);
      rows.push([
        emp.nome,
        emp.mat,
        emp.setor,
        emp.salarioBase.toFixed(2),
        calc.diaria.toFixed(2),
        String(emp.diasPrevistos),
        String(emp.faltas),
        String(calc.diasEfetivos),
        calc.custoTotalVt.toFixed(2),
        calc.descontoEfetivo.toFixed(2),
        calc.subsidioEmpresa.toFixed(2),
      ]);
    });

    const csvContent = "\ufeff" + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Contabil_VT_CLT_${currentTenantId}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da] flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            <span>RH, Benefícios & Recarga de Cartões</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <FileSpreadsheet className="h-6 w-6 text-[#3c63da]" />
            Vale Transporte & Mobilidade (CLT)
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Cálculo do benefício com desconto de 6% CLT, pedidos de recarga de bilhetes, controle de faltas e emissão de recibos.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingEmployee(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>+ Novo Colaborador</span>
          </button>

          <button
            onClick={handleDownloadCsvRecarga}
            className="flex items-center gap-1.5 rounded-xl border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] transition-all shadow-xs cursor-pointer"
            title="Exportar arquivo para recarga na concessionária"
          >
            <Download className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>Pedido de Recarga (CSV)</span>
          </button>

          <button
            onClick={handleDownloadCsvFolha}
            className="flex items-center gap-1.5 rounded-xl border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] transition-all shadow-xs cursor-pointer"
            title="Exportar resumo de descontos CLT para a folha contábil"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Folha Contábil CLT</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer transition-all"
          >
            {isSaved ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
            <span>{isSaved ? "Salvo na Nuvem!" : "Salvar na Nuvem"}</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Valor Total do Benefício
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold text-[#152238] block mt-1 font-mono">
            {formatBrl(totals.totalConcedido)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            {employees.length} colaboradores ativos
          </small>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3c63da] block">
            Subsídio Pago pela Franquia
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold text-[#3c63da] block mt-1 font-mono">
            {formatBrl(totals.totalSubsidioEmpresa)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Custo real absorvido na unidade
          </small>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
            Desconto CLT (Até 6%)
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold text-emerald-700 block mt-1 font-mono">
            {formatBrl(totals.totalDescontoClt)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Descontado em folha dos funcionários
          </small>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 block">
            Status dos Pedidos de Recarga
          </span>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs font-extrabold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {formatBrl(totals.totalProcessado)} pago
            </span>
            <span className="text-xs font-extrabold font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              {formatBrl(totals.totalPendente)} pendente
            </span>
          </div>
          <small className="text-[10px] text-[#69778c] block mt-1">
            Recargas aguardando liberação
          </small>
        </div>
      </div>

      {/* Options & Batch Actions Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#e5eaf1] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search and Filters */}
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#69778c]" />
              <input
                type="text"
                placeholder="Buscar por colaborador, matrícula, cartão ou operadora..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#e5eaf1] bg-[#f8faff] pl-9 pr-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-[#69778c] hover:text-[#152238]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="pendente">🟡 Pendente de Recarga</option>
              <option value="processado">🔵 Processado em Lote</option>
              <option value="creditado">🟢 Creditado no Cartão</option>
              <option value="pago_pix">🟣 Pago via PIX</option>
            </select>
          </div>

          {/* Quick Batch Options Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBatchDaysModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#edf2ff] hover:text-[#3c63da] transition-all cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Ajustar Dias Úteis do Mês</span>
            </button>

            <button
              onClick={markAllAsProcessed}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Marcar Todos como Creditados</span>
            </button>
          </div>
        </div>

        {/* Legal CLT Rules info strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#e5eaf1] text-[11px] text-[#69778c]">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>
              <strong>Regra CLT (Lei 7.418/85):</strong> O empregado arca com até <strong>6% do salário base</strong>. Se o custo do VT for inferior a 6%, desconta-se apenas o valor real do VT.
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span>Período Ativo:</span>
            <select
              value={form.periodoTipo || "mensal"}
              onChange={(e) => setForm((p) => ({ ...p, periodoTipo: e.target.value as any }))}
              className="rounded-lg border border-[#e5eaf1] bg-white px-2 py-0.5 text-xs font-bold text-[#152238]"
            >
              <option value="mensal">Mensal (Padrão)</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table: Employees & VT Calculations */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#e5eaf1] flex items-center justify-between bg-[#f8faff]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#152238]">
              Colaboradores & Quadro de Vale Transporte ({filteredEmployees.length})
            </h3>
            <span className="text-[10px] bg-[#edf2ff] text-[#3c63da] font-extrabold px-2 py-0.5 rounded-full">
              {currentTenantId}
            </span>
          </div>
          <div className="text-xs text-[#69778c]">
            Clique em <strong>+</strong> ou <strong>−</strong> para lançar faltas e deduzir automaticamente.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                <th className="p-3.5">Colaborador / Setor</th>
                <th className="p-3.5">Operadora & Cartão</th>
                <th className="p-3.5 text-center">Tarifas (Ida/Volta)</th>
                <th className="p-3.5 text-center">Dias / Faltas</th>
                <th className="p-3.5 text-right">Custo Total VT</th>
                <th className="p-3.5 text-right">Desconto CLT (6%)</th>
                <th className="p-3.5 text-right">Custo Loja</th>
                <th className="p-3.5 text-center">Status Recarga</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5eaf1]">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#69778c]">
                    Nenhum colaborador encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const calc = calculateEmpValues(emp);

                  return (
                    <tr key={emp.id} className="hover:bg-[#f8faff] transition-colors">
                      {/* Name & Sector */}
                      <td className="p-3.5">
                        <div className="font-bold text-[#152238]">{emp.nome}</div>
                        <div className="text-[10px] text-[#69778c] flex items-center gap-1.5 mt-0.5">
                          <span>Mat: {emp.mat}</span>
                          <span>•</span>
                          <span className="text-[#3c63da] font-semibold">{emp.setor}</span>
                          <span>•</span>
                          <span className="font-mono">Sal: {formatBrl(emp.salarioBase)}</span>
                        </div>
                      </td>

                      {/* Operator & Card Number */}
                      <td className="p-3.5">
                        <div className="font-semibold text-[#152238]">{emp.operadora}</div>
                        <div className="font-mono text-[10px] text-[#69778c] mt-0.5">
                          {emp.cartaoNumero || "Cartão não informado"}
                        </div>
                      </td>

                      {/* Daily Fare */}
                      <td className="p-3.5 text-center">
                        <div className="font-mono font-bold text-[#152238]">
                          {formatBrl(calc.diaria)}/dia
                        </div>
                        <div className="text-[10px] text-[#69778c]">
                          Ida: {formatBrl(emp.tarifaIda)} | Volta: {formatBrl(emp.tarifaVolta)}
                        </div>
                      </td>

                      {/* Days & Absences Controller */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-[#f0f4f9] px-2 py-1 rounded-xl border border-[#e5eaf1]">
                          <span className="font-mono font-extrabold text-xs text-[#152238]">
                            {calc.diasEfetivos} dias
                          </span>
                          <span className="text-[10px] text-[#69778c]">
                            ({emp.faltas} falta{emp.faltas === 1 ? "" : "s"})
                          </span>
                          <div className="flex items-center gap-0.5 ml-1">
                            <button
                              onClick={() => updateEmployeeFaltas(emp.id, 1)}
                              className="h-5 w-5 rounded bg-white text-rose-600 font-bold hover:bg-rose-100 flex items-center justify-center text-xs border border-rose-200 cursor-pointer"
                              title="Adicionar falta"
                            >
                              +
                            </button>
                            <button
                              onClick={() => updateEmployeeFaltas(emp.id, -1)}
                              className="h-5 w-5 rounded bg-white text-emerald-700 font-bold hover:bg-emerald-100 flex items-center justify-center text-xs border border-emerald-200 cursor-pointer"
                              title="Diminuir falta"
                            >
                              −
                            </button>
                          </div>
                        </div>
                        {emp.uberAdicional ? (
                          <div className="text-[10px] text-purple-700 font-bold mt-1">
                            + {formatBrl(emp.uberAdicional)} Mobilidade/Uber
                          </div>
                        ) : null}
                      </td>

                      {/* Total Value */}
                      <td className="p-3.5 text-right font-mono font-bold text-[#152238]">
                        {formatBrl(calc.custoTotalVt)}
                      </td>

                      {/* CLT 6% Deduction */}
                      <td className="p-3.5 text-right">
                        <div className="font-mono font-bold text-emerald-700">
                          {formatBrl(calc.descontoEfetivo)}
                        </div>
                        <span className="text-[9px] text-[#69778c]">
                          {calc.descontoEfetivo < calc.tetoDescontoClt
                            ? "Custo menor que 6%"
                            : "Teto exato de 6%"}
                        </span>
                      </td>

                      {/* Net Company Cost */}
                      <td className="p-3.5 text-right font-mono font-bold text-[#3c63da]">
                        {formatBrl(calc.subsidioEmpresa)}
                      </td>

                      {/* Recharge Status */}
                      <td className="p-3.5 text-center">
                        <select
                          value={emp.statusRecarga || "pendente"}
                          onChange={(e) => updateEmployeeStatus(emp.id, e.target.value as any)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${
                            emp.statusRecarga === "creditado"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : emp.statusRecarga === "processado"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : emp.statusRecarga === "pago_pix"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          <option value="pendente">🟡 Pendente</option>
                          <option value="processado">🔵 Processado</option>
                          <option value="creditado">🟢 Creditado</option>
                          <option value="pago_pix">🟣 Pago via PIX</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedReceiptEmp(emp);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-[#e5eaf1] bg-white text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] cursor-pointer transition-colors"
                            title="Emitir Recibo de Entrega para Assinatura"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 rounded-lg border border-[#e5eaf1] bg-white text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] cursor-pointer transition-colors"
                            title="Editar dados do colaborador"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="p-1.5 rounded-lg border border-[#e5eaf1] bg-white text-[#69778c] hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 bg-[#f8faff] border-t border-[#e5eaf1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-[#69778c]">
            Total de <strong>{filteredEmployees.length}</strong> colaboradores listados. Folha de VT configurada para a unidade <strong>{currentTenantId}</strong>.
          </div>
          <div className="flex items-center gap-4 font-mono font-bold">
            <div>
              <span className="text-[#69778c] font-sans text-[11px] mr-1">Total a Carregar:</span>
              <span className="text-[#152238]">{formatBrl(totals.totalConcedido)}</span>
            </div>
            <div>
              <span className="text-[#69778c] font-sans text-[11px] mr-1">Custo Empresa:</span>
              <span className="text-[#3c63da]">{formatBrl(totals.totalSubsidioEmpresa)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADICIONAR / EDITAR COLABORADOR                         */}
      {/* ------------------------------------------------------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-[#e5eaf1] flex items-center justify-between bg-[#f8faff]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3c63da] text-white">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#152238]">
                    {editingEmployee ? "Editar Colaborador VT" : "Novo Colaborador para Vale Transporte"}
                  </h3>
                  <p className="text-xs text-[#69778c]">
                    Informe os dados de transporte e salário para cálculo legal automático.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-white border border-[#e5eaf1] flex items-center justify-center text-[#69778c] hover:bg-[#f4f7fb] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Nome Completo do Colaborador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Amanda Silva Ribeiro"
                  value={empForm.nome || ""}
                  onChange={(e) => setEmpForm((p) => ({ ...p, nome: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Matrícula
                  </label>
                  <input
                    type="text"
                    placeholder="0045"
                    value={empForm.mat || ""}
                    onChange={(e) => setEmpForm((p) => ({ ...p, mat: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Setor / Função
                  </label>
                  <input
                    type="text"
                    placeholder="Atendimento, Caixa, Estoque..."
                    value={empForm.setor || ""}
                    onChange={(e) => setEmpForm((p) => ({ ...p, setor: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Operadora / Cartão
                  </label>
                  <select
                    value={empForm.operadora || "Bilhete Único SP (SPTrans)"}
                    onChange={(e) => setEmpForm((p) => ({ ...p, operadora: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  >
                    <option value="Bilhete Único SP (SPTrans)">Bilhete Único SP (SPTrans)</option>
                    <option value="Cartão TOP Metropolitano">Cartão TOP Metropolitano</option>
                    <option value="RioCard Mais / Ônibus">RioCard Mais / Ônibus</option>
                    <option value="Salvador Card">Salvador Card</option>
                    <option value="BHBUS / Transfácil">BHBUS / Transfácil</option>
                    <option value="Ônibus Intermunicipal">Ônibus Intermunicipal</option>
                    <option value="Vale Combustível / Cartão Ticket">Vale Combustível / Cartão Ticket</option>
                    <option value="Uber / Mobilidade Corporativa">Uber / Mobilidade Corporativa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Número do Cartão
                  </label>
                  <input
                    type="text"
                    placeholder="9823.4412.0911"
                    value={empForm.cartaoNumero || ""}
                    onChange={(e) => setEmpForm((p) => ({ ...p, cartaoNumero: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Tarifa Ida (R$)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={empForm.tarifaIda ?? 5.0}
                    onChange={(e) => setEmpForm((p) => ({ ...p, tarifaIda: parseFloat(e.target.value || "0") }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Tarifa Volta (R$)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={empForm.tarifaVolta ?? 5.0}
                    onChange={(e) => setEmpForm((p) => ({ ...p, tarifaVolta: parseFloat(e.target.value || "0") }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Salário Base (R$)
                  </label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={empForm.salarioBase ?? 2000}
                    onChange={(e) => setEmpForm((p) => ({ ...p, salarioBase: parseFloat(e.target.value || "0") }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Dias Previstos
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={empForm.diasPrevistos ?? 22}
                    onChange={(e) => setEmpForm((p) => ({ ...p, diasPrevistos: parseInt(e.target.value || "22", 10) }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Faltas no Mês
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="31"
                    value={empForm.faltas ?? 0}
                    onChange={(e) => setEmpForm((p) => ({ ...p, faltas: parseInt(e.target.value || "0", 10) }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Status da Recarga
                  </label>
                  <select
                    value={empForm.statusRecarga || "pendente"}
                    onChange={(e) => setEmpForm((p) => ({ ...p, statusRecarga: e.target.value as any }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="processado">Processado</option>
                    <option value="creditado">Creditado</option>
                    <option value="pago_pix">Pago via PIX</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-[#f8faff] rounded-xl border border-[#e5eaf1] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-[#69778c]">Diária Calculada</div>
                  <strong className="text-sm font-mono text-[#152238]">
                    {formatBrl(((empForm.tarifaIda || 0) + (empForm.tarifaVolta || 0)))}
                  </strong>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-[#69778c]">Teto CLT (6%)</div>
                  <strong className="text-sm font-mono text-emerald-700">
                    {formatBrl(((empForm.salarioBase || 0) * 0.06))}
                  </strong>
                </div>
              </div>

              <div className="pt-3 border-t border-[#e5eaf1] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-[#e5eaf1] bg-white px-4 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#3c63da] px-5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer"
                >
                  {editingEmployee ? "Salvar Alterações" : "Adicionar Colaborador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: AJUSTAR DIAS ÚTEIS EM LOTE                             */}
      {/* ------------------------------------------------------------- */}
      {isBatchDaysModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#e5eaf1] bg-[#f8faff] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#3c63da]" />
                <span>Definir Dias Úteis do Mês</span>
              </h3>
              <button
                onClick={() => setIsBatchDaysModalOpen(false)}
                className="h-7 w-7 rounded-lg bg-white border border-[#e5eaf1] flex items-center justify-center text-[#69778c]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-[#69778c]">
                Selecione quantos dias úteis o período atual terá. Isso atualizará a previsão de todos os colaboradores da unidade:
              </p>

              <div className="grid grid-cols-4 gap-2">
                {[20, 21, 22, 26].map((d) => (
                  <button
                    key={d}
                    onClick={() => setBatchDaysValue(d)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      batchDaysValue === d
                        ? "bg-[#3c63da] text-white border-[#3c63da] shadow-xs"
                        : "bg-[#f8faff] text-[#152238] border-[#e5eaf1] hover:border-[#3c63da]"
                    }`}
                  >
                    {d} dias
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Ou digite quantidade personalizada:
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={batchDaysValue}
                  onChange={(e) => setBatchDaysValue(parseInt(e.target.value || "22", 10))}
                  className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] bg-[#f8faff]"
                />
              </div>

              <div className="pt-3 border-t border-[#e5eaf1] flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsBatchDaysModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#e5eaf1] bg-white text-xs font-bold text-[#152238]"
                >
                  Cancelar
                </button>
                <button
                  onClick={applyBatchDays}
                  className="px-4 py-1.5 rounded-lg bg-[#3c63da] text-xs font-bold text-white shadow-xs"
                >
                  Aplicar a Todos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RECIBO FORMAL DE ENTREGA DE VALE TRANSPORTE            */}
      {/* ------------------------------------------------------------- */}
      {isReceiptModalOpen && selectedReceiptEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#e5eaf1] flex items-center justify-between bg-[#f8faff]">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-[#3c63da]" />
                <h3 className="text-base font-extrabold text-[#152238]">
                  Comprovante de Entrega & Declaração de Vale Transporte (CLT)
                </h3>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-white border border-[#e5eaf1] flex items-center justify-center text-[#69778c]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-[#152238] leading-relaxed">
              {/* Receipt Body */}
              <div className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8f9fc] space-y-2">
                <div className="flex justify-between items-center border-b border-[#e5eaf1] pb-2">
                  <span className="font-bold uppercase text-[10px] text-[#69778c]">Unidade Franqueada</span>
                  <span className="font-bold text-[#3c63da]">{currentTenantId}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>Colaborador: <strong>{selectedReceiptEmp.nome}</strong></div>
                  <div>Matrícula: <strong>{selectedReceiptEmp.mat}</strong></div>
                  <div>Cargo / Setor: <strong>{selectedReceiptEmp.setor}</strong></div>
                  <div>Salário Base: <strong>{formatBrl(selectedReceiptEmp.salarioBase)}</strong></div>
                  <div>Operadora: <strong>{selectedReceiptEmp.operadora}</strong></div>
                  <div>Cartão Nº: <strong>{selectedReceiptEmp.cartaoNumero || "N/I"}</strong></div>
                </div>
              </div>

              {(() => {
                const c = calculateEmpValues(selectedReceiptEmp);
                return (
                  <div className="border border-[#e5eaf1] rounded-xl p-4 space-y-2 bg-white">
                    <div className="flex justify-between">
                      <span>Dias Trabalhados no Período:</span>
                      <strong>{c.diasEfetivos} dias</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Tarifa Diária (Ida + Volta):</span>
                      <strong>{formatBrl(c.diaria)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-[#e5eaf1] pt-1">
                      <span>Valor Total Creditado / Entregue:</span>
                      <strong className="text-emerald-700 font-mono text-sm">{formatBrl(c.custoTotalVt)}</strong>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>Desconto Legal em Folha (até 6% do Salário Base):</span>
                      <strong className="font-mono text-sm">− {formatBrl(c.descontoEfetivo)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-[#e5eaf1] pt-1 text-[#3c63da]">
                      <span>Custo Custeado pela Empresa:</span>
                      <strong className="font-mono text-sm">{formatBrl(c.subsidioEmpresa)}</strong>
                    </div>
                  </div>
                );
              })()}

              <p className="text-[11px] text-[#69778c] italic text-justify">
                Declaro para os devidos fins que recebi os créditos / bilhetes acima especificados, destinados exclusivamente ao meu deslocamento residência-trabalho e vice-versa, ciente das penalidades previstas na legislação trabalhista em caso de uso indevido (Lei Federal nº 7.418/1985 e Decreto nº 95.247/1987).
              </p>

              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-[#152238] pt-1">
                  <span>Assinatura da Franqueadora / Empregador</span>
                </div>
                <div className="border-t border-[#152238] pt-1">
                  <span>Assinatura do Colaborador: {selectedReceiptEmp.nome}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#f8faff] border-t border-[#e5eaf1] flex justify-end gap-2">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#e5eaf1] bg-white text-xs font-bold text-[#152238]"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-[#3c63da] text-xs font-bold text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Recibo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
