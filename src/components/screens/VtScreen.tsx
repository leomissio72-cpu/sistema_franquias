import React, { useState, useEffect } from "react";
import { VTConfig, VTEmployeeItem, VTPaymentRecord, ScreenType, UserSession, ManualEntry } from "../../types";
import { formatBrl, formatBrl2, getBusinessDaysInMonth, getBusinessDaysRange } from "../../utils/calculations";
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
  Calendar,
  History,
  FileCheck,
  Receipt,
  CalendarDays,
  ArrowRight,
  Info
} from "lucide-react";

interface VtScreenProps {
  currentTenantId: string;
  vtConfigs: Record<string, VTConfig>;
  onSaveVtConfig: (tenantId: string, config: VTConfig) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
  userSession?: UserSession | null;
  manualEntries?: ManualEntry[];
  onCreateEntry?: (entry: Omit<ManualEntry, "id" | "created">) => Promise<void>;
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
    quantoJaFoiPagoNoMes: 220.0,
    diasPagosNoMes: 22,
    historicoPagamentos: [
      {
        id: "vtp_init_1",
        data: new Date().toISOString().slice(0, 10),
        dias: 22,
        valor: 220.0,
        periodoRef: "Mês Cheio (22 dias úteis)",
        dataInicio: "01/10/2026",
        dataFim: "31/10/2026",
        metodo: "Cartão Recarga Ticket",
        observacao: "Carga mensal completa"
      }
    ]
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
    statusRecarga: "processado",
    quantoJaFoiPagoNoMes: 112.35,
    diasPagosNoMes: 10,
    historicoPagamentos: [
      {
        id: "vtp_init_2",
        data: new Date().toISOString().slice(0, 10),
        dias: 10,
        valor: 112.35,
        periodoRef: "1ª Quinzena (10 dias úteis)",
        dataInicio: "01/10/2026",
        dataFim: "14/10/2026",
        metodo: "PIX",
        observacao: "Adiantamento 1ª quinzena"
      }
    ]
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
    quantoJaFoiPagoNoMes: 100.0,
    diasPagosNoMes: 10,
    historicoPagamentos: [
      {
        id: "vtp_init_3",
        data: new Date().toISOString().slice(0, 10),
        dias: 10,
        valor: 100.0,
        periodoRef: "Primeiros 10 dias úteis",
        metodo: "PIX",
        observacao: "Transferência bancária inicial"
      }
    ]
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
    statusRecarga: "pendente",
    quantoJaFoiPagoNoMes: 0,
    diasPagosNoMes: 0,
    historicoPagamentos: []
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
    quantoJaFoiPagoNoMes: 396.0,
    diasPagosNoMes: 22,
    historicoPagamentos: [
      {
        id: "vtp_init_5",
        data: new Date().toISOString().slice(0, 10),
        dias: 22,
        valor: 396.0,
        periodoRef: "Mês Completo via PIX (22 dias)",
        metodo: "PIX",
        observacao: "Crédito integral em conta para combustível"
      }
    ]
  }
];

export const VtScreen: React.FC<VtScreenProps> = ({
  currentTenantId,
  vtConfigs,
  onSaveVtConfig,
  onNavigate,
  userSession,
  manualEntries,
  onCreateEntry,
}) => {
  // Calculated business days in current month
  const businessDaysInfo = getBusinessDaysInMonth();

  const currentConfig: VTConfig = vtConfigs[currentTenantId] || {
    title: "Planilha VT Mensal - Benefício e Recarga",
    period: "Mês Vigente",
    rate: 10.0,
    days: businessDaysInfo.businessDays,
    format: "both",
    prefix: "VT_Folha",
    pix: true,
    notes: true,
    tenant: currentTenantId,
    periodoTipo: "mensal",
    descontoCltPct: 0.06,
    diasUteisCalculados: businessDaysInfo.businessDays,
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
  const [batchDaysValue, setBatchDaysValue] = useState(businessDaysInfo.businessDays);
  
  // Payment Launch & Receipt Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedEmpForPayment, setSelectedEmpForPayment] = useState<VTEmployeeItem | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
    tipoPeriodo: "proximos_7_dias" | "quinzena_1" | "quinzena_2" | "mes_cheio" | "customizado";
    dias: number;
    dataInicio: string;
    dataFim: string;
    valorCalculado: number;
    valorAjustado: number;
    metodo: string;
    observacao: string;
    lancarDespesa: boolean;
  }>({
    tipoPeriodo: "proximos_7_dias",
    dias: 7,
    dataInicio: new Date().toISOString().slice(0, 10),
    dataFim: getBusinessDaysRange(new Date(), 7).endDateStr,
    valorCalculado: 0,
    valorAjustado: 0,
    metodo: "PIX",
    observacao: "",
    lancarDespesa: true,
  });

  // Printable Receipt View Modal
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceiptRecord, setActiveReceiptRecord] = useState<{
    emp: VTEmployeeItem;
    record: VTPaymentRecord;
  } | null>(null);

  // History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyEmp, setHistoryEmp] = useState<VTEmployeeItem | null>(null);

  // New Employee Form state
  const [empForm, setEmpForm] = useState<Partial<VTEmployeeItem>>({
    nome: "",
    mat: "",
    setor: "Atendimento",
    operadora: "Bilhete Único SP (SPTrans)",
    cartaoNumero: "",
    tarifaIda: 5.0,
    tarifaVolta: 5.0,
    diasPrevistos: businessDaysInfo.businessDays,
    faltas: 0,
    salarioBase: 2000.0,
    uberAdicional: 0,
    statusRecarga: "pendente",
  });

  // Keep state synced when tenant changes
  useEffect(() => {
    const config = vtConfigs[currentTenantId] || {
      ...currentConfig,
      employees: defaultEmployees,
    };
    setForm(config);
    if (config.employees && config.employees.length > 0) {
      setEmployees(config.employees);
    }
  }, [currentTenantId, vtConfigs]);

  // Calculate detailed financial values for an employee
  const calculateEmpValues = (emp: VTEmployeeItem) => {
    const diaria = (emp.tarifaIda || 0) + (emp.tarifaVolta || 0);
    const diasEfetivos = Math.max(0, (emp.diasPrevistos || form.days || 22) - (emp.faltas || 0));
    const custoVtPassagens = diaria * diasEfetivos;
    const custoTotalVt = custoVtPassagens + (emp.uberAdicional || 0);

    // Regra CLT: Desconto de até 6% do salário base ou o valor total do benefício
    const tetoDescontoClt = (emp.salarioBase || 0) * (form.descontoCltPct || 0.06);
    const descontoEfetivo = Math.min(custoTotalVt, tetoDescontoClt);
    const subsidioEmpresa = Math.max(0, custoTotalVt - descontoEfetivo);

    // Paid tracking in current month
    const jaPago = emp.quantoJaFoiPagoNoMes || 0;
    const saldoRestante = Math.max(0, custoTotalVt - jaPago);
    const pctPago = custoTotalVt > 0 ? Math.min(100, Math.round((jaPago / custoTotalVt) * 100)) : 0;

    let statusPagamento: "quitado" | "parcial" | "pendente" = "pendente";
    if (jaPago >= custoTotalVt && custoTotalVt > 0) {
      statusPagamento = "quitado";
    } else if (jaPago > 0) {
      statusPagamento = "parcial";
    }

    return {
      diaria,
      diasEfetivos,
      custoTotalVt,
      tetoDescontoClt,
      descontoEfetivo,
      subsidioEmpresa,
      jaPago,
      saldoRestante,
      pctPago,
      statusPagamento,
    };
  };

  // Aggregated totals
  const totals = employees.reduce(
    (acc, emp) => {
      const calc = calculateEmpValues(emp);
      acc.totalConcedido += calc.custoTotalVt;
      acc.totalDescontoClt += calc.descontoEfetivo;
      acc.totalSubsidioEmpresa += calc.subsidioEmpresa;
      acc.totalJaPago += calc.jaPago;
      acc.totalSaldoRestante += calc.saldoRestante;

      if (calc.statusPagamento === "quitado") {
        acc.qtdQuitados++;
      } else if (calc.statusPagamento === "parcial") {
        acc.qtdParciais++;
      } else {
        acc.qtdPendentes++;
      }
      return acc;
    },
    {
      totalConcedido: 0,
      totalDescontoClt: 0,
      totalSubsidioEmpresa: 0,
      totalJaPago: 0,
      totalSaldoRestante: 0,
      qtdQuitados: 0,
      qtdParciais: 0,
      qtdPendentes: 0,
    }
  );

  // Save to cloud
  const handleSave = async (updatedEmployeesList?: VTEmployeeItem[]) => {
    const listToSave = updatedEmployeesList || employees;
    const updatedConfig: VTConfig = {
      ...form,
      diasUteisCalculados: businessDaysInfo.businessDays,
      employees: listToSave,
    };
    await onSaveVtConfig(currentTenantId, updatedConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Synchronize business days automatically to all employees
  const handleApplyAutoBusinessDays = () => {
    const autoDays = businessDaysInfo.businessDays;
    const updated = employees.map((e) => ({
      ...e,
      diasPrevistos: autoDays,
    }));
    setEmployees(updated);
    setForm((p) => ({ ...p, days: autoDays, diasUteisCalculados: autoDays }));
    handleSave(updated);
  };

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    if (statusFilter !== "all") {
      const calc = calculateEmpValues(emp);
      if (statusFilter === "quitado" && calc.statusPagamento !== "quitado") return false;
      if (statusFilter === "parcial" && calc.statusPagamento !== "parcial") return false;
      if (statusFilter === "pendente" && calc.statusPagamento !== "pendente") return false;
    }

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

  // Inline adjuster for absences
  const updateEmployeeFaltas = (id: string, delta: number) => {
    const updated = employees.map((e) => {
      if (e.id !== id) return e;
      const newFaltas = Math.max(0, (e.faltas || 0) + delta);
      return { ...e, faltas: newFaltas };
    });
    setEmployees(updated);
    handleSave(updated);
  };

  // Open Payment Modal for employee
  const openPaymentModalForEmployee = (emp: VTEmployeeItem) => {
    const calc = calculateEmpValues(emp);
    const defaultDias = 7;
    const diaria = calc.diaria;
    const valSugerido = Math.min(calc.saldoRestante, diaria * defaultDias);
    const range = getBusinessDaysRange(new Date(), defaultDias);

    setSelectedEmpForPayment(emp);
    setPaymentForm({
      tipoPeriodo: "proximos_7_dias",
      dias: defaultDias,
      dataInicio: new Date().toISOString().slice(0, 10),
      dataFim: range.endDateStr,
      valorCalculado: valSugerido,
      valorAjustado: Number(valSugerido.toFixed(2)),
      metodo: emp.operadora.includes("Ticket") || emp.operadora.includes("Combustível") ? "Cartão Recarga Ticket" : "PIX",
      observacao: `Pagamento de VT referente a ${defaultDias} dias úteis (${range.formattedRange})`,
      lancarDespesa: true,
    });
    setIsPaymentModalOpen(true);
  };

  // Handle changing preset period in Payment Modal
  const handlePeriodPresetChange = (preset: "proximos_7_dias" | "quinzena_1" | "quinzena_2" | "mes_cheio" | "customizado", customDays?: number) => {
    if (!selectedEmpForPayment) return;
    const calc = calculateEmpValues(selectedEmpForPayment);
    let days = customDays ?? 7;
    let descRef = "";

    if (preset === "proximos_7_dias") {
      days = 7;
      descRef = "Próximos 7 dias úteis";
    } else if (preset === "quinzena_1") {
      days = Math.round(calc.diasEfetivos / 2);
      descRef = "1ª Quinzena";
    } else if (preset === "quinzena_2") {
      days = calc.diasEfetivos - Math.round(calc.diasEfetivos / 2);
      descRef = "2ª Quinzena";
    } else if (preset === "mes_cheio") {
      days = calc.diasEfetivos;
      descRef = "Mês Cheio";
    }

    const range = getBusinessDaysRange(new Date(), days);
    const calculatedVal = Math.min(calc.saldoRestante > 0 ? calc.saldoRestante : calc.custoTotalVt, calc.diaria * days);

    setPaymentForm((prev) => ({
      ...prev,
      tipoPeriodo: preset,
      dias: days,
      dataFim: range.endDateStr,
      valorCalculado: calculatedVal,
      valorAjustado: Number(calculatedVal.toFixed(2)),
      observacao: `Pagamento de VT referente a ${descRef} (${range.formattedRange})`,
    }));
  };

  // Submit Payment Launch & Open Printable Receipt
  const handleConfirmPaymentAndEmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForPayment) return;

    const emp = selectedEmpForPayment;
    const calc = calculateEmpValues(emp);
    const valorPago = Number(paymentForm.valorAjustado) || 0;
    const diasPagos = Number(paymentForm.dias) || 0;

    const newRecord: VTPaymentRecord = {
      id: "vtp_" + Date.now(),
      data: new Date().toISOString().slice(0, 10),
      dias: diasPagos,
      valor: valorPago,
      periodoRef: `Período: ${paymentForm.dataInicio} a ${paymentForm.dataFim} (${diasPagos} dias úteis)`,
      dataInicio: paymentForm.dataInicio,
      dataFim: paymentForm.dataFim,
      metodo: paymentForm.metodo,
      observacao: paymentForm.observacao,
      descontoCltAbatido: calc.diasEfetivos > 0 ? Number(((calc.descontoEfetivo * diasPagos) / calc.diasEfetivos).toFixed(2)) : 0,
      registradoPor: userSession?.name || "Gestor de Franquias",
    };

    const novoHistorico = [newRecord, ...(emp.historicoPagamentos || [])];
    const novoQuantoJaFoiPago = (emp.quantoJaFoiPagoNoMes || 0) + valorPago;
    const novoDiasPagos = (emp.diasPagosNoMes || 0) + diasPagos;

    const novoStatusRecarga =
      novoQuantoJaFoiPago >= calc.custoTotalVt
        ? "creditado"
        : novoQuantoJaFoiPago > 0
        ? "processado"
        : "pendente";

    const updatedEmployees = employees.map((eItem) => {
      if (eItem.id !== emp.id) return eItem;
      return {
        ...eItem,
        quantoJaFoiPagoNoMes: Number(novoQuantoJaFoiPago.toFixed(2)),
        diasPagosNoMes: novoDiasPagos,
        statusRecarga: novoStatusRecarga as any,
        historicoPagamentos: novoHistorico,
      };
    });

    setEmployees(updatedEmployees);
    await handleSave(updatedEmployees);

    // Register financial expense if requested and handler exists
    if (paymentForm.lancarDespesa && onCreateEntry) {
      try {
        await onCreateEntry({
          tenant: currentTenantId,
          type: "despesa",
          date: new Date().toISOString().slice(0, 10),
          value: valorPago,
          desc: `Vale Transporte - ${emp.nome} (${diasPagos} dias)`,
          catId: "vt",
          catName: "Vale Transporte",
          pay: paymentForm.metodo || "PIX",
          note: paymentForm.observacao,
          conciliationStatus: "matched",
        });
      } catch (err) {
        console.error("Erro ao lançar despesa de VT:", err);
      }
    }

    setIsPaymentModalOpen(false);
    
    // Open Receipt Preview Modal
    const updatedEmp = updatedEmployees.find((e) => e.id === emp.id) || emp;
    setActiveReceiptRecord({
      emp: updatedEmp,
      record: newRecord,
    });
    setIsReceiptModalOpen(true);
  };

  // Delete payment record from history
  const handleDeletePaymentRecord = async (empId: string, recordId: string) => {
    if (!confirm("Tem certeza que deseja cancelar e excluir este registro de pagamento de VT?")) return;

    const updatedEmployees = employees.map((emp) => {
      if (emp.id !== empId) return emp;
      const history = emp.historicoPagamentos || [];
      const filteredHistory = history.filter((r) => r.id !== recordId);

      const novoQuantoJaFoiPago = filteredHistory.reduce((sum, r) => sum + (r.valor || 0), 0);
      const novoDiasPagos = filteredHistory.reduce((sum, r) => sum + (r.dias || 0), 0);
      const calc = calculateEmpValues(emp);

      const novoStatus =
        novoQuantoJaFoiPago >= calc.custoTotalVt
          ? "creditado"
          : novoQuantoJaFoiPago > 0
          ? "processado"
          : "pendente";

      return {
        ...emp,
        quantoJaFoiPagoNoMes: Number(novoQuantoJaFoiPago.toFixed(2)),
        diasPagosNoMes: novoDiasPagos,
        statusRecarga: novoStatus as any,
        historicoPagamentos: filteredHistory,
      };
    });

    setEmployees(updatedEmployees);
    await handleSave(updatedEmployees);

    if (historyEmp && historyEmp.id === empId) {
      setHistoryEmp(updatedEmployees.find((e) => e.id === empId) || null);
    }
  };

  // Add or edit employee
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.nome?.trim()) return;

    let updatedList: VTEmployeeItem[] = [];

    if (editingEmployee) {
      updatedList = employees.map((emp) =>
        emp.id === editingEmployee.id
          ? ({ ...emp, ...empForm } as VTEmployeeItem)
          : emp
      );
      setEditingEmployee(null);
    } else {
      const newEmp: VTEmployeeItem = {
        id: "vt_" + Date.now(),
        nome: empForm.nome.trim(),
        mat: empForm.mat?.trim() || String(Math.floor(1000 + Math.random() * 9000)),
        setor: empForm.setor || "Geral",
        operadora: empForm.operadora || "Bilhete Único SP (SPTrans)",
        cartaoNumero: empForm.cartaoNumero || "0000.0000.0000",
        tarifaIda: Number(empForm.tarifaIda) || 5.0,
        tarifaVolta: Number(empForm.tarifaVolta) || 5.0,
        diasPrevistos: Number(empForm.diasPrevistos) || businessDaysInfo.businessDays,
        faltas: Number(empForm.faltas) || 0,
        salarioBase: Number(empForm.salarioBase) || 2000.0,
        uberAdicional: Number(empForm.uberAdicional) || 0,
        statusRecarga: "pendente",
        quantoJaFoiPagoNoMes: 0,
        diasPagosNoMes: 0,
        historicoPagamentos: [],
      };
      updatedList = [...employees, newEmp];
    }

    setEmployees(updatedList);
    handleSave(updatedList);
    setIsAddModalOpen(false);

    setEmpForm({
      nome: "",
      mat: "",
      setor: "Atendimento",
      operadora: "Bilhete Único SP (SPTrans)",
      cartaoNumero: "",
      tarifaIda: 5.0,
      tarifaVolta: 5.0,
      diasPrevistos: businessDaysInfo.businessDays,
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
      const updated = employees.filter((e) => e.id !== id);
      setEmployees(updated);
      handleSave(updated);
    }
  };

  // Batch actions
  const applyBatchDays = () => {
    const updated = employees.map((e) => ({ ...e, diasPrevistos: batchDaysValue }));
    setEmployees(updated);
    setForm((prev) => ({ ...prev, days: batchDaysValue }));
    handleSave(updated);
    setIsBatchDaysModalOpen(false);
  };

  // CSV Exports
  const handleDownloadCsvRecarga = () => {
    const rows = [
      [
        "Nome do Colaborador",
        "Matrícula",
        "Operadora do Cartão",
        "Número do Cartão",
        "Dias Efetivos",
        "Custo Total Mês (R$)",
        "Já Pago no Mês (R$)",
        "Saldo Restante (R$)",
        "Status Pagamento",
      ],
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
        calc.jaPago.toFixed(2),
        calc.saldoRestante.toFixed(2),
        calc.statusPagamento,
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
        "Já Pago (R$)",
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
        calc.jaPago.toFixed(2),
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
    <div className="space-y-3.5 animate-in fade-in duration-150">
      {/* Top Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
            <FileSpreadsheet className="h-4.5 w-4.5 text-[#3c63da]" />
            Vale Transporte & Mobilidade (CLT)
          </h3>
          <p className="text-xs text-[#69778c]">
            Gestão de recargas, cálculo do desconto de 6% CLT e comprovantes de entrega de benefício.
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
            <span>Pedido Recarga (CSV)</span>
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
            onClick={() => handleSave()}
            className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer transition-all"
          >
            {isSaved ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
            <span>{isSaved ? "Salvo na Nuvem!" : "Salvar na Nuvem"}</span>
          </button>
        </div>
      </div>

      {/* Automatic Business Days Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#edf2ff] via-white to-[#f4f7ff] border border-[#d2defa] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3c63da] text-white shadow-xs shrink-0">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#3c63da]/10 text-[#3c63da] px-2 py-0.5 rounded-md">
                Cálculo Automático de Calendário
              </span>
              <span className="text-xs text-[#69778c]">
                {businessDaysInfo.monthName} / {businessDaysInfo.year}
              </span>
            </div>
            <h4 className="text-sm font-bold text-[#152238] mt-0.5">
              O mês atual tem <span className="text-[#3c63da] font-extrabold">{businessDaysInfo.businessDays} dias úteis</span> calculados de 2ª a 6ª feira.
            </h4>
            <p className="text-[11px] text-[#69778c]">
              Total de dias no mês: {businessDaysInfo.totalDays} dias. Utilize o botão ao lado para aplicar este valor a todos os cadastros.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <button
            onClick={handleApplyAutoBusinessDays}
            className="flex items-center gap-1.5 rounded-xl bg-white border border-[#3c63da] text-[#3c63da] hover:bg-[#3c63da] hover:text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>Aplicar {businessDaysInfo.businessDays} Dias a Todos</span>
          </button>
          <button
            onClick={() => setIsBatchDaysModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f8faff] cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-[#69778c]" />
            <span>Personalizar</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Total Previsto VT Mês
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold text-[#152238] block mt-1 font-mono">
            {formatBrl(totals.totalConcedido)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            {employees.length} colaboradores ativos
          </small>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Já Pago no Mês</span>
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold text-emerald-800 block mt-1 font-mono">
            {formatBrl(totals.totalJaPago)}
          </strong>
          <small className="text-[11px] text-emerald-700 block mt-0.5">
            {totals.totalConcedido > 0
              ? `${Math.round((totals.totalJaPago / totals.totalConcedido) * 100)}% do total quitado`
              : "Sem pagamentos"}
          </small>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            <span>Saldo a Pagar</span>
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold text-amber-800 block mt-1 font-mono">
            {formatBrl(totals.totalSaldoRestante)}
          </strong>
          <small className="text-[11px] text-amber-700 block mt-0.5">
            Valor pendente para o mês
          </small>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3c63da] block">
            Custo Franqueadora
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold text-[#3c63da] block mt-1 font-mono">
            {formatBrl(totals.totalSubsidioEmpresa)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Subsídio absorvido na loja
          </small>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-xs col-span-2 lg:col-span-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 block">
            Desconto CLT (6%)
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold text-purple-700 block mt-1 font-mono">
            {formatBrl(totals.totalDescontoClt)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Desconto legal em folha
          </small>
        </div>
      </div>

      {/* Options & Search Filters Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#e5eaf1] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
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
              <option value="all">Todos os Status de Pagamento</option>
              <option value="quitado">🟢 Totalmente Quitado</option>
              <option value="parcial">🟡 Parcialmente Pago</option>
              <option value="pendente">🔴 Pagamento Pendente</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#69778c]">
            <span className="font-bold text-[#152238]">{totals.qtdQuitados}</span> quitados
            <span>•</span>
            <span className="font-bold text-amber-700">{totals.qtdParciais}</span> parciais
            <span>•</span>
            <span className="font-bold text-rose-600">{totals.qtdPendentes}</span> pendentes
          </div>
        </div>

        {/* Legal CLT Rules strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#e5eaf1] text-[11px] text-[#69778c]">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>
              <strong>Regra Legislação CLT (Lei 7.418/85):</strong> O desconto do VT limita-se a até <strong>6% do salário base</strong>. O excedente é subsidado pela empresa.
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span>Periodicidade Padrão:</span>
            <span className="font-bold text-[#152238] bg-[#f8faff] px-2 py-0.5 rounded-md border border-[#e5eaf1]">
              Mensal com Recibo Fracionado
            </span>
          </div>
        </div>
      </div>

      {/* Main Table: Employees & VT Status */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#e5eaf1] flex items-center justify-between bg-[#f8faff]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#152238]">
              Colaboradores & Controle de Pagamentos de VT ({filteredEmployees.length})
            </h3>
            <span className="text-[10px] bg-[#edf2ff] text-[#3c63da] font-extrabold px-2 py-0.5 rounded-full">
              {currentTenantId}
            </span>
          </div>
          <div className="text-xs text-[#69778c]">
            Clique no botão <strong>Lançar Pagamento / Recibo</strong> para registrar pagamentos por período.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                <th className="p-3.5">Colaborador / Setor</th>
                <th className="p-3.5">Operadora & Cartão</th>
                <th className="p-3.5 text-center">Diária (Ida/Volta)</th>
                <th className="p-3.5 text-center">Dias / Faltas</th>
                <th className="p-3.5 text-right">Previsto Mês</th>
                <th className="p-3.5 text-center">Já Pago / Saldo</th>
                <th className="p-3.5 text-right">Desconto CLT</th>
                <th className="p-3.5 text-right">Custo Loja</th>
                <th className="p-3.5 text-center">Ações & Recibo</th>
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
                      {/* Employee name & sector */}
                      <td className="p-3.5">
                        <div className="font-bold text-[#152238] flex items-center gap-1.5">
                          <span>{emp.nome}</span>
                          {(emp.historicoPagamentos && emp.historicoPagamentos.length > 0) && (
                            <span
                              title={`${emp.historicoPagamentos.length} pagamento(s) registrado(s)`}
                              className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold bg-[#edf2ff] text-[#3c63da] px-1.5 py-0.5 rounded-full"
                            >
                              <History className="h-2.5 w-2.5" />
                              {emp.historicoPagamentos.length}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#69778c] flex items-center gap-1.5 mt-0.5">
                          <span>Mat: {emp.mat}</span>
                          <span>•</span>
                          <span className="text-[#3c63da] font-semibold">{emp.setor}</span>
                          <span>•</span>
                          <span className="font-mono">Sal: {formatBrl(emp.salarioBase)}</span>
                        </div>
                      </td>

                      {/* Operator & card */}
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
                          {formatBrl(emp.tarifaIda)} + {formatBrl(emp.tarifaVolta)}
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
                              title="Lançar +1 falta"
                            >
                              +
                            </button>
                            <button
                              onClick={() => updateEmployeeFaltas(emp.id, -1)}
                              className="h-5 w-5 rounded bg-white text-emerald-700 font-bold hover:bg-emerald-100 flex items-center justify-center text-xs border border-emerald-200 cursor-pointer"
                              title="Remover 1 falta"
                            >
                              −
                            </button>
                          </div>
                        </div>
                        {emp.uberAdicional ? (
                          <div className="text-[10px] text-purple-700 font-bold mt-1">
                            + {formatBrl(emp.uberAdicional)} Mobilidade
                          </div>
                        ) : null}
                      </td>

                      {/* Total Expected Month */}
                      <td className="p-3.5 text-right font-mono font-bold text-[#152238]">
                        {formatBrl(calc.custoTotalVt)}
                      </td>

                      {/* Already Paid vs Remaining Balance Progress */}
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-emerald-800">
                              {formatBrl(calc.jaPago)}
                            </span>
                            <span className="text-[10px] text-[#69778c]">pago</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden my-1 border border-gray-200">
                            <div
                              className={`h-full transition-all duration-300 ${
                                calc.statusPagamento === "quitado"
                                  ? "bg-emerald-500"
                                  : calc.statusPagamento === "parcial"
                                  ? "bg-amber-500"
                                  : "bg-gray-300"
                              }`}
                              style={{ width: `${calc.pctPago}%` }}
                            />
                          </div>

                          <div className="text-[10px]">
                            {calc.statusPagamento === "quitado" ? (
                              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                🟢 Quitado ({calc.pctPago}%)
                              </span>
                            ) : calc.statusPagamento === "parcial" ? (
                              <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                🟡 Resta {formatBrl(calc.saldoRestante)}
                              </span>
                            ) : (
                              <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                🔴 R$ {calc.custoTotalVt.toFixed(0)} pendente
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CLT 6% Deduction */}
                      <td className="p-3.5 text-right">
                        <div className="font-mono font-bold text-purple-700">
                          {formatBrl(calc.descontoEfetivo)}
                        </div>
                        <span className="text-[9px] text-[#69778c]">
                          {calc.descontoEfetivo < calc.tetoDescontoClt
                            ? "Custo menor que 6%"
                            : "Teto de 6%"}
                        </span>
                      </td>

                      {/* Net Company Cost */}
                      <td className="p-3.5 text-right font-mono font-bold text-[#3c63da]">
                        {formatBrl(calc.subsidioEmpresa)}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openPaymentModalForEmployee(emp)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3c63da] text-white hover:bg-[#2f52c0] font-bold text-[11px] shadow-2xs cursor-pointer transition-all"
                            title="Lançar Pagamento do Período e Gerar Recibo"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            <span>Lançar Pagamento</span>
                          </button>

                          {(emp.historicoPagamentos && emp.historicoPagamentos.length > 0) && (
                            <button
                              onClick={() => {
                                setHistoryEmp(emp);
                                setIsHistoryModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg border border-[#e5eaf1] bg-white text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] cursor-pointer transition-colors"
                              title="Ver Histórico de Pagamentos e Recibos"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 rounded-lg border border-[#e5eaf1] bg-white text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] cursor-pointer transition-colors"
                            title="Editar colaborador"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="p-1.5 rounded-lg border border-[#e5eaf1] bg-white text-[#69778c] hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Remover cadastro"
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
            Listando <strong>{filteredEmployees.length}</strong> colaboradores. Unidade: <strong>{currentTenantId}</strong>.
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono font-bold">
            <div>
              <span className="text-[#69778c] font-sans text-[11px] mr-1">Previsto:</span>
              <span className="text-[#152238]">{formatBrl(totals.totalConcedido)}</span>
            </div>
            <div>
              <span className="text-[#69778c] font-sans text-[11px] mr-1">Já Pago:</span>
              <span className="text-emerald-700">{formatBrl(totals.totalJaPago)}</span>
            </div>
            <div>
              <span className="text-[#69778c] font-sans text-[11px] mr-1">A Pagar:</span>
              <span className="text-amber-800">{formatBrl(totals.totalSaldoRestante)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: LANÇAR PAGAMENTO FRACIONADO E EMITIR RECIBO            */}
      {/* ------------------------------------------------------------- */}
      {isPaymentModalOpen && selectedEmpForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-xl max-h-[90vh] my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="shrink-0 p-4 sm:p-5 border-b border-[#e5eaf1] flex items-center justify-between bg-[#f8faff]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3c63da] text-white">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#152238]">
                    Lançar Pagamento de VT & Emitir Recibo
                  </h3>
                  <p className="text-xs text-[#69778c]">
                    Colaborador: <strong>{selectedEmpForPayment.nome}</strong> (Mat: {selectedEmpForPayment.mat})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-white border border-[#e5eaf1] flex items-center justify-center text-[#69778c] hover:bg-[#f4f7fb] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPaymentAndEmitReceipt} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* Summary Stats Badge */}
              {(() => {
                const c = calculateEmpValues(selectedEmpForPayment);
                return (
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
                    <div>
                      <span className="text-[10px] text-[#69778c] uppercase font-bold block">Total Previsto Mês</span>
                      <strong className="text-sm font-mono text-[#152238]">{formatBrl(c.custoTotalVt)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#69778c] uppercase font-bold block">Já Pago Anteriormente</span>
                      <strong className="text-sm font-mono text-emerald-700">{formatBrl(c.jaPago)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#69778c] uppercase font-bold block">Saldo Restante Mês</span>
                      <strong className="text-sm font-mono text-amber-800">{formatBrl(c.saldoRestante)}</strong>
                    </div>
                  </div>
                );
              })()}

              {/* Period Presets */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1.5">
                  Selecione o Período de Pagamento
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePeriodPresetChange("proximos_7_dias")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                      paymentForm.tipoPeriodo === "proximos_7_dias"
                        ? "bg-[#3c63da] text-white border-[#3c63da] shadow-xs"
                        : "bg-white text-[#152238] border-[#e5eaf1] hover:bg-[#f8faff]"
                    }`}
                  >
                    Próximos 7 Dias
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePeriodPresetChange("quinzena_1")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                      paymentForm.tipoPeriodo === "quinzena_1"
                        ? "bg-[#3c63da] text-white border-[#3c63da] shadow-xs"
                        : "bg-white text-[#152238] border-[#e5eaf1] hover:bg-[#f8faff]"
                    }`}
                  >
                    1ª Quinzena
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePeriodPresetChange("quinzena_2")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                      paymentForm.tipoPeriodo === "quinzena_2"
                        ? "bg-[#3c63da] text-white border-[#3c63da] shadow-xs"
                        : "bg-white text-[#152238] border-[#e5eaf1] hover:bg-[#f8faff]"
                    }`}
                  >
                    2ª Quinzena
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePeriodPresetChange("mes_cheio")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                      paymentForm.tipoPeriodo === "mes_cheio"
                        ? "bg-[#3c63da] text-white border-[#3c63da] shadow-xs"
                        : "bg-white text-[#152238] border-[#e5eaf1] hover:bg-[#f8faff]"
                    }`}
                  >
                    Mês Completo
                  </button>
                </div>
              </div>

              {/* Number of Days and Dates Range */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Nº de Dias Úteis
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={paymentForm.dias}
                    onChange={(e) => {
                      const d = parseInt(e.target.value || "1", 10);
                      handlePeriodPresetChange("customizado", d);
                    }}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] bg-[#f8faff]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={paymentForm.dataInicio}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, dataInicio: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-[#f8faff]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Data Final (Est.)
                  </label>
                  <input
                    type="text"
                    value={paymentForm.dataFim}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, dataFim: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-[#f8faff]"
                  />
                </div>
              </div>

              {/* Amount to be Paid (Editable) & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Valor a Pagar / Creditar (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={paymentForm.valorAjustado}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, valorAjustado: parseFloat(e.target.value || "0") }))}
                    className="w-full rounded-xl border border-[#3c63da] px-3 py-2 text-sm font-mono font-extrabold text-[#3c63da] bg-[#edf2ff] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#69778c] block mt-0.5">
                    Valor calculado: {formatBrl(paymentForm.valorCalculado)}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={paymentForm.metodo}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, metodo: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2.5 text-xs font-bold text-[#152238] bg-[#f8faff]"
                  >
                    <option value="PIX">PIX / Transferência Direta</option>
                    <option value="Cartão Recarga Ticket">Cartão Recarga Ticket / TOP</option>
                    <option value="Dinheiro">Dinheiro em Espécie</option>
                    <option value="Conta Salário">Conta Salário / Folha</option>
                  </select>
                </div>
              </div>

              {/* Observation */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Observações no Recibo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Adiantamento da 2ª semana do mês"
                  value={paymentForm.observacao}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, observacao: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-[#f8faff]"
                />
              </div>

              {/* Financial Expense Checkbox */}
              {onCreateEntry && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentForm.lancarDespesa}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, lancarDespesa: e.target.checked }))}
                    className="rounded text-[#3c63da] h-4 w-4"
                  />
                  <div>
                    <span className="font-bold text-xs">Lançar automaticamente em Despesas / Extrato Financeiro</span>
                    <p className="text-[10px] text-emerald-700">
                      Cria uma entrada de despesa "Vale Transporte" identificada para conciliação bancária.
                    </p>
                  </div>
                </label>
              )}

              </div>

              {/* Submit buttons */}
              <div className="shrink-0 p-3.5 sm:p-4 border-t border-[#e5eaf1] flex items-center justify-end gap-2 bg-[#f8faff]">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="rounded-xl border border-[#e5eaf1] bg-white px-4 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#3c63da] px-5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>Confirmar & Gerar Recibo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: HISTÓRICO DE PAGAMENTOS DO COLABORADOR                 */}
      {/* ------------------------------------------------------------- */}
      {isHistoryModalOpen && historyEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-2xl max-h-[90vh] my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="shrink-0 p-4 border-b border-[#e5eaf1] bg-[#f8faff] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-[#3c63da]" />
                <h3 className="text-base font-extrabold text-[#152238]">
                  Histórico de Pagamentos — {historyEmp.nome}
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-white border border-[#e5eaf1] flex items-center justify-center text-[#69778c] hover:bg-[#f4f7fb] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="flex justify-between items-center p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
                <div>Matrícula: <strong>{historyEmp.mat}</strong></div>
                <div>Setor: <strong>{historyEmp.setor}</strong></div>
                <div>Total Pago no Mês: <strong className="text-emerald-700 font-mono">{formatBrl(historyEmp.quantoJaFoiPagoNoMes || 0)}</strong></div>
              </div>

              <div className="max-h-80 overflow-y-auto border border-[#e5eaf1] rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] border-b border-[#e5eaf1]">
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Período / Referência</th>
                      <th className="p-2.5 text-center">Dias</th>
                      <th className="p-2.5 text-right">Valor Pago</th>
                      <th className="p-2.5 text-center">Método</th>
                      <th className="p-2.5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5eaf1]">
                    {(!historyEmp.historicoPagamentos || historyEmp.historicoPagamentos.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-[#69778c]">
                          Nenhum recibo ou pagamento registrado para este colaborador.
                        </td>
                      </tr>
                    ) : (
                      historyEmp.historicoPagamentos.map((rec) => (
                        <tr key={rec.id} className="hover:bg-[#f8faff]">
                          <td className="p-2.5 font-mono text-[#152238] font-bold">{rec.data}</td>
                          <td className="p-2.5">
                            <div className="font-semibold text-[#152238]">{rec.periodoRef}</div>
                            {rec.observacao && <div className="text-[10px] text-[#69778c]">{rec.observacao}</div>}
                          </td>
                          <td className="p-2.5 text-center font-bold">{rec.dias} dias</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatBrl(rec.valor)}</td>
                          <td className="p-2.5 text-center text-[10px] font-bold bg-[#edf2ff] text-[#3c63da] rounded-md">{rec.metodo || "PIX"}</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setActiveReceiptRecord({ emp: historyEmp, record: rec });
                                  setIsHistoryModalOpen(false);
                                  setIsReceiptModalOpen(true);
                                }}
                                className="p-1 rounded bg-[#edf2ff] text-[#3c63da] hover:bg-[#3c63da] hover:text-white transition-colors cursor-pointer"
                                title="Ver / Imprimir Recibo"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePaymentRecord(historyEmp.id, rec.id)}
                                className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                                title="Excluir lançamento"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="shrink-0 p-3.5 sm:p-4 bg-[#f8faff] border-t border-[#e5eaf1] flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#152238] text-white font-bold text-xs cursor-pointer hover:bg-[#253654]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: COMPROVANTE FORMAL E RECIBO DE VALE TRANSPORTE (PDF)   */}
      {/* ------------------------------------------------------------- */}
      {isReceiptModalOpen && activeReceiptRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-2xl max-h-[90vh] my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="shrink-0 p-3.5 sm:p-4 border-b border-[#e5eaf1] flex items-center justify-between bg-[#f8faff] print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-[#3c63da]" />
                <h3 className="text-base font-extrabold text-[#152238]">
                  Comprovante de Entrega & Declaração de Vale Transporte (CLT)
                </h3>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-white border border-[#e5eaf1] flex items-center justify-center text-[#69778c] hover:bg-[#f4f7fb] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Document Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs text-[#152238] leading-relaxed bg-white">
              {/* Receipt Header */}
              <div className="flex justify-between items-start border-b-2 border-[#152238] pb-3">
                <div>
                  <h2 className="text-lg font-extrabold uppercase tracking-tight text-[#152238]">
                    Declaração e Recibo de Vale-Transporte
                  </h2>
                  <p className="text-[11px] text-[#69778c]">
                    Lei Federal nº 7.418/1985 e Decreto nº 95.247/1987
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#69778c] block">Unidade Franqueada</span>
                  <strong className="text-sm font-extrabold text-[#3c63da]">{currentTenantId}</strong>
                  <div className="text-[10px] text-[#69778c]">Data: {activeReceiptRecord.record.data}</div>
                </div>
              </div>

              {/* Employee & Unit Information */}
              <div className="p-3.5 rounded-xl border border-[#e5eaf1] bg-[#f8f9fc] space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>Colaborador: <strong>{activeReceiptRecord.emp.nome}</strong></div>
                  <div>Matrícula: <strong>{activeReceiptRecord.emp.mat}</strong></div>
                  <div>Cargo / Setor: <strong>{activeReceiptRecord.emp.setor}</strong></div>
                  <div>Salário Base: <strong>{formatBrl(activeReceiptRecord.emp.salarioBase)}</strong></div>
                  <div>Operadora: <strong>{activeReceiptRecord.emp.operadora}</strong></div>
                  <div>Cartão Nº: <strong>{activeReceiptRecord.emp.cartaoNumero || "N/I"}</strong></div>
                </div>
              </div>

              {/* Payment Details Table */}
              <div className="border border-[#e5eaf1] rounded-xl p-4 space-y-2 bg-white">
                <div className="flex justify-between font-bold text-[#152238] border-b border-[#e5eaf1] pb-2">
                  <span>Período de Referência:</span>
                  <span className="text-[#3c63da]">{activeReceiptRecord.record.periodoRef}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dias Efetivos Beneficiados:</span>
                  <strong>{activeReceiptRecord.record.dias} dias úteis</strong>
                </div>
                <div className="flex justify-between">
                  <span>Tarifa Diária (Ida + Volta):</span>
                  <strong>{formatBrl((activeReceiptRecord.emp.tarifaIda || 0) + (activeReceiptRecord.emp.tarifaVolta || 0))}</strong>
                </div>
                <div className="flex justify-between border-t border-[#e5eaf1] pt-1">
                  <span>Valor Total Entregue / Creditado neste Recibo:</span>
                  <strong className="text-emerald-700 font-mono text-sm">{formatBrl(activeReceiptRecord.record.valor)}</strong>
                </div>
                {activeReceiptRecord.record.descontoCltAbatido ? (
                  <div className="flex justify-between text-purple-800">
                    <span>Desconto Proporcional CLT 6% em Folha:</span>
                    <strong className="font-mono text-sm">− {formatBrl(activeReceiptRecord.record.descontoCltAbatido)}</strong>
                  </div>
                ) : null}
                <div className="flex justify-between text-[#69778c] text-[10px]">
                  <span>Forma de Entrega:</span>
                  <span className="font-bold text-[#152238]">{activeReceiptRecord.record.metodo || "PIX"}</span>
                </div>
              </div>

              {/* Legal Declaration Text */}
              <p className="text-[10px] text-[#69778c] italic text-justify leading-relaxed border-l-2 border-[#3c63da] pl-3 py-1 bg-[#f8faff]">
                "Declaro para os devidos fins legais ter recebido a quantia/crédito acima discriminada a título de Vale-Transporte, destinada exclusivamente ao meu deslocamento diário residência-trabalho e vice-versa, estando ciente de que o uso indevido do benefício constitui falta grave nos termos do artigo 7º, §3º do Decreto nº 95.247/1987."
              </p>

              {/* Signature Blocks */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-[#152238] pt-1">
                  <span className="font-bold block text-[#152238]">Franqueadora / Empregador</span>
                  <small className="text-[10px] text-[#69778c] block">Unidade {currentTenantId}</small>
                </div>
                <div className="border-t border-[#152238] pt-1">
                  <span className="font-bold block text-[#152238]">Assinatura do Colaborador</span>
                  <small className="text-[10px] text-[#69778c] block">{activeReceiptRecord.emp.nome}</small>
                </div>
              </div>
            </div>

            {/* Print Dialog Footer */}
            <div className="shrink-0 p-3.5 sm:p-4 bg-[#f8faff] border-t border-[#e5eaf1] flex justify-end gap-2 print:hidden">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#e5eaf1] bg-white text-xs font-bold text-[#152238] cursor-pointer hover:bg-[#f4f7fb]"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-[#3c63da] text-xs font-bold text-white flex items-center gap-1.5 shadow-sm cursor-pointer hover:bg-[#2f52c0]"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Recibo (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADICIONAR / EDITAR COLABORADOR                         */}
      {/* ------------------------------------------------------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-lg max-h-[90vh] my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="shrink-0 p-4 sm:p-5 border-b border-[#e5eaf1] flex items-center justify-between bg-[#f8faff]">
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

            <form onSubmit={handleSaveEmployee} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                      Dias Previstos no Mês
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={empForm.diasPrevistos ?? businessDaysInfo.businessDays}
                      onChange={(e) => setEmpForm((p) => ({ ...p, diasPrevistos: parseInt(e.target.value || "22", 10) }))}
                      className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                      Faltas
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
                    <strong className="text-sm font-mono text-purple-700">
                      {formatBrl(((empForm.salarioBase || 0) * 0.06))}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="shrink-0 p-3.5 sm:p-4 border-t border-[#e5eaf1] flex items-center justify-end gap-2 bg-[#f8faff]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-sm max-h-[90vh] my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="shrink-0 p-4 border-b border-[#e5eaf1] bg-[#f8faff] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#3c63da]" />
                <span>Definir Dias Úteis do Mês</span>
              </h3>
              <button
                onClick={() => setIsBatchDaysModalOpen(false)}
                className="h-7 w-7 rounded-lg bg-white border border-[#e5eaf1] flex items-center justify-center text-[#69778c] hover:bg-[#f4f7fb] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              <p className="text-[#69778c]">
                Escolha a quantidade de dias úteis para a previsão deste período:
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
            </div>

            <div className="shrink-0 p-3.5 sm:p-4 border-t border-[#e5eaf1] flex items-center justify-end gap-2 bg-[#f8faff]">
              <button
                onClick={() => setIsBatchDaysModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#e5eaf1] bg-white text-xs font-bold text-[#152238] hover:bg-[#f4f7fb]"
              >
                Cancelar
              </button>
              <button
                onClick={applyBatchDays}
                className="px-4 py-1.5 rounded-lg bg-[#3c63da] text-xs font-bold text-white shadow-xs hover:bg-[#2f52c0]"
              >
                Aplicar a Todos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
