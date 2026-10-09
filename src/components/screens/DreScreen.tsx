import React, { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { BillItem, FranchiseUnit, Business, ScreenType, DreParams, UserSession, ManualEntry, IntercompanyRule } from "../../types";
import {
  formatBrl,
  formatBrl2,
  formatPct,
  formatPct2,
  calculateDre,
  getBillDueStatus,
  parseVencimentoDate,
} from "../../utils/calculations";
import { dreExpenseDefs, defaultDreParams } from "../../data/initialData";
import { isIntercompanyEntry, findIntercompanyRule } from "../../utils/intercompany";
import {
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  Zap,
  Info,
  SlidersHorizontal,
  Save,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Store,
  DollarSign,
  Building2,
  Filter,
  BarChart2,
  LineChart,
  Tag,
  Eye,
  Check,
  X,
  Sliders,
  Download,
  AlertTriangle
} from "lucide-react";
import toast from "react-hot-toast";
import {
  DateMultiFilter,
  DateFilterSelection,
  AVAILABLE_DAYS,
  AVAILABLE_MONTHS,
  AVAILABLE_YEARS,
  CURRENT_YEAR,
  CURRENT_MONTH,
} from "../DateMultiFilter";

interface DreScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentTenantId: string;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
  onNavigate: (screen: ScreenType) => void;
  onSelectTenant: (tenantId: string) => void;
  onSaveParams?: (tenantId: string, params: DreParams) => Promise<void>;
  userSession?: UserSession | null;
  currentBusinessId?: string;
  onSelectBusiness?: (bizId: string) => void;
  bills?: BillItem[];
  manualEntries?: ManualEntry[];
  intercompanyRules?: IntercompanyRule[];
}

export const DreScreen: React.FC<DreScreenProps> = ({
  franchises,
  businesses,
  currentTenantId,
  dreParams,
  royalties,
  onNavigate,
  onSelectTenant,
  onSaveParams,
  userSession,
  currentBusinessId = "all",
  onSelectBusiness,
  bills = [],
  manualEntries = [],
  intercompanyRules = [],
}) => {
  // Main sub-tab: demonstrativo vs extrato (apuração baseada nos lançamentos reais)
  const [activeSubTab, setActiveSubTab] = useState<"demonstrativo" | "extrato">("demonstrativo");

  // -------------------------------------------------------------
  // Granular Date Selection (Ano, Mês e Dia)
  // -------------------------------------------------------------
  const [dateSelection, setDateSelection] = useState<DateFilterSelection>({
    years: [CURRENT_YEAR],
    months: AVAILABLE_MONTHS.map((m) => m.value),
    days: AVAILABLE_DAYS,
  });

  // Business & Franchise Filters
  const [selectedBusiness, setSelectedBusiness] = useState<string>(currentBusinessId || "all");
  const [selectedFranchise, setSelectedFranchise] = useState<string>(
    franchises.some((franchise) => franchise.id === currentTenantId) ? currentTenantId : "all"
  );

  const isOwner = userSession?.profile === "dono" || userSession?.profile === "equipe";
  const isAdmin = userSession?.profile === "admin";
  const isFranchisee = userSession?.profile === "franqueado" || userSession?.profile === "operador";

  // Sync selectedFranchise whenever currentTenantId changes
  useEffect(() => {
    if (franchises.some((franchise) => franchise.id === currentTenantId)) {
      setSelectedFranchise(currentTenantId);
    } else {
      setSelectedFranchise("all");
    }
  }, [currentTenantId, franchises]);

  // Sync selectedBusiness whenever currentBusinessId changes
  useEffect(() => {
    if (currentBusinessId) {
      setSelectedBusiness(currentBusinessId);
    }
  }, [currentBusinessId]);

  // Available franchises based on brand selection and user permissions
  const availableFranchises = franchises.filter((f) => {
    if (isFranchisee) {
      if (userSession?.tenant && userSession.tenant !== "dono" && userSession.tenant !== "equipe") {
        return f.id === userSession.tenant;
      }
    }
    if (selectedBusiness !== "all") {
      return f.businessId === selectedBusiness;
    }
    return true;
  });

  // Filtered units
  const visibleUnits = franchises.filter((f) => {
    if (isFranchisee) {
      if (userSession?.tenant && userSession.tenant !== "dono" && userSession.tenant !== "equipe") {
        return f.id === userSession.tenant;
      }
    }
    if (selectedBusiness !== "all" && f.businessId !== selectedBusiness) return false;
    if (selectedFranchise !== "all" && f.id !== selectedFranchise) return false;
    return true;
  });

  // Multipliers based on dateSelection
  const numYears = dateSelection.years.length;
  const numMonths = dateSelection.months.length;
  const numDays = dateSelection.days.length;
  const daysRatio = numDays / 31;
  const periodMultiplier = Math.max(0.032, numYears * numMonths * daysRatio);

  // Revenue calculations
  const baseMonthlyUnits = visibleUnits.reduce((s, f) => s + (f.faturamento || 0), 0);
  const baseFat = baseMonthlyUnits * periodMultiplier;

  // DRE Parameters resolution
  const targetTenantKey =
    selectedFranchise !== "all"
      ? selectedFranchise
      : selectedBusiness !== "all"
      ? selectedBusiness
      : currentTenantId;

  const currentParams: DreParams =
    dreParams[targetTenantKey] || dreParams["dono"] || defaultDreParams;

  const activeUnitId = selectedFranchise !== "all" ? selectedFranchise : (currentTenantId !== "dono" && currentTenantId !== "equipe" ? currentTenantId : "");
  const targetUnit = franchises.find((f) => f.id === (activeUnitId || selectedFranchise));
  const targetBiz = businesses.find(
    (b) => b.id === (targetUnit?.businessId || (selectedBusiness !== "all" ? selectedBusiness : ""))
  );
  const unitRoyalty = targetUnit
    ? (royalties[targetUnit.businessId] ?? targetBiz?.royalty ?? 0.06)
    : (selectedBusiness !== "all" ? (royalties[selectedBusiness] ?? targetBiz?.royalty) : undefined);

  // Filter active operational entries for DRE calculation
  const activeEntries = React.useMemo(() => {
    if (!manualEntries || manualEntries.length === 0) return [];

    return manualEntries.filter((entry) => {
      // 1. Check if entry is marked as intercompany or excluded
      if (isIntercompanyEntry(entry)) return false;

      // 2. Match against active intercompany rules
      if (intercompanyRules && intercompanyRules.length > 0) {
        const unit = franchises.find((f) => f.id === entry.tenant);
        const context = {
          tenantId: entry.tenant,
          businessId: unit?.businessId,
        };
        const matchedRule = findIntercompanyRule(
          { desc: entry.desc, counterpartyDocument: entry.counterpartyDocument, sourceAccount: entry.sourceAccount, destinationAccount: entry.destinationAccount },
          intercompanyRules,
          context
        );
        if (matchedRule) return false;
      }

      // 3. Unit filter
      if (selectedFranchise !== "all") {
        if (selectedFranchise.startsWith("biz")) {
          const u = franchises.find((f) => f.id === entry.tenant);
          if (entry.tenant !== selectedFranchise && (!u || u.businessId !== selectedFranchise)) {
            return false;
          }
        } else if (entry.tenant !== selectedFranchise && entry.tenant !== "dono") {
          return false;
        }
      }

      // 4. Business filter
      if (selectedBusiness !== "all") {
        const unit = franchises.find((f) => f.id === entry.tenant);
        if (entry.tenant !== selectedBusiness && (!unit || unit.businessId !== selectedBusiness)) return false;
      }

      // 5. Date filter
      if (entry.date) {
        const dObj = parseVencimentoDate(entry.date);
        if (dObj && !isNaN(dObj.getTime())) {
          const y = dObj.getFullYear();
          const m = dObj.getMonth() + 1;
          const d = dObj.getDate();
          if (dateSelection.years?.length && !dateSelection.years.includes(y)) return false;
          if (dateSelection.months?.length && !dateSelection.months.includes(m)) return false;
          if (dateSelection.days?.length && !dateSelection.days.includes(d)) return false;
        }
      }

      return true;
    });
  }, [manualEntries, intercompanyRules, selectedFranchise, selectedBusiness, dateSelection, franchises]);

  // Real entries breakdown
  const realEntradas = React.useMemo(() => activeEntries.filter((e) => e.type === "entrada"), [activeEntries]);
  const realDespesas = React.useMemo(() => activeEntries.filter((e) => e.type === "despesa"), [activeEntries]);
  const realFatBruta = React.useMemo(() => realEntradas.reduce((s, e) => s + (Number(e.value) || 0), 0), [realEntradas]);

  // Helper para nome do escopo / unidade selecionada
  const getScopeTitle = () => {
    if (selectedFranchise !== "all") {
      const f = franchises.find((u) => u.id === selectedFranchise);
      if (f) return `${f.name} (${f.code} - ${f.city})`;
    }
    if (targetUnit?.name) return `${targetUnit.name} (${targetUnit.code})`;
    if (selectedBusiness !== "all") {
      const b = businesses.find((biz) => biz.id === selectedBusiness);
      return b ? `Rede ${b.name}` : selectedBusiness;
    }
    return "Toda a Rede Consolidada";
  };

  // Helper de texto do período selecionado
  const getPeriodSummary = () => {
    const yrText =
      dateSelection.years.length === AVAILABLE_YEARS.length
        ? "Todos os Anos"
        : `Ano ${dateSelection.years.join(", ")}`;
    const moText =
      dateSelection.months.length === AVAILABLE_MONTHS.length
        ? "Todos os 12 Meses"
        : dateSelection.months.length === 1
        ? AVAILABLE_MONTHS.find((m) => m.value === dateSelection.months[0])?.label || "1 mês"
        : `${dateSelection.months.length} meses`;
    const dayText =
      dateSelection.days.length === AVAILABLE_DAYS.length
        ? "Todos os 31 Dias"
        : `${dateSelection.days.length} dia(s)`;
    return `${yrText} · ${moText} · ${dayText}`;
  };

  // Apuração oficial do DRE baseada estritamente nos lançamentos reais da base
  const dre = React.useMemo(() => {
    if (activeEntries.length === 0) {
      const emptyDespesas = dreExpenseDefs.map((e) => ({
        ...e,
        pct: 0,
        value: 0,
      }));
      return {
        fatBruta: 0,
        desconto: 0,
        receitaAjustada: 0,
        impostos: 0,
        receitaLiquida: 0,
        cmv: 0,
        taxasNegocio: 0,
        lucroBruto: 0,
        despesas: emptyDespesas,
        totalDesp: 0,
        lucroLiquido: 0,
        margemBruta: 0,
        margemLiquida: 0,
        despRatio: 0,
        params: currentParams,
      };
    }

    // Receita Bruta apurada pelas entradas reais do período
    const realFatBruta = realEntradas.reduce((s, e) => s + (Number(e.value) || 0), 0);

    // Mapeamento categorizado das saídas reais por grupo
    const matchedItemIds = new Set<string>();
    const mappedDespesas = dreExpenseDefs.map((e) => {
      const matchedItems = realDespesas.filter((de) => {
        const cId = (de.catId || "").toLowerCase();
        const cName = (de.catName || "").toLowerCase();
        const eId = e.id.toLowerCase();
        const eName = e.name.toLowerCase();
        const isMatch = cId.includes(eId) || cName.includes(eId) || cName.includes(eName) || eName.includes(cName);
        if (isMatch) matchedItemIds.add(de.id);
        return isMatch;
      });

      const catSum = matchedItems.reduce((s, item) => s + (Number(item.value) || 0), 0);
      return {
        ...e,
        pct: realFatBruta > 0 ? catSum / realFatBruta : 0,
        value: catSum,
      };
    });

    // Saídas que possuem categorias operacionais customizadas
    const unmatchedItems = realDespesas.filter((de) => !matchedItemIds.has(de.id));
    if (unmatchedItems.length > 0) {
      const customCategoryGroups: Record<string, number> = {};
      unmatchedItems.forEach((de) => {
        const cat = de.catName || "Outras Despesas Operacionais";
        customCategoryGroups[cat] = (customCategoryGroups[cat] || 0) + (Number(de.value) || 0);
      });

      Object.entries(customCategoryGroups).forEach(([catName, val], idx) => {
        mappedDespesas.push({
          id: `custom_${idx}_${catName.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          name: catName,
          group: "operacional",
          pct: realFatBruta > 0 ? val / realFatBruta : 0,
          value: val,
          fromConciliation: true,
          icon: "📄",
        });
      });
    }

    // Identificação de deduções reais se registradas em lançamentos
    const findRealExpense = (keywords: string[]) => {
      return realDespesas.reduce((acc, de) => {
        const text = `${de.catId || ""} ${de.catName || ""} ${de.desc || ""}`.toLowerCase();
        return keywords.some((k) => text.includes(k)) ? acc + (Number(de.value) || 0) : acc;
      }, 0);
    };

    const realDesconto = 0;
    const realImpostos = findRealExpense(["imposto", "tributo", "simples", "darf", "iss"]);
    const realReceitaLiquida = Math.max(0, realFatBruta - realDesconto - realImpostos);
    const realCmv = findRealExpense(["cmv", "custo de mercadoria", "mercadoria vendida"]);
    const realTaxas = findRealExpense(["taxa de cart", "taxa cart", "maquininha", "stone"]);
    const realLucroBruto = realReceitaLiquida - realCmv - realTaxas;

    const nonZeroDespesas = mappedDespesas.filter((d) => d.value > 0);
    const activeDespesasTable = nonZeroDespesas.length > 0 ? nonZeroDespesas : mappedDespesas;
    const totRealDesp = realDespesas.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const lucroLiq = realFatBruta - totRealDesp;

    return {
      fatBruta: realFatBruta,
      desconto: realDesconto,
      receitaAjustada: realFatBruta - realDesconto,
      impostos: realImpostos,
      receitaLiquida: realReceitaLiquida,
      cmv: realCmv,
      taxasNegocio: realTaxas,
      lucroBruto: realLucroBruto,
      despesas: activeDespesasTable,
      totalDesp: totRealDesp,
      lucroLiquido: lucroLiq,
      margemBruta: realFatBruta > 0 ? realLucroBruto / realFatBruta : 0,
      margemLiquida: realFatBruta > 0 ? lucroLiq / realFatBruta : 0,
      despRatio: realFatBruta > 0 ? totRealDesp / realFatBruta : 0,
      params: currentParams,
    };
  }, [activeEntries, realEntradas, realDespesas]);

  const scopedBills = bills.filter((bill) => {
    const matchesUnit = selectedFranchise === "all" || !bill.tenantId || bill.tenantId === "dono" || bill.tenantId === selectedFranchise;
    const matchesBusiness = selectedBusiness === "all" || !bill.businessId || bill.businessId === selectedBusiness;
    return matchesUnit && matchesBusiness;
  });
  const billRisk = scopedBills.reduce((summary, bill) => {
    const status = getBillDueStatus(bill);
    summary[status] += Number(bill.value) || 0;
    return summary;
  }, { overdue: 0, today: 0, soon: 0, scheduled: 0, paid: 0 } as Record<ReturnType<typeof getBillDueStatus>, number>);


  const handleExportCsv = () => {
    const scope = getScopeTitle();
    const yearsStr = dateSelection.years?.length ? dateSelection.years.join(", ") : "Todos";
    const monthsStr = dateSelection.months?.length ? dateSelection.months.map((m) => AVAILABLE_MONTHS.find((item) => item.value === m)?.short || m).join(", ") : "Todos";
    const daysStr = dateSelection.days?.length ? `${dateSelection.days.length} dia(s)` : "Todos";
    const period = `Ano: ${yearsStr} | Mês: ${monthsStr} | Dias: ${daysStr}`;
    const dateStr = new Date().toLocaleDateString("pt-BR");

    const startYear = Math.min(...(dateSelection.years?.length ? dateSelection.years : [CURRENT_YEAR]));
    const endYear = Math.max(...(dateSelection.years?.length ? dateSelection.years : [CURRENT_YEAR]));
    const firstMonth = dateSelection.months?.length ? dateSelection.months[0] : 1;
    const lastMonth = dateSelection.months?.length ? dateSelection.months[dateSelection.months.length - 1] : 12;
    const firstDay = dateSelection.days?.length ? Math.min(...dateSelection.days) : 1;
    const lastDay = dateSelection.days?.length ? Math.max(...dateSelection.days) : 31;
    const dataInicial = `${String(firstDay).padStart(2, "0")}/${String(firstMonth).padStart(2, "0")}/${startYear}`;
    const dataFinal = `${String(lastDay).padStart(2, "0")}/${String(lastMonth).padStart(2, "0")}/${endYear}`;

    let csv = `\uFEFF`; // BOM UTF-8 para compatibilidade perfeita com Microsoft Excel
    csv += `DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE)\n`;
    csv += `Escopo / Unidade;${scope}\n`;
    csv += `Data Inicial do Período;${dataInicial}\n`;
    csv += `Data Final do Período;${dataFinal}\n`;
    csv += `Período Completo;De ${dataInicial} a ${dataFinal} (${period})\n`;
    csv += `Data e Hora de Emissão;${dateStr} às ${new Date().toLocaleTimeString("pt-BR")}\n\n`;

    csv += `Código;Conta Contábil / Descrição;Categoria;Valor Nominal (R$);% s/ Faturamento Bruto;% s/ Receita Líquida;Classificação\n`;
    csv += `1.00;(=) RECEITA BRUTA OPERACIONAL;Receita Bruta;${dre.fatBruta.toFixed(2)};100.00%;${((dre.fatBruta / (dre.receitaLiquida || 1)) * 100).toFixed(2)}%;Receita\n`;
    csv += `1.01;(-) Descontos & Cancelamentos;Dedução de Vendas;-${dre.desconto.toFixed(2)};${((dre.desconto / (dre.fatBruta || 1)) * 100).toFixed(2)}%;${((dre.desconto / (dre.receitaLiquida || 1)) * 100).toFixed(2)}%;Dedução\n`;
    csv += `1.02;(-) Impostos sobre Vendas;Tributos;-${dre.impostos.toFixed(2)};${((dre.impostos / (dre.fatBruta || 1)) * 100).toFixed(2)}%;${((dre.impostos / (dre.receitaAjustada || 1)) * 100).toFixed(2)}%;Dedução\n`;
    csv += `2.00;(=) RECEITA LÍQUIDA OPERACIONAL;Receita Líquida;${dre.receitaLiquida.toFixed(2)};${((dre.receitaLiquida / (dre.fatBruta || 1)) * 100).toFixed(2)}%;100.00%;Subtotal\n`;
    csv += `2.01;(-) Custo das Mercadorias Vendidas (CMV);Custo Variável;-${dre.cmv.toFixed(2)};${((dre.cmv / (dre.fatBruta || 1)) * 100).toFixed(2)}%;${((dre.cmv / (dre.receitaLiquida || 1)) * 100).toFixed(2)}%;Custos\n`;
    csv += `2.02;(-) Taxas de Cartão & Meios de Pagamento;Custo Variável;-${dre.taxasNegocio.toFixed(2)};${((dre.taxasNegocio / (dre.fatBruta || 1)) * 100).toFixed(2)}%;${((dre.taxasNegocio / (dre.receitaLiquida || 1)) * 100).toFixed(2)}%;Custos\n`;
    csv += `3.00;(=) Lucro Bruto (Margem de Contribuição);Lucro Bruto;${dre.lucroBruto.toFixed(2)};${((dre.lucroBruto / (dre.fatBruta || 1)) * 100).toFixed(2)}%;${(dre.margemBruta * 100).toFixed(2)}%;Subtotal\n`;
    
    dre.despesas.forEach((d, idx) => {
      const code = `4.${String(idx + 1).padStart(2, "0")}`;
      csv += `${code};(-) ${d?.name || "Despesa"};Despesa Operacional;-${d.value.toFixed(2)};${((d.value / (dre.fatBruta || 1)) * 100).toFixed(2)}%;${((d.value / (dre.receitaLiquida || 1)) * 100).toFixed(2)}%;Despesa Fixa\n`;
    });
    
    csv += `5.00;(=) RESULTADO LÍQUIDO DO PERÍODO;Lucro Líquido;${dre.lucroLiquido.toFixed(2)};${((dre.lucroLiquido / (dre.fatBruta || 1)) * 100).toFixed(2)}%;${(dre.margemLiquida * 100).toFixed(2)}%;Resultado Final\n`;

    if (visibleUnits.length > 1) {
      csv += `\n\nTABELA DISCRIMINADA POR UNIDADE DA REDE\n`;
      csv += `Código Loja;Nome da Unidade;Marca;Cidade/UF;Faturamento Bruto (R$);Lucro Líquido (R$);Margem Líquida (%)\n`;
      visibleUnits.forEach((u) => {
        const uParams = dreParams[u.id] || dreParams["dono"];
        const uRoy = royalties[u.businessId];
        const uCalc = calculateDre(u.faturamento, uParams, uRoy);
        const b = businesses.find(biz => biz.id === u.businessId);
        csv += `${u.code};${u.name};${b?.name || u.businessId};${u.city};${u.faturamento.toFixed(2)};${uCalc.lucroLiquido.toFixed(2)};${(uCalc.margemLiquida * 100).toFixed(2)}%\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${scope.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExtratoCsv = () => {
    const scope = getScopeTitle();
    const period = getPeriodSummary();
    let csv = `\uFEFF`;
    csv += `EXTRATO DETALHADO DRE (ENTRADAS, SAÍDAS E DESPESAS)\n`;
    csv += `Escopo;${scope}\n`;
    csv += `Período;${period}\n\n`;

    csv += `--- ENTRADAS ---\n`;
    csv += `Data;Descrição;Apelido;Categoria;Valor (R$)\n`;
    realEntradas.forEach(e => {
      csv += `${e.date};${e.desc};${e.apelido || ""};${e.catName || ""};${Number(e.value || 0).toFixed(2)}\n`;
    });
    csv += `Total Entradas;;;;${realEntradas.reduce((s, e) => s + Number(e.value || 0), 0).toFixed(2)}\n\n`;

    csv += `--- SAÍDAS E DESPESAS OPERACIONAIS ---\n`;
    csv += `Data;Descrição;Apelido;Categoria/Despesa;Valor (R$)\n`;
    realDespesas.forEach(e => {
      csv += `${e.date};${e.desc};${e.apelido || ""};${e.catName || ""};${Number(e.value || 0).toFixed(2)}\n`;
    });
    csv += `Total Saídas/Despesas;;;;${realDespesas.reduce((s, e) => s + Number(e.value || 0), 0).toFixed(2)}\n\n`;

    const totalEntrada = realEntradas.reduce((s, e) => s + Number(e.value || 0), 0);
    const totalSaida = realDespesas.reduce((s, e) => s + Number(e.value || 0), 0);
    const saldoLiquido = totalEntrada - totalSaida;
    csv += `SALDO LÍQUIDO (ENTRADA - SAÍDA);;;;${saldoLiquido.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Extrato_DRE_${scope.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateExtratoPdfReport = () => {
    try {
      const scope = getScopeTitle();
      const period = getPeriodSummary();
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const totalEntrada = realEntradas.reduce((s, e) => s + Number(e.value || 0), 0);
      const totalSaida = realDespesas.reduce((s, e) => s + Number(e.value || 0), 0);
      const saldoLiquido = totalEntrada - totalSaida;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      // Top bar decorativa
      doc.setFillColor(60, 99, 218);
      doc.rect(margin, 10, contentWidth, 3, "F");

      // Título
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(21, 34, 56);
      doc.text("EXTRATO DETALHADO DO DRE — ENTRADAS E DESPESAS", margin, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(105, 119, 140);
      doc.text("Demonstrativo analítico discriminado por lançamento contábil e operacional", margin, 25);

      // Caixa de Metadados com Nome da Unidade e Período Filtrado
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, 28, contentWidth, 20, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      doc.text("UNIDADE / ESCOPO:", margin + 4, 34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(scope, margin + 4, 39);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("PERÍODO FILTRADO:", margin + 92, 34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(period, margin + 92, 39);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Emissão: ${dateStr} às ${timeStr}`, margin + 4, 45);

      // Cards de Resumo
      const kpiY = 52;
      const kpiHeight = 14;
      const kpiWidth = (contentWidth - 6) / 3;

      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(margin, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(4, 120, 87);
      doc.text(`TOTAL ENTRADAS (${realEntradas.length})`, margin + 3, kpiY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(formatBrl(totalEntrada), margin + 3, kpiY + 10.5);

      const s2X = margin + kpiWidth + 3;
      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(254, 205, 211);
      doc.roundedRect(s2X, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(185, 28, 28);
      doc.text(`TOTAL SAÍDAS (${realDespesas.length})`, s2X + 3, kpiY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`-${formatBrl(totalSaida)}`, s2X + 3, kpiY + 10.5);

      const s3X = s2X + kpiWidth + 3;
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(s3X, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(29, 78, 216);
      doc.text("SALDO LÍQUIDO", s3X + 3, kpiY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(formatBrl(saldoLiquido), s3X + 3, kpiY + 10.5);

      let curY = 71;

      const checkPageOverflow = (needHeight: number) => {
        if (curY + needHeight > 280) {
          doc.addPage();
          curY = 16;
        }
      };

      // Tabela de Entradas
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(4, 120, 87);
      doc.text(`1. ENTRADAS REGISTRADAS NO PERÍODO (${realEntradas.length})`, margin, curY);
      curY += 3.5;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, curY, contentWidth, 5.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text("Data", margin + 2, curY + 3.8);
      doc.text("Descrição", margin + 24, curY + 3.8);
      doc.text("Categoria", margin + 95, curY + 3.8);
      doc.text("Valor (R$)", margin + contentWidth - 2, curY + 3.8, { align: "right" });
      curY += 5.5;

      if (realEntradas.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Nenhuma receita ou entrada registrada no período filtrado.", margin + 4, curY + 4);
        curY += 6;
      } else {
        realEntradas.forEach((e) => {
          checkPageOverflow(5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text(String(e.date || "—").slice(0, 10), margin + 2, curY + 3.5);
          doc.text(String(e.desc || "Entrada").slice(0, 42), margin + 24, curY + 3.5);
          doc.text(String(e.catName || "Receita").slice(0, 25), margin + 95, curY + 3.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(4, 120, 87);
          doc.text(formatBrl2(e.value), margin + contentWidth - 2, curY + 3.5, { align: "right" });
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, curY + 4.5, margin + contentWidth, curY + 4.5);
          curY += 4.8;
        });
      }

      curY += 4;
      checkPageOverflow(15);

      // Tabela de Saídas
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(185, 28, 28);
      doc.text(`2. SAÍDAS E DESPESAS OPERACIONAIS NO PERÍODO (${realDespesas.length})`, margin, curY);
      curY += 3.5;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, curY, contentWidth, 5.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text("Data", margin + 2, curY + 3.8);
      doc.text("Descrição", margin + 24, curY + 3.8);
      doc.text("Categoria", margin + 95, curY + 3.8);
      doc.text("Valor (R$)", margin + contentWidth - 2, curY + 3.8, { align: "right" });
      curY += 5.5;

      if (realDespesas.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Nenhuma saída ou despesa registrada no período filtrado.", margin + 4, curY + 4);
        curY += 6;
      } else {
        realDespesas.forEach((e) => {
          checkPageOverflow(5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text(String(e.date || "—").slice(0, 10), margin + 2, curY + 3.5);
          doc.text(String(e.desc || "Despesa").slice(0, 42), margin + 24, curY + 3.5);
          doc.text(String(e.catName || "Operacional").slice(0, 25), margin + 95, curY + 3.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(185, 28, 28);
          doc.text(`-${formatBrl2(e.value)}`, margin + contentWidth - 2, curY + 3.5, { align: "right" });
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, curY + 4.5, margin + contentWidth, curY + 4.5);
          curY += 4.8;
        });
      }

      // Rodapé
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.line(margin, 287, margin + contentWidth, 287);
      doc.text(`Gestão de Franquias — Extrato Contábil Oficial emitido para ${scope}`, margin, 291);
      doc.text(`Página 1`, margin + contentWidth, 291, { align: "right" });

      const safeScope = scope.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
      const safeDate = new Date().toISOString().slice(0, 10);
      doc.save(`Extrato_DRE_${safeScope}_${safeDate}.pdf`);
      toast.success("Download do Extrato em PDF concluído!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar PDF do Extrato");
    }
  };

  const handleGeneratePdfReport = () => {
    try {
      const scope = getScopeTitle();
      const period = getPeriodSummary();
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const margin = 14;
      const contentWidth = pageWidth - margin * 2; // 182mm

      // 1. Barra decorativa superior
      doc.setFillColor(60, 99, 218); // #3c63da
      doc.rect(margin, 10, contentWidth, 3, "F");

      // 2. Título & Subtítulo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(21, 34, 56); // #152238
      doc.text("DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE)", margin, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(105, 119, 140); // #69778c
      doc.text("Relatório Contábil e Financeiro Oficial — Base de Lançamentos Reais", margin, 25);

      // 3. Caixa de Destaque com NOME DA UNIDADE e PERÍODO QUE ESTÁ FILTRADO
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, 28, contentWidth, 20, 2, 2, "FD");

      // Linha 1 Coluna 1: Nome da Unidade
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      doc.text("UNIDADE / ESCOPO:", margin + 4, 34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(scope, margin + 4, 39);

      // Linha 1 Coluna 2: Período Filtrado
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("PERÍODO FILTRADO:", margin + 92, 34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(period, margin + 92, 39);

      // Linha 2: Emissão e Base
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Emissão: ${dateStr} às ${timeStr}`, margin + 4, 45);
      doc.text(`Base: ${activeEntries.length} lançamento(s) reais apurados`, margin + 92, 45);

      // 4. Cards de Resumo (KPIs)
      const kpiY = 52;
      const kpiHeight = 15;
      const kpiWidth = (contentWidth - 9) / 4;

      // Card 1: Receita Bruta
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("RECEITA BRUTA", margin + 3, kpiY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(formatBrl(dre.fatBruta), margin + 3, kpiY + 11);

      // Card 2: Lucro Bruto
      const c2X = margin + kpiWidth + 3;
      doc.roundedRect(c2X, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(37, 99, 235);
      doc.text("LUCRO BRUTO", c2X + 3, kpiY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(37, 99, 235);
      doc.text(formatBrl(dre.lucroBruto), c2X + 3, kpiY + 11);

      // Card 3: Total Despesas
      const c3X = c2X + kpiWidth + 3;
      doc.roundedRect(c3X, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(180, 75, 75);
      doc.text("TOTAL DESPESAS", c3X + 3, kpiY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(180, 75, 75);
      doc.text(`-${formatBrl(dre.totalDesp)}`, c3X + 3, kpiY + 11);

      // Card 4: Lucro Líquido
      const c4X = c3X + kpiWidth + 3;
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(c4X, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(4, 120, 87);
      doc.text(`LÍQUIDO (${formatPct(dre.margemLiquida)})`, c4X + 3, kpiY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(4, 120, 87);
      doc.text(formatBrl(dre.lucroLiquido), c4X + 3, kpiY + 11);

      // 5. Cabeçalho da Tabela DRE
      let curY = 72;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, curY, contentWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("CONTA CONTÁBIL / DESCRIÇÃO", margin + 3, curY + 4.8);
      doc.text("VALOR NOMINAL (R$)", margin + contentWidth - 3, curY + 4.8, { align: "right" });
      curY += 7;

      const drawRow = (label: string, valueStr: string, opts: { isHeader?: boolean; isSubtotal?: boolean; isNegative?: boolean; isFinal?: boolean; indent?: boolean } = {}) => {
        const rowHeight = opts.isFinal ? 8.5 : 6;
        if (opts.isFinal) {
          doc.setFillColor(236, 253, 245);
          doc.rect(margin, curY, contentWidth, rowHeight, "F");
          doc.setDrawColor(16, 185, 129);
          doc.line(margin, curY, margin + contentWidth, curY);
          doc.line(margin, curY + rowHeight, margin + contentWidth, curY + rowHeight);
        } else if (opts.isSubtotal) {
          doc.setFillColor(248, 250, 255);
          doc.rect(margin, curY, contentWidth, rowHeight, "F");
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, curY + rowHeight, margin + contentWidth, curY + rowHeight);
        } else if (opts.isHeader) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, curY, contentWidth, rowHeight, "F");
        } else {
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, curY + rowHeight, margin + contentWidth, curY + rowHeight);
        }

        const indentX = opts.indent ? margin + 8 : margin + 3;
        doc.setFont("helvetica", opts.isHeader || opts.isSubtotal || opts.isFinal ? "bold" : "normal");
        doc.setFontSize(opts.isFinal ? 9.5 : 8.5);

        if (opts.isFinal) {
          doc.setTextColor(4, 120, 87);
        } else if (opts.isSubtotal) {
          doc.setTextColor(15, 23, 42);
        } else if (opts.isHeader) {
          doc.setTextColor(100, 116, 139);
        } else {
          doc.setTextColor(71, 85, 105);
        }

        doc.text(label, indentX, curY + (opts.isFinal ? 5.5 : 4.2));

        if (valueStr) {
          if (opts.isFinal) doc.setTextColor(4, 120, 87);
          else if (opts.isNegative) doc.setTextColor(180, 75, 75);
          else if (opts.isSubtotal) doc.setTextColor(37, 99, 235);
          else doc.setTextColor(15, 23, 42);

          doc.text(valueStr, margin + contentWidth - 3, curY + (opts.isFinal ? 5.5 : 4.2), { align: "right" });
        }

        curY += rowHeight;
      };

      drawRow("(=) RECEITA BRUTA OPERACIONAL", formatBrl2(dre.fatBruta), { isSubtotal: true });
      drawRow("(-) Descontos & Cancelamentos", dre.desconto > 0 ? `-${formatBrl2(dre.desconto)}` : "R$ 0,00", { indent: true, isNegative: dre.desconto > 0 });
      drawRow("(-) Impostos sobre Vendas", dre.impostos > 0 ? `-${formatBrl2(dre.impostos)}` : "R$ 0,00", { indent: true, isNegative: dre.impostos > 0 });
      drawRow("(=) RECEITA LÍQUIDA OPERACIONAL", formatBrl2(dre.receitaLiquida), { isSubtotal: true });
      drawRow("(-) Custo das Mercadorias Vendidas (CMV)", dre.cmv > 0 ? `-${formatBrl2(dre.cmv)}` : "R$ 0,00", { indent: true, isNegative: dre.cmv > 0 });
      drawRow("(-) Taxas de Cartão & Plataforma", dre.taxasNegocio > 0 ? `-${formatBrl2(dre.taxasNegocio)}` : "R$ 0,00", { indent: true, isNegative: dre.taxasNegocio > 0 });
      drawRow("(=) Margem de Contribuição Bruta (Lucro Bruto)", formatBrl2(dre.lucroBruto), { isSubtotal: true });

      drawRow("Despesas Operacionais Fixas & Administrativas", "", { isHeader: true });
      if (dre.despesas.length === 0) {
        drawRow("Nenhuma despesa operacional registrada no período", "R$ 0,00", { indent: true });
      } else {
        dre.despesas.forEach((d) => {
          drawRow(`(-) ${d.name}`, `-${formatBrl2(d.value)}`, { indent: true, isNegative: true });
        });
      }

      drawRow("(=) RESULTADO LÍQUIDO DO PERÍODO", formatBrl2(dre.lucroLiquido), { isFinal: true });

      // 6. Tabela discriminada por unidade da rede quando houver mais de uma unidade
      if (visibleUnits.length > 1 && curY < 235) {
        curY += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Demonstrativo por Unidade da Rede", margin, curY);
        curY += 4;

        doc.setFillColor(241, 245, 249);
        doc.rect(margin, curY, contentWidth, 5.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text("Código", margin + 2, curY + 3.8);
        doc.text("Unidade", margin + 20, curY + 3.8);
        doc.text("Marca", margin + 65, curY + 3.8);
        doc.text("Cidade", margin + 105, curY + 3.8);
        doc.text("Faturamento (R$)", margin + 145, curY + 3.8, { align: "right" });
        doc.text("Lucro Líq. (R$)", margin + contentWidth - 2, curY + 3.8, { align: "right" });
        curY += 5.5;

        visibleUnits.slice(0, 10).forEach((u) => {
          const uEntradas = activeEntries.filter((e) => e.type === "entrada" && (e.tenant === u.id || (u.id === "lavo" && (!e.tenant || e.tenant === "dono"))));
          const uFat = uEntradas.reduce((s, e) => s + (Number(e.value) || 0), 0);
          const uDesp = activeEntries.filter((e) => e.type === "despesa" && (e.tenant === u.id || (u.id === "lavo" && (!e.tenant || e.tenant === "dono")))).reduce((s, e) => s + (Number(e.value) || 0), 0);
          const uLiq = uFat - uDesp;
          const b = businesses.find((biz) => biz.id === u.businessId);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text(u.code, margin + 2, curY + 3.5);
          doc.text(u.name.slice(0, 22), margin + 20, curY + 3.5);
          doc.text((b?.name || "").slice(0, 18), margin + 65, curY + 3.5);
          doc.text(u.city.slice(0, 16), margin + 105, curY + 3.5);
          doc.text(formatBrl(uFat), margin + 145, curY + 3.5, { align: "right" });
          doc.text(formatBrl(uLiq), margin + contentWidth - 2, curY + 3.5, { align: "right" });
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, curY + 4.5, margin + contentWidth, curY + 4.5);
          curY += 4.5;
        });
      }

      // Rodapé oficial
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.line(margin, 287, margin + contentWidth, 287);
      doc.text(`Gestão de Franquias — Demonstrativo Contábil Oficial emitido para ${scope}`, margin, 291);
      doc.text(`Página 1 de 1`, margin + contentWidth, 291, { align: "right" });

      const safeScope = scope.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
      const safeDate = new Date().toISOString().slice(0, 10);
      doc.save(`Planilha_DRE_${safeScope}_${safeDate}.pdf`);
      toast.success("Download da Planilha DRE em PDF concluído!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar PDF da DRE");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Unified Sub-Tab Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Demonstrativo Financeiro do Exercício (DRE)
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-0.5">
            <TrendingUp className="h-6 w-6 text-[#3c63da]" />
            DRE e Resultados — {getScopeTitle()}
          </h2>
          <p className="text-xs text-[#69778c] mt-0.5">
            Apuração contábil e controle de margens.
          </p>
        </div>


      </div>

      <div className="space-y-6">
        {/* Sub-Tabs Selector */}
        <div className="flex items-center gap-2 border-b border-[#e5eaf1] pb-3 flex-wrap">
          <button
            onClick={() => setActiveSubTab("demonstrativo")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === "demonstrativo"
                ? "bg-[#3c63da] text-white shadow-xs"
                : "bg-white border border-[#e5eaf1] text-[#69778c] hover:text-[#152238]"
            }`}
          >
            Demonstrativo DRE
          </button>
          <button
            onClick={() => setActiveSubTab("extrato")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === "extrato"
                ? "bg-[#3c63da] text-white shadow-xs"
                : "bg-white border border-[#e5eaf1] text-[#69778c] hover:text-[#152238]"
            }`}
          >
            Entradas, Saídas & Despesas (Extrato DRE)
          </button>
        </div>

        {activeSubTab === "extrato" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
              <div>
                <h3 className="text-base font-extrabold text-[#152238]">Extrato de Entradas, Saídas e Despesas do DRE</h3>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#1d4ed8] border border-[#bfdbfe]">
                    <Building2 className="h-3.5 w-3.5 text-[#2563eb]" />
                    <span>Unidade: <strong>{getScopeTitle()}</strong></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f8fafc] px-2.5 py-1 text-xs font-bold text-[#475569] border border-[#cbd5e1]">
                    <Calendar className="h-3.5 w-3.5 text-[#64748b]" />
                    <span>Período Filtrado: <strong>{getPeriodSummary()}</strong></span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportExtratoCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                  title="Exportar planilha Excel (.csv)"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Baixar Extrato (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateExtratoPdfReport}
                  className="flex items-center gap-1.5 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff] px-3.5 py-2 text-xs font-bold text-[#3c63da] hover:bg-[#dfe8fe] transition-all cursor-pointer shadow-2xs"
                  title="Baixar extrato e lançamentos em PDF com unidade e período filtrado"
                >
                  <Download className="h-4 w-4 text-[#3c63da]" />
                  <span>Baixar PDF da Planilha</span>
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <span className="text-[10px] font-extrabold uppercase text-emerald-800 block">Total de Entradas</span>
                <strong className="text-xl font-black text-emerald-900 block mt-1">
                  {formatBrl2(realEntradas.reduce((s, e) => s + Number(e.value || 0), 0))}
                </strong>
                <span className="text-[11px] text-emerald-700">{realEntradas.length} lançamento(s) de entrada</span>
              </div>
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50">
                <span className="text-[10px] font-extrabold uppercase text-rose-800 block">Total de Saídas & Despesas</span>
                <strong className="text-xl font-black text-rose-900 block mt-1">
                  {formatBrl2(realDespesas.reduce((s, e) => s + Number(e.value || 0), 0))}
                </strong>
                <span className="text-[11px] text-rose-700">{realDespesas.length} lançamento(s) de despesa</span>
              </div>
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50">
                <span className="text-[10px] font-extrabold uppercase text-indigo-800 block">Saldo Líquido (Entrada - Saída)</span>
                <strong className="text-xl font-black text-indigo-950 block mt-1">
                  {formatBrl2(realEntradas.reduce((s, e) => s + Number(e.value || 0), 0) - realDespesas.reduce((s, e) => s + Number(e.value || 0), 0))}
                </strong>
                <span className="text-[11px] text-indigo-700">Resultado operacional bruto do extrato</span>
              </div>
            </div>

            {/* Entradas Table */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-[#152238] uppercase tracking-wider">Entradas (Receitas) no Período</h4>
              <div className="max-h-[300px] overflow-y-auto rounded-xl border border-[#e5eaf1]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8faff] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5">Apelido / Tag</th>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5 text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5eaf1]">
                    {realEntradas.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-[#69778c]">Nenhuma entrada encontrada com estes filtros.</td></tr>
                    ) : (
                      realEntradas.map(e => (
                        <tr key={e.id} className="hover:bg-[#f8faff]">
                          <td className="p-2.5 text-[#69778c] whitespace-nowrap">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="p-2.5 font-bold text-[#152238]">{e.desc}</td>
                          <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">{e.apelido || "—"}</span></td>
                          <td className="p-2.5 text-[#69778c]">{e.catName || "—"}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700">+ {formatBrl2(e.value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Despesas Table */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-[#152238] uppercase tracking-wider">Saídas & Despesas Operacionais no Período</h4>
              <div className="max-h-[300px] overflow-y-auto rounded-xl border border-[#e5eaf1]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8faff] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5">Apelido / Tag</th>
                      <th className="p-2.5">Categoria DRE</th>
                      <th className="p-2.5 text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5eaf1]">
                    {realDespesas.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-[#69778c]">Nenhuma despesa encontrada com estes filtros.</td></tr>
                    ) : (
                      realDespesas.map(e => (
                        <tr key={e.id} className="hover:bg-[#f8faff]">
                          <td className="p-2.5 text-[#69778c] whitespace-nowrap">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="p-2.5 font-bold text-[#152238]">{e.desc}</td>
                          <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">{e.apelido || "—"}</span></td>
                          <td className="p-2.5 text-[#69778c]">{e.catName || "—"}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-700">- {formatBrl2(e.value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Final Net Total */}
            <div className="p-4 rounded-xl bg-[#152238] text-white flex items-center justify-between font-extrabold text-sm">
              <span>TOTAL FINAL (ENTRADA - SAÍDA):</span>
              <span className="font-mono text-base sm:text-lg text-emerald-400">
                {formatBrl2(realEntradas.reduce((s, e) => s + Number(e.value || 0), 0) - realDespesas.reduce((s, e) => s + Number(e.value || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "demonstrativo" && (
        <div className="space-y-6">
          {/* Card Unificado de Filtros com Seletores Granulares (Ano, Mês, Dia, Marca, Unidade) */}
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f1f5f9]">
              <div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#3c63da]" />
                  <span className="text-xs font-bold text-[#152238] uppercase tracking-wider">
                    Filtros de Período & Escopo
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#1d4ed8] border border-[#bfdbfe]">
                    <Building2 className="h-3.5 w-3.5 text-[#2563eb]" />
                    <span>Unidade: <strong>{getScopeTitle()}</strong></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f8fafc] px-2.5 py-1 text-xs font-bold text-[#475569] border border-[#cbd5e1]">
                    <Calendar className="h-3.5 w-3.5 text-[#64748b]" />
                    <span>Período Filtrado: <strong>{getPeriodSummary()}</strong></span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                  title="Baixar planilha completa da DRE com todas as contas e tabela detalhada"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Baixar Tabela DRE (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePdfReport}
                  className="flex items-center gap-1.5 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff] px-3.5 py-2 text-xs font-bold text-[#3c63da] hover:bg-[#dfe8fe] transition-all cursor-pointer shadow-2xs"
                  title="Baixar demonstrativo da DRE em PDF com nome da unidade e período filtrado"
                >
                  <Download className="h-4 w-4 text-[#3c63da]" />
                  <span>Baixar PDF da Planilha</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f8faff] hover:border-[#3c63da] transition-all cursor-pointer"
                  title="Imprimir ou Salvar em PDF"
                >
                  <Printer className="h-4 w-4 text-[#69778c]" />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>

            {/* Seletor Temporal Separado: Ano, Mês e Dia */}
            <DateMultiFilter selection={dateSelection} onChange={setDateSelection} />

            {/* Filtros Operacionais: Marca e Unidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#f1f5f9]">
              {/* Filtro Marca / Rede */}
              <div>
                <label
                  htmlFor="dre-filter-business"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#152238] mb-1.5"
                >
                  <Building2 className="h-3.5 w-3.5 text-[#3c63da]" />
                  <span>Rede / Marca</span>
                </label>
                <select
                  id="dre-filter-business"
                  disabled={isFranchisee}
                  value={selectedBusiness}
                  onChange={(e) => {
                    const bId = e.target.value;
                    setSelectedBusiness(bId);
                    setSelectedFranchise("all");
                    if (onSelectBusiness) onSelectBusiness(bId);
                  }}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#152238] shadow-2xs hover:border-[#94a3b8] focus:border-[#3c63da] focus:ring-2 focus:ring-[#3c63da]/15 focus:outline-none transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="all">Todas as Redes e Marcas</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Unidade / Franqueado */}
              <div>
                <label
                  htmlFor="dre-filter-franchise"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#152238] mb-1.5"
                >
                  <Store className="h-3.5 w-3.5 text-[#3c63da]" />
                  <span>Unidade / Franqueado</span>
                </label>
                <select
                  id="dre-filter-franchise"
                  disabled={isFranchisee}
                  value={selectedFranchise}
                  onChange={(e) => {
                    const fId = e.target.value;
                    setSelectedFranchise(fId);
                    if (onSelectTenant) onSelectTenant(fId === "all" ? "dono" : fId);
                  }}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#152238] shadow-2xs hover:border-[#94a3b8] focus:border-[#3c63da] focus:ring-2 focus:ring-[#3c63da]/15 focus:outline-none transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="all">Todas as Unidades ({availableFranchises.length})</option>
                  {availableFranchises.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code} - {f.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Barra de Auditoria da Base e Ações Rápidas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1] text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Base Contábil Real: <strong>{activeEntries.length} lançamento(s) apurados</strong></span>
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setDateSelection({
                      years: [CURRENT_YEAR],
                      months: [CURRENT_MONTH],
                      days: AVAILABLE_DAYS,
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-[11px] font-bold text-[#64748b] hover:text-[#3c63da] hover:border-[#3c63da] transition-all cursor-pointer shadow-2xs"
                  title="Redefinir filtros para o mês atual"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Redefinir Filtros</span>
                </button>
              </div>
            </div>

            {activeEntries.length === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-2xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-amber-950 block text-xs">DRE Zerado — Nenhum lançamento ativo encontrado no período filtrado</span>
                  <span className="text-[11px]">
                    Sem lançamentos registrados para o filtro selecionado, o DRE reflete fielmente R$ 0,00 sem estimativas artificiais. Adicione lançamentos em <strong>Lançamentos & Extrato</strong> ou ajuste o período acima.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                Receita Bruta (Faturamento)
              </span>
              <strong className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#152238] block mt-1">
                {formatBrl(dre.fatBruta)}
              </strong>
              <span className="text-[11px] text-[#69778c] block mt-0.5">
                {visibleUnits.length} unidade(s) incluídas
              </span>
            </div>

            <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                Lucro Bruto Operacional
              </span>
              <strong className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#3c63da] block mt-1">
                {formatBrl(dre.lucroBruto)}
              </strong>
              <span className="text-[11px] text-[#69778c] block mt-0.5">
                Margem de {formatPct(dre.margemBruta)}
              </span>
            </div>

            <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                Despesas Operacionais Fixas
              </span>
              <strong className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#b44b4b] block mt-1">
                -{formatBrl(dre.totalDesp)}
              </strong>
              <span className="text-[11px] text-[#69778c] block mt-0.5">
                {formatPct(dre.despRatio)} da receita líquida
              </span>
            </div>

            <div className="rounded-xl border border-[#e5eaf1] bg-emerald-50/70 border-emerald-200 p-4 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                Lucro Líquido Final
              </span>
              <strong className="text-xl sm:text-2xl font-extrabold tracking-tight text-emerald-800 block mt-1">
                {formatBrl(dre.lucroLiquido)}
              </strong>
              <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                Margem Líquida de {formatPct(dre.margemLiquida)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e5eaf1] bg-[#f8faff] p-4 sm:p-5 shadow-xs space-y-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">Leitura gerencial</span>
              <h3 className="text-sm font-extrabold text-[#152238] mt-1">Resultado, margem e compromisso de caixa no mesmo recorte</h3>
              <p className="text-[11px] text-[#69778c] mt-1">Use esta faixa para entender rapidamente se o lucro do período está sendo pressionado por despesas ou vencimentos.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex flex-col justify-between"><span className="block text-[10px] font-black uppercase text-emerald-800">Margem líquida</span><strong className="block mt-2 text-base sm:text-lg text-emerald-900">{formatPct(dre.margemLiquida)}</strong></div>
              <div className="rounded-xl border border-[#cbd5e1] bg-white p-3 flex flex-col justify-between"><span className="block text-[10px] font-black uppercase text-[#69778c]">Despesas/receita</span><strong className="block mt-2 text-base sm:text-lg text-[#152238]">{formatPct(dre.despRatio)}</strong></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex flex-col justify-between"><span className="block text-[10px] font-black uppercase text-rose-700">Vencidas</span><strong className="block mt-2 text-base sm:text-lg text-rose-900">{formatBrl2(billRisk.overdue)}</strong></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col justify-between"><span className="block text-[10px] font-black uppercase text-amber-800">Próximas</span><strong className="block mt-2 text-base sm:text-lg text-amber-900">{formatBrl2(billRisk.today + billRisk.soon)}</strong></div>
            </div>
          </div>

          {/* DRE Detailed Table */}
          <div className="rounded-2xl border border-[#e5eaf1] bg-white shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#e5eaf1] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                  <span>Demonstrativo do Resultado do Exercício (DRE)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f4f7fb] text-[#69778c] font-bold">
                    Oficial
                  </span>
                </h3>
                <p className="text-xs text-[#69778c] mt-0.5">
                  Valores apurados conforme os filtros de ano, mês, dia e unidades selecionadas.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                    title="Baixar planilha CSV com a tabela completa"
                  >
                    <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                    <span>Baixar Tabela DRE</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePdfReport}
                    className="flex items-center gap-1 rounded-lg border border-[#3c63da]/30 bg-[#edf2ff] px-2.5 py-1 text-[11px] font-bold text-[#3c63da] hover:bg-[#dfe8fe] transition-all cursor-pointer shadow-2xs"
                    title="Baixar Relatório Formatado em PDF"
                  >
                    <Download className="h-3 w-3 text-[#3c63da]" />
                    <span>Baixar PDF da Planilha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1 text-[11px] font-bold text-[#152238] hover:bg-[#f8faff] hover:border-[#3c63da] transition-all cursor-pointer"
                    title="Imprimir"
                  >
                    <Printer className="h-3 w-3 text-[#69778c]" />
                    <span>Imprimir</span>
                  </button>
                </div>
                <div className="text-right pl-2 border-l border-[#e5eaf1]">
                  <span className="text-[11px] text-[#69778c] block">Resultado Líquido</span>
                  <span className="text-base font-extrabold text-emerald-700">
                    {formatPct(dre.margemLiquida)}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8faff] border-b border-[#e5eaf1] text-[#69778c]">
                    <th className="py-2.5 px-4 font-bold uppercase text-[10px]">Conta Contábil / Descrição</th>
                    <th className="py-2.5 px-4 text-right font-bold uppercase text-[10px]">Valor Nominal (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5eaf1]">
                  <tr className="font-bold text-[#152238] bg-[#f8faff]/50">
                    <td className="py-2.5 px-4">(=) RECEITA BRUTA OPERACIONAL</td>
                    <td className="py-2.5 px-4 text-right font-mono text-emerald-800">
                      {formatBrl2(dre.fatBruta)}
                    </td>
                  </tr>
                  <tr className="text-[#69778c]">
                    <td className="py-2.5 px-4 pl-8">(-) Descontos & Cancelamentos</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.desconto)}</td>
                  </tr>
                  <tr className="text-[#69778c]">
                    <td className="py-2.5 px-4 pl-8">(-) Impostos sobre Vendas</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.impostos)}</td>
                  </tr>
                  <tr className="font-bold text-[#152238] bg-[#f4f7fb]/60">
                    <td className="py-2.5 px-4">(=) RECEITA LÍQUIDA OPERACIONAL</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatBrl2(dre.receitaLiquida)}</td>
                  </tr>
                  <tr className="text-[#69778c]">
                    <td className="py-2.5 px-4 pl-8">(-) Custo das Mercadorias Vendidas (CMV)</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.cmv)}</td>
                  </tr>
                  <tr className="text-[#69778c]">
                    <td className="py-2.5 px-4 pl-8">(-) Taxas de Cartão & Plataforma</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.taxasNegocio)}</td>
                  </tr>
                  <tr className="bg-[#edf2ff] font-bold text-[#152238]">
                    <td className="py-3 px-4">(=) Margem de Contribuição Bruta (Lucro Bruto)</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#3c63da]">
                      {formatBrl2(dre.lucroBruto)}
                    </td>
                  </tr>

                  {/* Despesas Fixas Group */}
                  <tr className="bg-[#f8faff]">
                    <td colSpan={2} className="py-2 px-4 text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                      Despesas Operacionais Fixas & Administrativas
                    </td>
                  </tr>
                  {dre.despesas.map((item) => (
                    <tr key={item.id} className="text-[#69778c]">
                      <td className="py-2 px-4 pl-8 text-xs">{item.name}</td>
                      <td className="py-2 px-4 text-right font-mono text-[#b44b4b]">
                        -{formatBrl2(item.value)}
                      </td>
                    </tr>
                  ))}

                  {/* Final Net Profit */}
                  <tr className="bg-emerald-50 text-emerald-950 font-extrabold text-sm border-t-2 border-emerald-500">
                    <td className="py-4 px-4">(=) RESULTADO LÍQUIDO DO PERÍODO</td>
                    <td className="py-4 px-4 text-right font-mono text-emerald-800 text-base">
                      {formatBrl2(dre.lucroLiquido)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
