import React, { useEffect, useMemo, useRef, useState } from "react";
import { BillItem, FranchiseUnit, Business, ScreenType, UserSession, ManualEntry } from "../../types";
import {
  formatBrl,
  formatBrl2,
  formatPct,
  formatPct2,
  calculateUnitDre,
  getUnitRealFinancials,
} from "../../utils/calculations";
import { getBillDueStatus } from "../../utils/calculations";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Filter,
  DollarSign,
  PieChart as PieIcon,
  Layers,
  Download,
  ShieldCheck,
  Building2,
  Store,
  Percent,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShoppingBag,
  Receipt,
  Target,
  Scale,
  Award,
  Lock,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  Sliders,
  Maximize2
} from "lucide-react";
import Chart from "chart.js/auto";
import {
  DateMultiFilter,
  DateFilterSelection,
  AVAILABLE_MONTHS,
  AVAILABLE_YEARS,
  AVAILABLE_DAYS,
  CURRENT_YEAR,
  CURRENT_MONTH,
} from "../DateMultiFilter";

interface DashboardScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentBusinessId?: string;
  currentTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onNavigate: (screen: ScreenType) => void;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
  bills?: BillItem[];
  userSession?: UserSession | null;
  manualEntries?: ManualEntry[];
}

type PeriodType = "mes_atual" | "mes_anterior" | "trimestre" | "semestre" | "ano";
type ActiveChartType = "all" | "unidades" | "mensal" | "empilhado" | "royalties" | "estados";

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  franchises,
  businesses,
  currentBusinessId = "all",
  currentTenantId,
  onSelectTenant,
  onNavigate,
  dreParams,
  royalties,
  bills = [],
  userSession,
  manualEntries = [],
}) => {
  // Franqueado permission check
  const isFranchisee = userSession?.profile === "franqueado" || userSession?.profile === "operador";

  // Check if unit is owned by user
  const isUnitOwnedByUser = (unitTenantId: string): boolean => {
    if (!userSession) return true;
    const profile = userSession.profile;
    if (profile === "dono" || profile === "equipe") return true;
    if (profile === "admin") {
      if (userSession.tenant?.startsWith("biz")) {
        const unit = franchises.find((f) => f.id.toLowerCase() === unitTenantId.toLowerCase());
        return unit?.businessId === userSession.tenant;
      }
      return true;
    }
    const allowedTenants = (userSession.tenant || "").split(",").map((t) => t.trim().toLowerCase());
    if (allowedTenants.includes(unitTenantId.toLowerCase())) return true;
    if (userSession.login === "franqueado_sp" && (unitTenantId === "f1" || unitTenantId === "f2")) return true;
    if (userSession.login === "franqueado_sul" && (unitTenantId === "f4" || unitTenantId === "f6")) return true;
    return false;
  };

  // Units accessible by this session
  const allowedUnits = franchises.filter((f) => isUnitOwnedByUser(f.id));

  // Extract state/UF helper from address field or unit.state
  const getUnitState = (unit: FranchiseUnit): string => {
    if (unit.state) return unit.state;
    const match = (unit.address || unit.city || "").match(/\/([A-Z]{2})$/);
    return match ? match[1] : "SP";
  };

  const availableStates = Array.from(new Set(allowedUnits.map(getUnitState))).sort();

  // Filters
  const [dateSelection, setDateSelection] = useState<DateFilterSelection>({
    years: [CURRENT_YEAR],
    months: [CURRENT_MONTH],
    days: AVAILABLE_DAYS, // Todos os 31 dias por padrão
  });
  const [selectedBusiness, setSelectedBusiness] = useState<string>(() => {
    if (currentBusinessId && currentBusinessId !== "all") return currentBusinessId;
    if (currentTenantId && currentTenantId.startsWith("biz")) return currentTenantId;
    const match = franchises.find((f) => f.id.toLowerCase() === currentTenantId?.toLowerCase());
    return match?.businessId || "all";
  });
  const [selectedFranchise, setSelectedFranchise] = useState<string>(() => {
    if (isFranchisee) {
      return allowedUnits[0]?.id || "f1";
    }
    const match = franchises.find((f) => f.id.toLowerCase() === currentTenantId?.toLowerCase());
    if (match) {
      return match.id;
    }
    return "all";
  });

  const scopedBills = useMemo(() => bills.filter((bill) => {
    const targetUnit = selectedFranchise !== "all"
      ? selectedFranchise
      : (currentTenantId !== "dono" && currentTenantId !== "equipe" && !currentTenantId.startsWith("biz") ? currentTenantId : null);
    if (targetUnit) {
      return (
        bill.tenantId === targetUnit ||
        bill.tenantId?.toLowerCase() === targetUnit.toLowerCase()
      );
    }
    const targetBiz = selectedBusiness !== "all"
      ? selectedBusiness
      : (currentBusinessId !== "all" ? currentBusinessId : null);
    if (targetBiz) {
      const unitsOfBiz = new Set(franchises.filter((f) => f.businessId === targetBiz).map((f) => f.id.toLowerCase()));
      return bill.businessId === targetBiz || (bill.tenantId && unitsOfBiz.has(bill.tenantId.toLowerCase()));
    }
    return true;
  }), [bills, currentBusinessId, currentTenantId, selectedBusiness, selectedFranchise, franchises]);

  const billSummary = useMemo(() => scopedBills.reduce((summary, bill) => {
    const status = getBillDueStatus(bill);
    summary[status].count += 1;
    summary[status].amount += Number(bill.value) || 0;
    return summary;
  }, {
    overdue: { count: 0, amount: 0 },
    today: { count: 0, amount: 0 },
    soon: { count: 0, amount: 0 },
    scheduled: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
  } as Record<ReturnType<typeof getBillDueStatus>, { count: number; amount: number }>), [scopedBills]);

  // View mode: consolidated network or individual unit KPIs
  const [viewMode, setViewMode] = useState<"consolidated" | "unit" | string>(() => {
    if (isFranchisee || franchises.some((franchise) => franchise.id.toLowerCase() === currentTenantId?.toLowerCase())) {
      return "unit";
    }
    return "consolidated";
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "green" | "amber">("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [activeChartFilter, setActiveChartFilter] = useState<ActiveChartType>("all");
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);

  // Interatividade de Legenda Dinâmica sem precisar de teclado (Contra/Ctrl)
  const [hiddenMonthlyDatasets, setHiddenMonthlyDatasets] = useState<Record<number, boolean>>({});
  const toggleMonthlyDataset = (index: number) => {
    if (!monthlyChartInstance.current) return;
    const isVisible = monthlyChartInstance.current.isDatasetVisible(index);
    if (isVisible) {
      monthlyChartInstance.current.hide(index);
      setHiddenMonthlyDatasets((prev) => ({ ...prev, [index]: true }));
    } else {
      monthlyChartInstance.current.show(index);
      setHiddenMonthlyDatasets((prev) => ({ ...prev, [index]: false }));
    }
  };

  // Expanded Chart State
  const [expandedChart, setExpandedChart] = useState<ActiveChartType | null>(null);
  const expandedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const expandedChartInstance = useRef<Chart | null>(null);

  // Chart Canvas Refs
  const monthlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const unitsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stackedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const royaltiesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const expensePieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const marginLineCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart Instances
  const monthlyChartInstance = useRef<Chart | null>(null);
  const unitsChartInstance = useRef<Chart | null>(null);
  const stackedChartInstance = useRef<Chart | null>(null);
  const royaltiesChartInstance = useRef<Chart | null>(null);
  const stateChartInstance = useRef<Chart | null>(null);
  const expensePieChartInstance = useRef<Chart | null>(null);
  const marginLineChartInstance = useRef<Chart | null>(null);

  // Dynamic multipliers and days for period calculation
  const numYears = dateSelection.years.length;
  const numMonths = dateSelection.months.length;
  const numDays = dateSelection.days.length;
  const daysRatio = numDays / 31;
  const periodMultiplier = Math.max(0.032, numYears * numMonths * daysRatio);

  const getPeriodSummary = () => {
    const yrText =
      dateSelection.years.length === AVAILABLE_YEARS.length
        ? "Todos os Anos (3)"
        : `Ano ${dateSelection.years.join(", ")}`;
    const moText =
      dateSelection.months.length === AVAILABLE_MONTHS.length
        ? "Todos os 12 Meses"
        : dateSelection.months.length === 1
        ? AVAILABLE_MONTHS.find((m) => m.value === dateSelection.months[0])?.label || "1 mês"
        : `${dateSelection.months.length} meses (${dateSelection.months
            .map((m) => AVAILABLE_MONTHS.find((item) => item.value === m)?.short)
            .join(", ")})`;
    const dayText =
      dateSelection.days.length === AVAILABLE_DAYS.length
        ? "Todos os 31 Dias"
        : `${dateSelection.days.length} dia(s)`;
    return `${yrText} · ${moText} · ${dayText}`;
  };

  // Sincroniza o escopo global escolhido na barra lateral com os filtros do Analítico.
  useEffect(() => {
    const matchingUnit = franchises.find((f) => f.id.toLowerCase() === currentTenantId?.toLowerCase());
    if (matchingUnit && isUnitOwnedByUser(matchingUnit.id)) {
      setSelectedFranchise(matchingUnit.id);
      setSelectedBusiness(matchingUnit.businessId);
      setViewMode("unit");
    } else if (currentTenantId && (currentTenantId.startsWith("biz") || businesses.some((b) => b.id === currentTenantId))) {
      setSelectedBusiness(currentTenantId);
      setSelectedFranchise("all");
      setViewMode("consolidated");
    } else {
      setSelectedBusiness(currentBusinessId || "all");
      setSelectedFranchise("all");
      setViewMode("consolidated");
    }
  }, [currentBusinessId, currentTenantId, franchises]);

  // Ensure franchisee is always in unit view and has an allowed unit selected
  useEffect(() => {
    if (isFranchisee) {
      setViewMode("unit");
      if (selectedFranchise === "all" || !isUnitOwnedByUser(selectedFranchise)) {
        setSelectedFranchise(allowedUnits[0]?.id || "f1");
      }
    }
  }, [isFranchisee, selectedFranchise]);

  // Filtered units based on controls
  const filteredUnits = allowedUnits.filter((f) => {
    if (selectedBusiness !== "all" && f.businessId !== selectedBusiness) return false;
    if (selectedFranchise !== "all" && f.id !== selectedFranchise) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (selectedState !== "all" && getUnitState(f) !== selectedState) return false;
    return true;
  });

  // Calculate revenue per state
  const stateRevenueData = React.useMemo(() => {
    const map: Record<string, number> = {};
    const baseUnits = allowedUnits.filter((f) => {
      if (selectedBusiness !== "all" && f.businessId !== selectedBusiness) return false;
      if (selectedFranchise !== "all" && f.id !== selectedFranchise) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      return true;
    });

    baseUnits.forEach((f) => {
      const state = getUnitState(f);
      const unitFin = getUnitRealFinancials(f.id, manualEntries, dateSelection);
      const fat = unitFin.count > 0 ? unitFin.faturamento : f.faturamento * periodMultiplier;
      map[state] = (map[state] || 0) + fat;
    });

    return Object.entries(map)
      .map(([state, value]) => ({ state, value }))
      .sort((a, b) => b.value - a.value);
  }, [allowedUnits, selectedBusiness, selectedFranchise, statusFilter, periodMultiplier, manualEntries, dateSelection]);

  // Calculate Aggregates
  let totalFat = 0;
  let totalLucro = 0;
  let totalImp = 0;
  let totalTaxas = 0;
  let totalDesp = 0;
  let totalCmv = 0;
  let totalRoyalties = 0;
  let totalFpp = 0; // Fundo de Propaganda e Promoção (2% standard)

  const unitCalculations = filteredUnits.map((f) => {
    const unitFin = getUnitRealFinancials(f.id, manualEntries, dateSelection);
    const fat = unitFin.count > 0 ? unitFin.faturamento : f.faturamento * periodMultiplier;
    const p = dreParams[f.id] || dreParams["dono"];
    const royPct = royalties[f.businessId] ?? (f.businessId === "biz1" ? 0.06 : f.businessId === "biz2" ? 0.05 : 0.07);
    const d = calculateUnitDre(fat, p, royPct, unitFin);
    const royValue = fat * royPct;
    const fppValue = fat * 0.02;

    totalFat += fat;
    totalLucro += d.lucroLiquido;
    totalImp += d.impostos;
    totalTaxas += d.taxasNegocio;
    totalDesp += d.totalDesp;
    totalCmv += d.cmv;
    totalRoyalties += royValue;
    totalFpp += fppValue;

    const biz = businesses.find((b) => b.id === f.businessId);

    return {
      f,
      biz,
      fat,
      d,
      royPct,
      royValue,
      fppValue,
      totalDevidoMatriz: royValue + fppValue,
    };
  });

  const margem = totalFat > 0 ? totalLucro / totalFat : 0;
  const avgFatPerUnit = filteredUnits.length > 0 ? totalFat / filteredUnits.length : 0;
  const avgRoyaltiesRate = totalFat > 0 ? (totalRoyalties / totalFat) * 100 : 6;

  // Série mensal do gráfico de tendência: usa somente lançamentos reais.
  // Meses sem lançamento aparecem zerados, nunca com valores estimados.
  const buildMonthlySeries = () => {
    const labels: string[] = [];
    const fat: number[] = [];
    const lucro: number[] = [];
    const roy: number[] = [];
    const unitIds = new Set(filteredUnits.map((u) => u.id));
    const monthTotals = (mVal: number, yrVal: number) => {
      const prefix = `${yrVal}-${String(mVal).padStart(2, "0")}`;
      let receitas = 0;
      let despesas = 0;
      for (const e of manualEntries || []) {
        if (e.excludedFromDre || e.isIntercompany || e.catId === "intercompany") continue;
        if (!unitIds.has(e.tenant)) continue;
        if (!(e.date || "").startsWith(prefix)) continue;
        if (e.type === "entrada") receitas += Number(e.value) || 0;
        else if (e.type === "despesa") despesas += Number(e.value) || 0;
      }
      return { receitas, despesas };
    };
    const push = (mVal: number, yrVal: number) => {
      const mObj = AVAILABLE_MONTHS.find((m) => m.value === mVal);
      labels.push(`${mObj?.short || mVal}/${yrVal.toString().slice(-2)}`.toUpperCase());
      const totals = monthTotals(mVal, yrVal);
      const valFat = Math.round(totals.receitas);
      fat.push(valFat);
      lucro.push(Math.round(totals.receitas - totals.despesas));
      roy.push(Math.round(valFat * (avgRoyaltiesRate / 100)));
    };
    const yr = dateSelection.years[0] || new Date().getFullYear();
    if (dateSelection.months.length > 1) {
      [...dateSelection.months].sort((a, b) => a - b).forEach((mVal) => push(mVal, yr));
    } else {
      const targetMonth = dateSelection.months[0] || new Date().getMonth() + 1;
      for (let i = 5; i >= 0; i--) {
        const offset = targetMonth - 1 - i;
        push(((offset % 12) + 12) % 12 + 1, yr + Math.floor(offset / 12));
      }
    }
    return { labels, fat, lucro, roy };
  };

  // Active Unit for Individual Unit View (KPIs de Unidades Individuais)
  const activeUnitId =
    selectedFranchise !== "all" && isUnitOwnedByUser(selectedFranchise)
      ? selectedFranchise
      : franchises.some((franchise) => franchise.id.toLowerCase() === currentTenantId?.toLowerCase()) && isUnitOwnedByUser(currentTenantId)
      ? currentTenantId
      : allowedUnits.find((f) => selectedBusiness === "all" || f.businessId === selectedBusiness)?.id || allowedUnits[0]?.id || franchises[0]?.id;

  // O banco pode estar legitimamente vazio após o reset. O Dashboard precisa
  // continuar navegável e mostrar estado vazio, em vez de acessar
  // `businessId` de uma unidade inexistente e desmontar toda a aplicação.
  const activeUnit = franchises.find((u) => u.id === activeUnitId) || allowedUnits[0] || franchises[0] || {
    id: "empty",
    businessId: "empty",
    name: "Nenhuma unidade cadastrada",
    code: "—",
    resp: "—",
    address: "",
    city: "",
    state: "",
    region: "",
    lat: 0,
    lng: 0,
    faturamento: 0,
    pendencias: 0,
    rpDone: 0,
    status: "green" as const,
  };
  const activeBiz = businesses.find((b) => b.id === activeUnit.businessId);

  // Dedicated metrics for activeUnit
  const activeUnitFin = getUnitRealFinancials(activeUnit.id, manualEntries, dateSelection);
  const unitFat = activeUnitFin.count > 0 ? activeUnitFin.faturamento : activeUnit.faturamento * periodMultiplier;
  const unitDreParams = dreParams[activeUnit.id] || dreParams["dono"];
  const unitRoyPct = royalties[activeUnit.businessId] ?? (activeUnit.businessId === "biz1" ? 0.06 : activeUnit.businessId === "biz2" ? 0.05 : 0.07);
  const unitDre = calculateUnitDre(unitFat, unitDreParams, unitRoyPct, activeUnitFin);
  const unitRoyValue = unitFat * unitRoyPct;
  const unitFppValue = unitFat * 0.02;
  const unitDevidoMatriz = unitRoyValue + unitFppValue;
  const unitLucro = unitDre.lucroLiquido;
  const unitMargem = unitFat > 0 ? unitLucro / unitFat : 0;
  const unitMargemBruta = unitFat > 0 ? unitDre.lucroBruto / unitFat : 0;

  // Ticket Médio e Volume de Atendimentos
  const baseTicket = activeUnit.businessId === "biz1" ? 38.5 : activeUnit.businessId === "biz2" ? 78.0 : 290.0;
  const unitEstimatedOrders = Math.max(1, Math.round(unitFat / baseTicket));
  const unitRealTicket = unitFat / unitEstimatedOrders;
  const networkAvgTicket = baseTicket;
  const ticketDeltaPct = ((unitRealTicket - networkAvgTicket) / networkAvgTicket) * 100;
  const networkAvgMargin = totalFat > 0 ? totalLucro / totalFat : 0.18;
  const marginDeltaPp = (unitMargem - networkAvgMargin) * 100;

  // Dias no período para média diária
  const daysInPeriod = Math.max(1, numYears * numMonths * numDays);
  const unitDailyAvg = unitFat / daysInPeriod;
  const unitSalesTarget = unitFat * 1.08;
  const unitTargetAtingido = Math.min(100, Math.round((unitFat / unitSalesTarget) * 100));

  // Ponto de equilíbrio (Break-Even da Unidade)
  const variableRatio = (unitDre.cmv + unitDre.impostos + unitDre.taxasNegocio + unitRoyValue + unitFppValue) / (unitFat || 1);
  const margemContribuicao = Math.max(0.15, 1 - variableRatio);
  const unitBreakEven = unitDre.totalDesp / margemContribuicao;

  // Build Charts
  useEffect(() => {
    // Power BI Custom Data Labels Plugin for Dashboard Screen
    const dashboardDataLabelsPlugin = {
      id: "dashboardDataLabels",
      afterDatasetsDraw(chart: any, args: any, options: any) {
        if (options?.enabled === false) return;
        const { ctx } = chart;
        ctx.save();

        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          if (!meta || meta.hidden) return;

          meta.data.forEach((element: any, index: number) => {
            const val = dataset.data[index];
            if (val === null || val === undefined || isNaN(val) || val === 0) return;

            const pos = element.tooltipPosition ? element.tooltipPosition() : null;
            if (!pos) return;

            // Compact currency formatting
            let text = "";
            const absVal = Math.abs(val);
            const sign = val < 0 ? "-" : "";
            if (absVal >= 1000000) {
              text = `${sign}R$ ${(absVal / 1000000).toFixed(1).replace(".", ",")}M`;
            } else if (absVal >= 1000) {
              text = `${sign}R$ ${(absVal / 1000).toFixed(0)}k`;
            } else {
              text = `${sign}R$ ${absVal.toFixed(0)}`;
            }

            ctx.font = "bold 9px sans-serif";
            const textWidth = ctx.measureText(text).width;
            const pillW = textWidth + 8;
            const pillH = 14;
            const pillX = pos.x - pillW / 2;

            const isLine = chart.config.type === "line";
            const isStacked = chart.config.options?.scales?.x?.stacked;

            let pillY;
            if (isLine) {
              // Offset slightly depending on datasetIndex to avoid line overlap
              const offset = datasetIndex === 0 ? -16 : datasetIndex === 1 ? 4 : -8;
              pillY = pos.y + offset;
            } else if (isStacked) {
              // Stacked bar: position inside the segment center
              pillY = pos.y - pillH / 2;
            } else {
              // Regular bar chart: position slightly above the top of the bar
              pillY = pos.y - pillH - 4;
            }

            // Prevent drawing outside the canvas top boundary
            if (pillY < 2) pillY = 2;

            // Background & Border colors
            let labelBgColor = "rgba(255, 255, 255, 0.95)";
            let textColor = "#17211f";
            let borderColor = dataset.borderColor || dataset.backgroundColor || "#0f4c5c";
            if (typeof borderColor === "object" && Array.isArray(borderColor)) {
              borderColor = borderColor[index] || "#0f4c5c";
            }

            ctx.fillStyle = labelBgColor;
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(pillX, pillY, pillW, pillH, 4);
            } else {
              ctx.rect(pillX, pillY, pillW, pillH);
            }
            ctx.fill();

            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = textColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, pos.x, pillY + pillH / 2 + 0.5);
          });
        });

        ctx.restore();
      }
    };

    // 1. Gráfico de Faturamento por Mês (Linha com Faturamento, Lucro e Royalties)
    if (monthlyCanvasRef.current) {
      if (monthlyChartInstance.current) {
        monthlyChartInstance.current.destroy();
      }

      const monthlySeries = buildMonthlySeries();
      const monthsLabels = monthlySeries.labels;
      const dataFatMes = monthlySeries.fat;
      const dataLucroMes = monthlySeries.lucro;
      const dataRoyMes = monthlySeries.roy;

      monthlyChartInstance.current = new Chart(monthlyCanvasRef.current, {
        type: "line",
        data: {
          labels: monthsLabels,
          datasets: [
            {
              label: "Faturamento Mensal (R$)",
              data: dataFatMes,
              borderColor: "#0f4c5c",
              backgroundColor: "rgba(60, 99, 218, 0.08)",
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              borderWidth: 2.5,
            },
            {
              label: "Lucro Líquido (R$)",
              data: dataLucroMes,
              borderColor: "#1a7f5a",
              backgroundColor: "transparent",
              tension: 0.35,
              pointRadius: 4,
              borderWidth: 2,
              borderDash: [5, 4],
            },
            {
              label: "Valor dos Royalties (R$)",
              data: dataRoyMes,
              borderColor: "#d97706",
              backgroundColor: "transparent",
              tension: 0.35,
              pointRadius: 3,
              borderWidth: 1.8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              onClick: (e, legendItem, legend) => {
                const index = legendItem.datasetIndex;
                const ci = legend.chart;
                if (index !== undefined) {
                  if (ci.isDatasetVisible(index)) {
                    ci.hide(index);
                    setHiddenMonthlyDatasets((prev) => ({ ...prev, [index]: true }));
                  } else {
                    ci.show(index);
                    setHiddenMonthlyDatasets((prev) => ({ ...prev, [index]: false }));
                  }
                }
              },
              labels: { boxWidth: 12, font: { size: 11, weight: 600 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: { grid: { display: false } },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      });
    }

    // 2. Gráfico de Faturamento por Unidade (Bar Chart)
    if (unitsCanvasRef.current) {
      if (unitsChartInstance.current) {
        unitsChartInstance.current.destroy();
      }

      const sortedByFat = [...unitCalculations].sort((a, b) => b.fat - a.fat);
      const labels = sortedByFat.map((u) => u.f.name.replace("Café ", "").replace("Beleza ", "").replace("EduKids ", ""));
      const dataFats = sortedByFat.map((u) => u.fat);
      const backgroundColors = sortedByFat.map((u) => (u.f.status === "green" ? "#0f4c5c" : "#f59e0b"));

      unitsChartInstance.current = new Chart(unitsCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Faturamento (R$)",
              data: dataFats,
              backgroundColor: backgroundColors,
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 24,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Faturamento: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10, weight: 600 } },
            },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      });
    }

    // 3. Gráfico de Colunas Empilhadas (Stacked Bar Chart: Lucro Líquido, Royalties, Despesas, CMV, Impostos)
    if (stackedCanvasRef.current) {
      if (stackedChartInstance.current) {
        stackedChartInstance.current.destroy();
      }

      const sortedUnits = [...unitCalculations].sort((a, b) => b.fat - a.fat);
      const labels = sortedUnits.map((u) => u.f.name.replace("Café ", "").replace("Beleza ", "").replace("EduKids ", ""));

      stackedChartInstance.current = new Chart(stackedCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Lucro Líquido",
              data: sortedUnits.map((u) => Math.max(0, u.d.lucroLiquido)),
              backgroundColor: "#1a7f5a", // Verde
              stack: "Stack 0",
              borderRadius: 0,
            },
            {
              label: "Valor dos Royalties",
              data: sortedUnits.map((u) => u.royValue),
              backgroundColor: "#eab308", // Amarelo/Dourado
              stack: "Stack 0",
            },
            {
              label: "Despesas Operacionais",
              data: sortedUnits.map((u) => u.d.totalDesp),
              backgroundColor: "#0f4c5c", // Azul
              stack: "Stack 0",
            },
            {
              label: "CMV / Insumos",
              data: sortedUnits.map((u) => u.d.cmv),
              backgroundColor: "#f43f5e", // Vermelho suave
              stack: "Stack 0",
            },
            {
              label: "Impostos Fiscais",
              data: sortedUnits.map((u) => u.d.impostos),
              backgroundColor: "#93a09b", // Cinza Ardósia
              stack: "Stack 0",
              borderRadius: { topLeft: 6, topRight: 6 },
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, font: { size: 10, weight: 600 } },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: { font: { size: 10, weight: 600 } },
            },
            y: {
              stacked: true,
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      });
    }

    // 4. Gráfico de Royalties por Unidade (Bar Chart de Royalties)
    if (royaltiesCanvasRef.current) {
      if (royaltiesChartInstance.current) {
        royaltiesChartInstance.current.destroy();
      }

      const sortedByRoy = [...unitCalculations].sort((a, b) => b.royValue - a.royValue);
      const labels = sortedByRoy.map((u) => u.f.name.replace("Café ", "").replace("Beleza ", "").replace("EduKids ", ""));

      royaltiesChartInstance.current = new Chart(royaltiesCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Royalties (R$)",
              data: sortedByRoy.map((u) => u.royValue),
              backgroundColor: "#d97706",
              borderRadius: 6,
              barThickness: 18,
            },
            {
              label: "Fundo de Propaganda (R$)",
              data: sortedByRoy.map((u) => u.fppValue),
              backgroundColor: "#8b5cf6",
              borderRadius: 6,
              barThickness: 18,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      });
    }

    // 5. Gráfico de Faturamento por Estado (Bar Chart de Estados)
    if (stateCanvasRef.current) {
      if (stateChartInstance.current) {
        stateChartInstance.current.destroy();
      }

      const labels = stateRevenueData.map((d) => d.state);
      const dataValues = stateRevenueData.map((d) => d.value);
      const backgroundColors = stateRevenueData.map((d) => {
        if (selectedState === "all" || d.state === selectedState) {
          return "#6a4ecb";
        }
        return "#c9d1cb";
      });

      stateChartInstance.current = new Chart(stateCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Faturamento (R$)",
              data: dataValues,
              backgroundColor: backgroundColors,
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 24,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Faturamento: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: 600 } },
            },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      });
    }

    // 6. Gráfico de Composição Estrutural de Custos & Despesas (Doughnut)
    if (expensePieCanvasRef.current) {
      if (expensePieChartInstance.current) {
        expensePieChartInstance.current.destroy();
      }

      expensePieChartInstance.current = new Chart(expensePieCanvasRef.current, {
        type: "doughnut",
        data: {
          labels: ["CMV (Insumos)", "Royalties & FPP", "Despesas Operacionais", "Impostos sobre Vendas", "Lucro Líquido Final"],
          datasets: [
            {
              data: [
                Math.max(0, totalCmv),
                Math.max(0, totalRoyalties + totalFpp),
                Math.max(0, totalDesp),
                Math.max(0, totalImp),
                Math.max(0, totalLucro),
              ],
              backgroundColor: ["#f43f5e", "#d97706", "#0f4c5c", "#93a09b", "#10b981"],
              borderWidth: 2,
              borderColor: "#ffffff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 10, font: { size: 10, weight: 600 } },
              onClick: (e, legendItem, legend) => {
                const index = legendItem.index;
                const ci = legend.chart;
                if (index !== undefined) {
                  ci.toggleDataVisibility(index);
                  ci.update();
                }
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${formatBrl(Number(ctx.raw))} (${((Number(ctx.raw) / (totalFat || 1)) * 100).toFixed(1)}%)`,
              },
            },
          },
        },
      });
    }

    // 7. Gráfico de Margem Líquida % por Unidade (Bar Chart)
    if (marginLineCanvasRef.current) {
      if (marginLineChartInstance.current) {
        marginLineChartInstance.current.destroy();
      }

      const sortedUnits = [...unitCalculations].sort((a, b) => b.d.margemLiquida - a.d.margemLiquida);
      const marginLabels = sortedUnits.map((u) => u.f.name.replace("Café ", "").replace("Beleza ", "").replace("EduKids ", ""));
      const marginData = sortedUnits.map((u) => Number((u.d.margemLiquida * 100).toFixed(1)));

      marginLineChartInstance.current = new Chart(marginLineCanvasRef.current, {
        type: "bar",
        data: {
          labels: marginLabels,
          datasets: [
            {
              label: "Margem Líquida (%)",
              data: marginData,
              backgroundColor: sortedUnits.map((u) => u.d.margemLiquida >= 0.15 ? "#10b981" : u.d.margemLiquida >= 0.08 ? "#f59e0b" : "#ef4444"),
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Margem Líquida: ${ctx.raw}%`,
              },
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v) => `${v}%` },
            },
            x: { grid: { display: false } },
          },
        },
      });
    }

    return () => {
      monthlyChartInstance.current?.destroy();
      unitsChartInstance.current?.destroy();
      stackedChartInstance.current?.destroy();
      royaltiesChartInstance.current?.destroy();
      stateChartInstance.current?.destroy();
      expensePieChartInstance.current?.destroy();
      marginLineChartInstance.current?.destroy();
    };
  }, [totalFat, totalLucro, totalRoyalties, totalFpp, totalCmv, totalDesp, totalImp, dateSelection, filteredUnits, showDataLabels, selectedState, stateRevenueData]);

  // Expanded/Maximized Chart Dialog Lifecycle Hook
  useEffect(() => {
    if (!expandedChart || !expandedCanvasRef.current) {
      if (expandedChartInstance.current) {
        expandedChartInstance.current.destroy();
        expandedChartInstance.current = null;
      }
      return;
    }

    if (expandedChartInstance.current) {
      expandedChartInstance.current.destroy();
    }

    const ctx = expandedCanvasRef.current;

    // Power BI Custom Data Labels Plugin for Expanded View
    const dashboardDataLabelsPlugin = {
      id: "dashboardDataLabels",
      afterDatasetsDraw(chart: any, args: any, options: any) {
        if (options?.enabled === false) return;
        const { ctx } = chart;
        ctx.save();
        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          if (!meta || meta.hidden) return;
          meta.data.forEach((element: any, index: number) => {
            const val = dataset.data[index];
            if (val === null || val === undefined || isNaN(val) || val === 0) return;
            const pos = element.tooltipPosition ? element.tooltipPosition() : null;
            if (!pos) return;

            let text = "";
            const absVal = Math.abs(val);
            const sign = val < 0 ? "-" : "";
            if (absVal >= 1000000) {
              text = `${sign}R$ ${(absVal / 1000000).toFixed(1).replace(".", ",")}M`;
            } else if (absVal >= 1000) {
              text = `${sign}R$ ${(absVal / 1000).toFixed(0)}k`;
            } else {
              text = `${sign}R$ ${absVal.toFixed(0)}`;
            }

            ctx.font = "bold 9px sans-serif";
            const textWidth = ctx.measureText(text).width;
            const pillW = textWidth + 8;
            const pillH = 14;
            const pillX = pos.x - pillW / 2;

            const isLine = chart.config.type === "line";
            const isStacked = chart.config.options?.scales?.x?.stacked;

            let pillY;
            if (isLine) {
              const offset = datasetIndex === 0 ? -16 : datasetIndex === 1 ? 4 : -8;
              pillY = pos.y + offset;
            } else if (isStacked) {
              pillY = pos.y - pillH / 2;
            } else {
              pillY = pos.y - pillH - 4;
            }
            if (pillY < 2) pillY = 2;

            let labelBgColor = "rgba(255, 255, 255, 0.95)";
            let textColor = "#17211f";
            let borderColor = dataset.borderColor || dataset.backgroundColor || "#0f4c5c";
            if (typeof borderColor === "object" && Array.isArray(borderColor)) {
              borderColor = borderColor[index] || "#0f4c5c";
            }

            ctx.fillStyle = labelBgColor;
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(pillX, pillY, pillW, pillH, 4);
            } else {
              ctx.rect(pillX, pillY, pillW, pillH);
            }
            ctx.fill();

            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = textColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, pos.x, pillY + pillH / 2 + 0.5);
          });
        });
        ctx.restore();
      }
    };

    let config: any = null;

    if (expandedChart === "mensal") {
      const monthlySeries = buildMonthlySeries();
      const monthsLabels = monthlySeries.labels;
      const dataFatMes = monthlySeries.fat;
      const dataLucroMes = monthlySeries.lucro;
      const dataRoyMes = monthlySeries.roy;

      config = {
        type: "line",
        data: {
          labels: monthsLabels,
          datasets: [
            {
              label: "Faturamento Mensal (R$)",
              data: dataFatMes,
              borderColor: "#0f4c5c",
              backgroundColor: "rgba(60, 99, 218, 0.08)",
              fill: true,
              tension: 0.35,
              pointRadius: 5,
              borderWidth: 3,
            },
            {
              label: "Lucro Líquido (R$)",
              data: dataLucroMes,
              borderColor: "#1a7f5a",
              backgroundColor: "transparent",
              tension: 0.35,
              pointRadius: 5,
              borderWidth: 2.5,
              borderDash: [5, 4],
            },
            {
              label: "Valor dos Royalties (R$)",
              data: dataRoyMes,
              borderColor: "#d97706",
              backgroundColor: "transparent",
              tension: 0.35,
              pointRadius: 4,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 14, font: { size: 12, weight: 600 } } },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `${ctx.dataset.label}: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v: any) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: { grid: { display: false } },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      };
    } else if (expandedChart === "unidades") {
      const sortedByFat = [...unitCalculations].sort((a, b) => b.fat - a.fat);
      const labels = sortedByFat.map((u) => u.f.name.replace("Café ", "").replace("Beleza ", "").replace("EduKids ", ""));
      const dataFats = sortedByFat.map((u) => u.fat);
      const backgroundColors = sortedByFat.map((u) => (u.f.status === "green" ? "#0f4c5c" : "#f59e0b"));

      config = {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Faturamento (R$)",
              data: dataFats,
              backgroundColor: backgroundColors,
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 32,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `Faturamento: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v: any) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: { grid: { display: false }, ticks: { font: { size: 11, weight: 600 } } },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      };
    } else if (expandedChart === "empilhado") {
      const sortedByFat = [...unitCalculations].sort((a, b) => b.fat - a.fat);
      const labels = sortedByFat.map((u) => u.f.name.replace("Café ", "").replace("Beleza ", "").replace("EduKids ", ""));

      config = {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Lucro Líquido",
              data: sortedByFat.map((u) => u.d.lucroLiquido),
              backgroundColor: "#1a7f5a",
              borderRadius: 6,
              barThickness: 28,
            },
            {
              label: "Royalties & FPP",
              data: sortedByFat.map((u) => u.totalDevidoMatriz),
              backgroundColor: "#eab308",
              borderRadius: 6,
              barThickness: 28,
            },
            {
              label: "Despesas",
              data: sortedByFat.map((u) => u.d.totalDesp),
              backgroundColor: "#0f4c5c",
              borderRadius: 6,
              barThickness: 28,
            },
            {
              label: "CMV (Insumos)",
              data: sortedByFat.map((u) => u.d.cmv),
              backgroundColor: "#f43f5e",
              borderRadius: 6,
              barThickness: 28,
            },
            {
              label: "Impostos",
              data: sortedByFat.map((u) => u.d.impostos),
              backgroundColor: "#93a09b",
              borderRadius: 6,
              barThickness: 28,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11, weight: 600 } } },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `${ctx.dataset.label}: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11, weight: 600 } } },
            y: {
              stacked: true,
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v: any) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      };
    } else if (expandedChart === "royalties") {
      const sortedByRoy = [...unitCalculations].sort((a, b) => b.royValue - a.royValue);
      const labels = sortedByRoy.map((u) => u.f.name.replace("Café ", "").replace("Beleza ", "").replace("EduKids ", ""));

      config = {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Royalties Pagos (6%)",
              data: sortedByRoy.map((u) => u.royValue),
              backgroundColor: "#f59e0b",
              borderRadius: 6,
              barThickness: 24,
            },
            {
              label: "Fundo Propaganda (2%)",
              data: sortedByRoy.map((u) => u.fppValue),
              backgroundColor: "#8b5cf6",
              borderRadius: 6,
              barThickness: 24,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `${ctx.dataset.label}: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v: any) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: { grid: { display: false }, ticks: { font: { size: 11, weight: 600 } } },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      };
    } else if (expandedChart === "estados") {
      const labels = stateRevenueData.map((d) => d.state);
      const dataValues = stateRevenueData.map((d) => d.value);
      const backgroundColors = stateRevenueData.map((d) => {
        if (selectedState === "all" || d.state === selectedState) {
          return "#6a4ecb";
        }
        return "#c9d1cb";
      });

      config = {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Faturamento (R$)",
              data: dataValues,
              backgroundColor: backgroundColors,
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 32,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `Faturamento: ${formatBrl(Number(ctx.raw))}`,
              },
            },
            // @ts-ignore
            dashboardDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            y: {
              grid: { color: "#f0f3f0" },
              ticks: { callback: (v: any) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 12, weight: 600 } },
            },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      };
    }

    if (config) {
      expandedChartInstance.current = new Chart(ctx, config);
    }

    return () => {
      if (expandedChartInstance.current) {
        expandedChartInstance.current.destroy();
        expandedChartInstance.current = null;
      }
    };
  }, [expandedChart, dateSelection, totalFat, totalLucro, totalRoyalties, showDataLabels, selectedState, stateRevenueData]);

  // Export functions
  const exportRoyaltiesReport = () => {
    const rows = [
      ["RELATÓRIO ESPECÍFICO DE ROYALTIES E FUNDO DE PROPAGANDA"],
      ["Data de Emissão", new Date().toLocaleString("pt-BR")],
      ["Período", getPeriodSummary()],
      [],
      [
        "Código",
        "Unidade Franqueada",
        "Marca",
        "Faturamento Base (R$)",
        "Taxa de Royalties (%)",
        "Valor dos Royalties (R$)",
        "FPP Fundo de Propaganda (2%)",
        "Total a Recolher para Matriz (R$)",
        "Status de Repasse",
      ],
    ];

    unitCalculations.forEach((u) => {
      rows.push([
        u.f.code,
        u.f.name,
        u.biz?.brand || u.biz?.name || "Rede",
        u.fat.toFixed(2),
        (u.royPct * 100).toFixed(1) + "%",
        u.royValue.toFixed(2),
        u.fppValue.toFixed(2),
        u.totalDevidoMatriz.toFixed(2),
        "Apurado",
      ]);
    });

    rows.push([]);
    rows.push([
      "TOTAIS DA REDE",
      "",
      "",
      totalFat.toFixed(2),
      avgRoyaltiesRate.toFixed(1) + "%",
      totalRoyalties.toFixed(2),
      totalFpp.toFixed(2),
      (totalRoyalties + totalFpp).toFixed(2),
      "Conciliado",
    ]);

    const csvContent = "\ufeff" + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Royalties_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 2. BARRA DE FILTROS COMPLETOS (ANO, MÊS, DIA, REDE, UNIDADE, STATUS) */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#dfe4df] bg-white p-4.5 shadow-xs space-y-4">
        {/* Header dos Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#f0f3f0]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e3eff1] text-[#0f4c5c]">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-[#17211f] ">
                Filtros do Analítico
              </span>
              <p className="text-[11px] text-[#5e6b67]">
                Filtro temporal separado por Ano, Mês e Dia com seleção múltipla, além de Rede e Unidades
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#0f4c5c] bg-[#e3eff1] px-2.5 py-1 rounded-full border border-[#0f4c5c]/20">
              {filteredUnits.length} unidade(s) filtrada(s)
            </span>
          </div>
        </div>

        {/* 1. SELETORES TEMPORAIS SEPARADOS: ANO, MÊS E DIA (Com Múltipla Escolha e Selecionar Tudo) */}
        <div>
          <DateMultiFilter selection={dateSelection} onChange={setDateSelection} />
        </div>

        {/* 2. FILTROS DA REDE / OPERACIONAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#f0f3f0]">
          {/* Filtro 1: Rede / Marca */}
          <div>
            <label
              htmlFor="filter-analytics-business"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#17211f] mb-1.5"
            >
              <Building2 className="h-3.5 w-3.5 text-[#0f4c5c]" />
              <span>Rede / Marca</span>
            </label>
            <select
              id="filter-analytics-business"
              value={selectedBusiness}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedBusiness(val);
                setSelectedFranchise("all");
                setViewMode("consolidated");
                onSelectTenant(val === "all" ? "dono" : val);
              }}
              className="w-full rounded-md border border-[#c9d1cb] bg-white px-3 py-2 text-[13px] font-semibold text-[#17211f] shadow-2xs hover:border-[#93a09b] focus:border-[#0f4c5c] focus:ring-2 focus:ring-[#0f4c5c]/15 focus:outline-none cursor-pointer transition-all"
            >
              <option value="all">Todas as Redes e Marcas</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro 2: Franqueado / Unidade */}
          <div>
            <label
              htmlFor="filter-analytics-franchise"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#17211f] mb-1.5"
            >
              <Store className="h-3.5 w-3.5 text-[#0f4c5c]" />
              <span>Unidade Franqueada</span>
            </label>
            <select
              id="filter-analytics-franchise"
              value={selectedFranchise}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFranchise(val);
                if (val !== "all") {
                  setViewMode("unit");
                  onSelectTenant(val);
                } else {
                  setViewMode("consolidated");
                  onSelectTenant(selectedBusiness === "all" ? "dono" : selectedBusiness);
                }
              }}
              className="w-full rounded-md border border-[#c9d1cb] bg-white px-3 py-2 text-[13px] font-semibold text-[#17211f] shadow-2xs hover:border-[#93a09b] focus:border-[#0f4c5c] focus:ring-2 focus:ring-[#0f4c5c]/15 focus:outline-none cursor-pointer transition-all"
            >
              {!isFranchisee && (
                <option value="all">
                  Todas as Unidades ({allowedUnits.filter((f) => selectedBusiness === "all" || f.businessId === selectedBusiness).length})
                </option>
              )}
              {allowedUnits
                .filter((f) => selectedBusiness === "all" || f.businessId === selectedBusiness)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Filtro 3: Saúde / Status da Operação */}
          <div>
            <label
              htmlFor="filter-analytics-status"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#17211f] mb-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#0f4c5c]" />
              <span>Status Operacional</span>
            </label>
            <select
              id="filter-analytics-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-md border border-[#c9d1cb] bg-white px-3 py-2 text-[13px] font-semibold text-[#17211f] shadow-2xs hover:border-[#93a09b] focus:border-[#0f4c5c] focus:ring-2 focus:ring-[#0f4c5c]/15 focus:outline-none cursor-pointer transition-all"
            >
              <option value="all">Todos os Status</option>
              <option value="green">🟢 Operação Saudável</option>
              <option value="amber">🟡 Em Atenção</option>
            </select>
          </div>

          {/* Filtro 4: Estado (UF) */}
          <div>
            <label
              htmlFor="filter-analytics-state"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#17211f] mb-1.5"
            >
              <Sliders className="h-3.5 w-3.5 text-[#0f4c5c]" />
              <span>Estado (UF)</span>
            </label>
            <select
              id="filter-analytics-state"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full rounded-md border border-[#c9d1cb] bg-white px-3 py-2 text-[13px] font-semibold text-[#17211f] shadow-2xs hover:border-[#93a09b] focus:border-[#0f4c5c] focus:ring-2 focus:ring-[#0f4c5c]/15 focus:outline-none cursor-pointer transition-all"
            >
              <option value="all">Todos os Estados ({availableStates.length})</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st === "SP" ? "São Paulo (SP)" : st === "PR" ? "Paraná (PR)" : st === "RJ" ? "Rio de Janeiro (RJ)" : st === "SC" ? "Santa Catarina (SC)" : st === "MG" ? "Minas Gerais (MG)" : st === "RS" ? "Rio Grande do Sul (RS)" : st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botão de Redefinir Filtros */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              setDateSelection({
                years: [CURRENT_YEAR],
                months: [CURRENT_MONTH],
                days: AVAILABLE_DAYS,
              });
              setSelectedBusiness("all");
              setSelectedFranchise(isFranchisee ? allowedUnits[0]?.id || "f1" : "all");
              setStatusFilter("all");
            }}
            className="text-[11px] font-bold text-[#5e6b67] hover:text-[#0f4c5c] transition-colors cursor-pointer"
          >
            Redefinir Filtros Padrão
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* PAINEL ANALÍTICO & GRÁFICOS                                   */}
      {/* ============================================================= */}
      <div className="space-y-6">
          <div className="rounded-2xl border border-[#dfe4df] bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Pressão de caixa por vencimento</h3>
                <p className="text-[11px] text-[#5e6b67] mt-1">Alertas calculados a partir dos compromissos da unidade ou rede selecionada.</p>
              </div>
              <button type="button" onClick={() => onNavigate("pagamentos_despesas")} className="text-[11px] font-extrabold text-[#0f4c5c] hover:underline">Abrir contas a pagar →</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3"><div className="flex items-center justify-between"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" /><span className="text-[10px] font-black text-rose-700">Vencidas</span></div><strong className="block mt-1 text-lg font-black text-rose-800">{formatBrl2(billSummary.overdue.amount)}</strong><span className="text-[10px] text-rose-700">{billSummary.overdue.count} compromisso(s)</span></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3"><div className="flex items-center justify-between"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /><span className="text-[10px] font-black text-amber-800">Próximos 7 dias</span></div><strong className="block mt-1 text-lg font-black text-amber-900">{formatBrl2(billSummary.today.amount + billSummary.soon.amount)}</strong><span className="text-[10px] text-amber-800">{billSummary.today.count + billSummary.soon.count} compromisso(s)</span></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3"><div className="flex items-center justify-between"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /><span className="text-[10px] font-black text-emerald-800">No prazo / pagos</span></div><strong className="block mt-1 text-lg font-black text-emerald-800">{formatBrl2(billSummary.scheduled.amount + billSummary.paid.amount)}</strong><span className="text-[10px] text-emerald-700">{billSummary.scheduled.count + billSummary.paid.count} compromisso(s)</span></div>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* SELETOR DE MODO DE VISÃO: CONSOLIDADO VS UNIDADE INDIVIDUAL  */}
          {/* ----------------------------------------------------------- */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-[#f7f9f7] via-white to-[#f0f3f0] border border-[#dfe4df] shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f4c5c]/10 text-[#0f4c5c]">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-[#17211f] flex items-center gap-1.5">
                  Visualização de Desempenho
                  {isFranchisee && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                      Painel do Franqueado
                    </span>
                  )}
                </span>
                <p className="text-[11px] text-[#5e6b67]">
                  {viewMode === "unit"
                    ? `Acompanhando indicadores específicos de: ${activeUnit.name} (${activeUnit.code})`
                    : "Visão agregada e consolidada de todas as lojas da rede"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-white border border-[#dfe4df] rounded-xl shadow-2xs">
              {!isFranchisee && (
                <button
                  type="button"
                  id="btn-view-consolidated"
                  onClick={() => {
                    setViewMode("consolidated");
                    setSelectedFranchise("all");
                    onSelectTenant(selectedBusiness === "all" ? "dono" : selectedBusiness);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === "consolidated"
                      ? "bg-[#0f4c5c] text-white shadow-xs"
                      : "text-[#5e6b67] hover:text-[#17211f] hover:bg-[#f7f9f7]"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Consolidado da Rede</span>
                </button>
              )}
              <button
                type="button"
                id="btn-view-unit"
                onClick={() => {
                  setViewMode("unit");
                  if (selectedFranchise === "all") {
                    const target = allowedUnits.find((f) => selectedBusiness === "all" || f.businessId === selectedBusiness)?.id || allowedUnits[0]?.id;
                    if (target) {
                      setSelectedFranchise(target);
                      onSelectTenant(target);
                    }
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "unit"
                    ? "bg-[#0f4c5c] text-white shadow-xs"
                    : "text-[#5e6b67] hover:text-[#17211f] hover:bg-[#f7f9f7]"
                }`}
              >
                <Store className="h-3.5 w-3.5" />
                <span>KPIs da Unidade</span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                  Vendas • Margem • Ticket
                </span>
              </button>
            </div>
          </div>

          {/* =========================================================== */}
          {/* MODO 1: VISÃO DE UNIDADE INDIVIDUAL (KPIS ESPECÍFICOS)      */}
          {/* =========================================================== */}
          {viewMode === "unit" ? (
            <div className="space-y-6">
              {/* Header da Unidade Ativa */}
              <div className="rounded-2xl border border-[#dfe4df] bg-white p-4.5 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-extrabold text-sm shadow-xs"
                      style={{ backgroundColor: activeBiz?.color || "#0f4c5c" }}
                    >
                      {activeBiz?.brand || "HQ"}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-[#17211f]">
                          {activeUnit.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded-md bg-[#f0f3f0] text-[#0b3b48] font-mono text-[11px] font-bold">
                          {activeUnit.code}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            activeUnit.status === "green"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              activeUnit.status === "green" ? "bg-emerald-600" : "bg-amber-600"
                            }`}
                          />
                          {activeUnit.status === "green" ? "Operação Saudável" : "Em Atenção Operacional"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-[#5e6b67] mt-1">
                        <span>
                          <strong className="text-[#17211f]">Rede:</strong> {activeBiz?.name}
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-[#17211f]">Responsável:</strong> {activeUnit.resp}
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-[#17211f]">Localização:</strong> {activeUnit.city}/{activeUnit.state || "SP"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Seletor Rápido de Unidade do Usuário */}
                  {allowedUnits.length > 1 && (
                    <div className="flex items-center gap-2 self-start md:self-auto bg-[#f7f9f7] p-2 rounded-xl border border-[#dfe4df]">
                      <span className="text-[11px] font-bold text-[#5e6b67]">Trocar Loja:</span>
                      <select
                        id="quick-unit-selector"
                        value={activeUnit.id}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedFranchise(val);
                          onSelectTenant(val);
                        }}
                        className="rounded-lg border border-[#dfe4df] bg-white py-1 px-2 text-xs font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none shadow-2xs cursor-pointer"
                      >
                        {allowedUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------- */}
              {/* OS 3 CARDS DE DESTAQUE ESPECÍFICOS SOLICITADOS          */}
              {/* (TOTAL DE VENDAS, MARGEM LÍQUIDA E TICKET MÉDIO)        */}
              {/* ------------------------------------------------------- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* CARD 1: TOTAL DE VENDAS */}
                <div className="rounded-2xl border-2 border-[#0f4c5c]/20 bg-gradient-to-br from-[#0f4c5c]/5 via-white to-white p-5 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f4c5c] text-white shadow-xs">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-[#0f4c5c] block">
                          Total de Vendas
                        </span>
                        <span className="text-[11px] text-[#5e6b67]">Faturamento da Unidade</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <ArrowUpRight className="h-3 w-3" />
                      +8.2% MoM
                    </span>
                  </div>

                  <div className="mt-4">
                    <strong className="text-2xl sm:text-3xl font-black text-[#17211f] block tracking-tight">
                      {formatBrl(unitFat)}
                    </strong>
                    <div className="flex items-center justify-between text-xs text-[#5e6b67] mt-2">
                      <span>Média diária: <strong className="text-[#17211f]">{formatBrl(unitDailyAvg)}/dia</strong></span>
                      <span><strong>{unitEstimatedOrders.toLocaleString("pt-BR")}</strong> pedidos</span>
                    </div>
                  </div>

                  {/* Barra de Progresso de Meta da Unidade */}
                  <div className="mt-3.5 pt-3 border-t border-[#dfe4df]">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-[#5e6b67]">Meta do Período ({unitTargetAtingido}%)</span>
                      <span className="font-extrabold text-[#17211f]">{formatBrl(unitSalesTarget)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#dfe4df] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0f4c5c] to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, unitTargetAtingido)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* CARD 2: MARGEM LÍQUIDA */}
                <div className="rounded-2xl border-2 border-emerald-300/40 bg-gradient-to-br from-emerald-50/50 via-white to-white p-5 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-emerald-800 block">
                          Margem Líquida
                        </span>
                        <span className="text-[11px] text-[#5e6b67]">Rentabilidade Real</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
                        marginDeltaPp >= 0
                          ? "text-emerald-800 bg-emerald-100 border-emerald-200"
                          : "text-amber-800 bg-amber-100 border-amber-200"
                      }`}
                    >
                      {marginDeltaPp >= 0 ? "+" : ""}
                      {marginDeltaPp.toFixed(1)} p.p. vs rede
                    </span>
                  </div>

                  <div className="mt-4">
                    <strong className="text-2xl sm:text-3xl font-black text-emerald-700 block tracking-tight">
                      {formatPct(unitMargem)}
                    </strong>
                    <div className="flex items-center justify-between text-xs text-[#5e6b67] mt-2">
                      <span>Lucro líquido: <strong className="text-emerald-800 font-bold">{formatBrl(unitLucro)}</strong></span>
                      <span>Margem bruta: <strong className="text-[#17211f]">{formatPct(unitMargemBruta)}</strong></span>
                    </div>
                  </div>

                  {/* Classificação de Saúde Financeira */}
                  <div className="mt-3.5 pt-3 border-t border-[#dfe4df] flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#5e6b67]">Diagnóstico Operacional:</span>
                    <span className="font-extrabold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {unitMargem >= 0.18 ? "Rentabilidade Excelente" : "Rentabilidade Saudável"}
                    </span>
                  </div>
                </div>

                {/* CARD 3: TICKET MÉDIO */}
                <div className="rounded-2xl border-2 border-amber-300/40 bg-gradient-to-br from-amber-50/50 via-white to-white p-5 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-amber-800 block">
                          Ticket Médio
                        </span>
                        <span className="text-[11px] text-[#5e6b67]">Gasto Médio por Venda</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
                        ticketDeltaPct >= 0
                          ? "text-emerald-800 bg-emerald-100 border-emerald-200"
                          : "text-amber-800 bg-amber-100 border-amber-200"
                      }`}
                    >
                      {ticketDeltaPct >= 0 ? "+" : ""}
                      {ticketDeltaPct.toFixed(1)}% vs padrão
                    </span>
                  </div>

                  <div className="mt-4">
                    <strong className="text-2xl sm:text-3xl font-black text-amber-900 block tracking-tight">
                      {formatBrl2(unitRealTicket)}
                    </strong>
                    <div className="flex items-center justify-between text-xs text-[#5e6b67] mt-2">
                      <span>Volume: <strong className="text-[#17211f]">{unitEstimatedOrders.toLocaleString("pt-BR")} transações</strong></span>
                      <span>Média rede: <strong className="text-[#17211f]">{formatBrl2(networkAvgTicket)}</strong></span>
                    </div>
                  </div>

                  {/* Indicador de Desempenho do Ticket */}
                  <div className="mt-3.5 pt-3 border-t border-[#dfe4df] flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#5e6b67]">Média de Itens/Cupom:</span>
                    <span className="font-extrabold text-[#17211f] flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      2.4 produtos por atendimento
                    </span>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------- */}
              {/* INDICADORES OPERACIONAIS E FINANCEIROS COMPLEMENTARES   */}
              {/* ------------------------------------------------------- */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* 1. Lucro Líquido Real */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    Lucro Líquido Real
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-emerald-700 block mt-1">
                    {formatBrl(unitLucro)}
                  </strong>
                  <span className="text-[10px] text-[#5e6b67] block mt-1">
                    Retenção líquida da unidade
                  </span>
                </div>

                {/* 2. CMV da Loja (Insumos) */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    CMV (Insumos/Produtos)
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-[#b93a48] block mt-1">
                    {formatBrl(unitDre.cmv)}
                  </strong>
                  <span className="text-[10px] text-[#5e6b67] block mt-1">
                    {unitFat > 0 ? ((unitDre.cmv / unitFat) * 100).toFixed(1) : 0}% das vendas
                  </span>
                </div>

                {/* 3. Despesas Fixas e Pessoal */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    Despesas Operacionais
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-[#0b3b48] block mt-1">
                    {formatBrl(unitDre.totalDesp)}
                  </strong>
                  <span className="text-[10px] text-[#5e6b67] block mt-1">
                    Equipe, aluguel & ocupação
                  </span>
                </div>

                {/* 4. Royalties & FPP Devidos */}
                <div className="rounded-xl border border-[#dfe4df] bg-amber-50/40 border-amber-200/70 p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-amber-800 block">
                    Royalties & FPP Devidos
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-amber-900 block mt-1">
                    {formatBrl(unitDevidoMatriz)}
                  </strong>
                  <span className="text-[10px] text-amber-800 block mt-1">
                    {(unitRoyPct * 100).toFixed(1)}% Roy + 2% FPP
                  </span>
                </div>

                {/* 5. Ponto de Equilíbrio (Break-Even) */}
                <div className="col-span-2 lg:col-span-1 rounded-xl border border-[#dfe4df] bg-[#f7f9f7] p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#0f4c5c] block">
                    Break-Even (Ponto Equilíbrio)
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-[#17211f] block mt-1">
                    {formatBrl(unitBreakEven)}
                  </strong>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                    Venda mínima p/ cobrir custos
                  </span>
                </div>
              </div>

              {/* ------------------------------------------------------- */}
              {/* RAIO-X: DESTINO DE CADA R$ 100 FATURADOS PELA UNIDADE   */}
              {/* ------------------------------------------------------- */}
              <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#0f4c5c]" />
                      Raio-X Financeiro: Onde vai cada R$ 100,00 faturados por esta unidade?
                    </h3>
                    <p className="text-xs text-[#5e6b67]">
                      Distribuição matemática dos custos, tributos, taxas de franquia e margem líquida retida pela loja.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                    Retenção Líquida: R$ {unitFat > 0 ? ((unitLucro / unitFat) * 100).toFixed(1) : "0.00"} a cada R$ 100
                  </span>
                </div>

                {/* Barra Empilhada Proporcional */}
                <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-2xs">
                  <div
                    style={{ width: `${Math.max(5, (unitDre.cmv / (unitFat || 1)) * 100)}%` }}
                    className="bg-[#b93a48] h-full flex items-center justify-center text-[10px] text-white font-extrabold"
                    title={`CMV: ${formatPct(unitDre.cmv / unitFat)}`}
                  >
                    CMV
                  </div>
                  <div
                    style={{ width: `${Math.max(5, (unitDre.totalDesp / (unitFat || 1)) * 100)}%` }}
                    className="bg-[#0b3b48] h-full flex items-center justify-center text-[10px] text-white font-extrabold"
                    title={`Despesas: ${formatPct(unitDre.totalDesp / unitFat)}`}
                  >
                    Desp.
                  </div>
                  <div
                    style={{ width: `${Math.max(4, (unitDre.impostos / (unitFat || 1)) * 100)}%` }}
                    className="bg-[#8b5cf6] h-full flex items-center justify-center text-[10px] text-white font-extrabold"
                    title={`Impostos: ${formatPct(unitDre.impostos / unitFat)}`}
                  >
                    Imp.
                  </div>
                  <div
                    style={{ width: `${Math.max(4, (unitDevidoMatriz / (unitFat || 1)) * 100)}%` }}
                    className="bg-[#f59e0b] h-full flex items-center justify-center text-[10px] text-white font-extrabold"
                    title={`Royalties & FPP: ${formatPct(unitDevidoMatriz / unitFat)}`}
                  >
                    Roy
                  </div>
                  <div
                    style={{ width: `${Math.max(5, (unitLucro / (unitFat || 1)) * 100)}%` }}
                    className="bg-[#10b981] h-full flex items-center justify-center text-[10px] text-white font-extrabold"
                    title={`Lucro Líquido: ${formatPct(unitLucro / unitFat)}`}
                  >
                    Lucro
                  </div>
                </div>

                {/* Legenda Detalhada */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-3 border-t border-[#dfe4df] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#b93a48] shrink-0" />
                    <div>
                      <span className="text-[#5e6b67] block text-[10px]">Insumos (CMV)</span>
                      <strong className="text-[#17211f]">R$ {unitFat > 0 ? ((unitDre.cmv / unitFat) * 100).toFixed(1) : 0}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#0b3b48] shrink-0" />
                    <div>
                      <span className="text-[#5e6b67] block text-[10px]">Despesas & Equipe</span>
                      <strong className="text-[#17211f]">R$ {unitFat > 0 ? ((unitDre.totalDesp / unitFat) * 100).toFixed(1) : 0}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#8b5cf6] shrink-0" />
                    <div>
                      <span className="text-[#5e6b67] block text-[10px]">Impostos Fiscais</span>
                      <strong className="text-[#17211f]">R$ {unitFat > 0 ? ((unitDre.impostos / unitFat) * 100).toFixed(1) : 0}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#f59e0b] shrink-0" />
                    <div>
                      <span className="text-[#5e6b67] block text-[10px]">Royalties & FPP</span>
                      <strong className="text-[#17211f]">R$ {unitFat > 0 ? ((unitDevidoMatriz / unitFat) * 100).toFixed(1) : 0}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#10b981] shrink-0" />
                    <div>
                      <span className="text-emerald-700 block text-[10px] font-bold">Lucro Líquido Loja</span>
                      <strong className="text-emerald-700 font-black">R$ {unitFat > 0 ? ((unitLucro / unitFat) * 100).toFixed(1) : 0}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela de Metas & Comparativo com a Rede */}
              <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2">
                    <Scale className="h-4 w-4 text-[#0f4c5c]" />
                    Benchmark Comparativo: Unidade vs Padrão da Rede Franqueadora
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#dfe4df] bg-[#f7f9f7] text-[11px] font-extrabold text-[#5e6b67]">
                        <th className="py-2.5 px-3">Indicador de Desempenho</th>
                        <th className="py-2.5 px-3">Esta Unidade ({activeUnit.code})</th>
                        <th className="py-2.5 px-3">Média da Rede</th>
                        <th className="py-2.5 px-3">Diferencial</th>
                        <th className="py-2.5 px-3">Classificação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dfe4df] font-medium">
                      <tr>
                        <td className="py-3 px-3 font-bold text-[#17211f] flex items-center gap-1.5">
                          <ShoppingBag className="h-3.5 w-3.5 text-[#0f4c5c]" />
                          Total de Vendas / Faturamento
                        </td>
                        <td className="py-3 px-3 font-extrabold text-[#17211f]">{formatBrl(unitFat)}</td>
                        <td className="py-3 px-3 text-[#5e6b67]">{formatBrl(avgFatPerUnit)}</td>
                        <td className="py-3 px-3 text-emerald-700 font-bold">
                          {unitFat >= avgFatPerUnit ? "+" : ""}
                          {avgFatPerUnit > 0 ? (((unitFat - avgFatPerUnit) / avgFatPerUnit) * 100).toFixed(1) : 0}%
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            {unitFat >= avgFatPerUnit ? "Acima da Média" : "Em Alinhamento"}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-bold text-[#17211f] flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                          Margem Líquida da Operação
                        </td>
                        <td className="py-3 px-3 font-extrabold text-emerald-700">{formatPct(unitMargem)}</td>
                        <td className="py-3 px-3 text-[#5e6b67]">{formatPct(networkAvgMargin)}</td>
                        <td className="py-3 px-3 text-emerald-700 font-bold">
                          {marginDeltaPp >= 0 ? "+" : ""}
                          {marginDeltaPp.toFixed(1)} p.p.
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            {unitMargem >= 0.18 ? "Alta Rentabilidade" : "Saudável"}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-bold text-[#17211f] flex items-center gap-1.5">
                          <Receipt className="h-3.5 w-3.5 text-amber-600" />
                          Ticket Médio por Venda
                        </td>
                        <td className="py-3 px-3 font-extrabold text-amber-900">{formatBrl2(unitRealTicket)}</td>
                        <td className="py-3 px-3 text-[#5e6b67]">{formatBrl2(networkAvgTicket)}</td>
                        <td className="py-3 px-3 text-emerald-700 font-bold">
                          {ticketDeltaPct >= 0 ? "+" : ""}
                          {ticketDeltaPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                            Padrão de Rede
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-bold text-[#17211f] flex items-center gap-1.5">
                          <Scale className="h-3.5 w-3.5 text-[#b93a48]" />
                          CMV % (Custo Mercadorias Vendidas)
                        </td>
                        <td className="py-3 px-3 font-extrabold text-[#b93a48]">
                          {unitFat > 0 ? formatPct(unitDre.cmv / unitFat) : "0%"}
                        </td>
                        <td className="py-3 px-3 text-[#5e6b67]">
                          {totalFat > 0 ? formatPct(totalCmv / totalFat) : "35.0%"}
                        </td>
                        <td className="py-3 px-3 text-emerald-700 font-bold">
                          Controlado
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            Dentro do Padrão
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================== */
            /* MODO 2: VISÃO CONSOLIDADA DA REDE DE FRANQUIAS             */
            /* =========================================================== */
            <div className="space-y-6">
              {/* Banner convite para visão individual */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-blue-900">
                  <Store className="h-4 w-4 text-[#0f4c5c]" />
                  <span>
                    Deseja inspecionar uma loja individualmente com <strong>Total de Vendas</strong>, <strong>Margem Líquida</strong> e <strong>Ticket Médio</strong>?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("unit");
                    if (selectedFranchise === "all") {
                      const target = allowedUnits.find((f) => selectedBusiness === "all" || f.businessId === selectedBusiness)?.id || allowedUnits[0]?.id;
                      if (target) {
                        setSelectedFranchise(target);
                        onSelectTenant(target);
                      }
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0f4c5c] text-white font-extrabold text-xs shadow-xs hover:bg-[#0b3b48] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Abrir KPIs da Loja</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 8 Cards Analíticos Consolidados */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Faturamento Total */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    Faturamento Bruto
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#17211f] block mt-1">
                    {formatBrl(totalFat)}
                  </strong>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      +6.2% MoM
                    </span>
                    <span className="text-[10px] text-[#5e6b67]">vs período ant.</span>
                  </div>
                </div>

                {/* 2. Faturamento Médio por Loja */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    Média por Unidade
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#0f4c5c] block mt-1">
                    {formatBrl(avgFatPerUnit)}
                  </strong>
                  <span className="text-[10px] text-[#5e6b67] block mt-1">
                    {filteredUnits.length} lojas ativas no filtro
                  </span>
                </div>

                {/* 3. Valor dos Royalties (DESTACADO EXPLICITAMENTE SOLICITADO) */}
                <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-amber-800">
                      Valor dos Royalties
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                      {avgRoyaltiesRate.toFixed(1)}% Médio
                    </span>
                  </div>
                  <strong className="text-xl sm:text-2xl font-extrabold text-amber-900 block mt-1">
                    {formatBrl(totalRoyalties)}
                  </strong>
                  <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-800">
                    <Coins className="h-3 w-3 text-amber-600" />
                    <span>Recolhimento contratual da matriz</span>
                  </div>
                </div>

                {/* 4. Fundo de Propaganda (FPP) */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    Fundo Propaganda (FPP)
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-purple-700 block mt-1">
                    {formatBrl(totalFpp)}
                  </strong>
                  <span className="text-[10px] text-[#5e6b67] block mt-1">
                    2.0% padrão da rede franqueada
                  </span>
                </div>

                {/* 5. Lucro Líquido Real DRE */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    Lucro Líquido Consolidado
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#1a7f5a] block mt-1">
                    {formatBrl(totalLucro)}
                  </strong>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                    Margem líquida: {formatPct(margem)}
                  </span>
                </div>

                {/* 6. CMV Total (Insumos) */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    CMV Consolidado (Insumos)
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#b93a48] block mt-1">
                    {formatBrl(totalCmv)}
                  </strong>
                  <span className="text-[10px] text-[#5e6b67] block mt-1">
                    {totalFat > 0 ? ((totalCmv / totalFat) * 100).toFixed(1) : 0}% do faturamento
                  </span>
                </div>

                {/* 7. Despesas Operacionais Totais */}
                <div className="rounded-xl border border-[#dfe4df] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#5e6b67] block">
                    Despesas Operacionais
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#0b3b48] block mt-1">
                    {formatBrl(totalDesp)}
                  </strong>
                  <span className="text-[10px] text-[#5e6b67] block mt-1">
                    Pessoal, ocupação & utilidades
                  </span>
                </div>

                {/* 8. Total Devido à Matriz (Royalties + FPP) */}
                <div className="rounded-xl border border-[#dfe4df] bg-[#f7f9f7] p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold text-[#0f4c5c] block">
                    Total Faturado à Matriz
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#17211f] block mt-1">
                    {formatBrl(totalRoyalties + totalFpp)}
                  </strong>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                    Royalties + Fundo de Propaganda
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* SELETOR DE FOCO DE GRÁFICOS & CONTROLE DE RÓTULOS           */}
          {/* ----------------------------------------------------------- */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 p-3 bg-[#f7f9f7] rounded-2xl border border-[#dfe4df]">
            {/* Toggle Rótulos de Dados do Painel */}
            <button
              type="button"
              onClick={() => setShowDataLabels((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${
                showDataLabels
                  ? "bg-[#0f4c5c] text-white border-[#0f4c5c] shadow-xs"
                  : "bg-white text-[#5e6b67] border-[#c9d1cb] hover:bg-[#f7f9f7]"
              }`}
              title="Ligar ou desligar rótulos de dados nos gráficos"
            >
              <span>Rótulos: {showDataLabels ? "Ligados" : "Desligados"}</span>
            </button>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* GRÁFICOS: FATURAMENTO POR UNIDADE & FATURAMENTO POR MÊS     */}
          {/* ----------------------------------------------------------- */}
          {(activeChartFilter === "all" || activeChartFilter === "unidades" || activeChartFilter === "mensal") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Gráfico 1: Faturamento por Unidade */}
              {(activeChartFilter === "all" || activeChartFilter === "unidades") && (
                <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2">
                        <Store className="h-4 w-4 text-[#0f4c5c]" />
                        Faturamento por Unidade (R$)
                      </h3>
                      <p className="text-[11px] text-[#5e6b67] mt-0.5">
                        Comparativo de receita bruta das lojas franqueadas
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedChart("unidades")}
                        className="p-1.5 rounded-lg border border-[#dfe4df] bg-white text-[#5e6b67] hover:text-[#0f4c5c] hover:bg-[#e3eff1] cursor-pointer transition-all flex items-center gap-1 text-[10px] font-extrabold"
                        title="Ampliar gráfico"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span>Ampliar</span>
                      </button>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#e3eff1] text-[#0f4c5c]">
                        {filteredUnits.length} Lojas
                      </span>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    <canvas ref={unitsCanvasRef} />
                  </div>
                </div>
              )}

              {/* Gráfico 2: Faturamento por Mês */}
              {(activeChartFilter === "all" || activeChartFilter === "mensal") && (
                <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[#0f4c5c]" />
                        Faturamento por Mês (Evolução Temporal)
                      </h3>
                      <p className="text-[11px] text-[#5e6b67] mt-0.5">
                        Tendência mês a mês: Faturamento, Lucro Líquido e Royalties
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedChart("mensal")}
                        className="p-1.5 rounded-lg border border-[#dfe4df] bg-white text-[#5e6b67] hover:text-[#0f4c5c] hover:bg-[#e3eff1] cursor-pointer transition-all flex items-center gap-1 text-[10px] font-extrabold"
                        title="Ampliar gráfico"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span>Ampliar</span>
                      </button>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        Série Histórica
                      </span>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    <canvas ref={monthlyCanvasRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* GRÁFICO 3: GRÁFICO DE COLUNAS EMPILHADAS                    */}
          {/* ----------------------------------------------------------- */}
          {(activeChartFilter === "all" || activeChartFilter === "empilhado") && (
            <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      Gráfico de Colunas Empilhadas (Decomposição Estrutural de Custos & Lucro)
                    </h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Empilhado
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5e6b67] mt-0.5">
                    Decomposição exata de cada unidade em: Lucro Líquido, Royalties, Despesas Operacionais, CMV e Impostos.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedChart("empilhado")}
                    className="p-1.5 rounded-lg border border-[#dfe4df] bg-white text-[#5e6b67] hover:text-[#0f4c5c] hover:bg-[#e3eff1] cursor-pointer transition-all flex items-center gap-1 text-[10px] font-extrabold shadow-2xs"
                    title="Ampliar gráfico"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Ampliar</span>
                  </button>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-[#5e6b67]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#1a7f5a]" /> Lucro</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#eab308]" /> Royalties</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#0f4c5c]" /> Despesas</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f43f5e]" /> CMV</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#93a09b]" /> Impostos</span>
                  </div>
                </div>
              </div>
              <div className="h-80 w-full">
                <canvas ref={stackedCanvasRef} />
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* GRÁFICO 4: VALOR DOS ROYALTIES & APURAÇÃO POR UNIDADE        */}
          {/* ----------------------------------------------------------- */}
          {(activeChartFilter === "all" || activeChartFilter === "royalties") && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Gráfico de Barras dos Royalties */}
              <div className="lg:col-span-5 rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-600" />
                      Valor dos Royalties por Unidade
                    </h3>
                    <p className="text-[11px] text-[#5e6b67] mt-0.5">
                      Royalties contratuais vs Fundo de Propaganda
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedChart("royalties")}
                      className="p-1.5 rounded-lg border border-[#dfe4df] bg-white text-[#5e6b67] hover:text-[#0f4c5c] hover:bg-[#e3eff1] cursor-pointer transition-all flex items-center gap-1 text-[10px] font-extrabold"
                      title="Ampliar gráfico"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Ampliar</span>
                    </button>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      {formatBrl(totalRoyalties)}
                    </span>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <canvas ref={royaltiesCanvasRef} />
                </div>
              </div>

              {/* Tabela Analítica de Royalties das Lojas */}
              <div className="lg:col-span-7 rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      Tabela de Apuração de Royalties da Rede
                    </h3>
                    <button
                      onClick={exportRoyaltiesReport}
                      className="flex items-center gap-1 text-[11px] font-extrabold text-[#0f4c5c] hover:underline cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#dfe4df] text-[10px] font-extrabold text-[#5e6b67]">
                          <th className="pb-2">Unidade / Código</th>
                          <th className="pb-2">Faturamento</th>
                          <th className="pb-2 text-center">Taxa</th>
                          <th className="pb-2 text-right">Valor Royalties</th>
                          <th className="pb-2 text-right">FPP (2%)</th>
                          <th className="pb-2 text-right">Total Matriz</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f3f0]">
                        {unitCalculations.slice(0, 7).map((u) => (
                          <tr key={u.f.id} className="hover:bg-[#f7f9f7] transition-colors">
                            <td className="py-2.5">
                              <span className="font-extrabold text-[#17211f] block">{u.f.name}</span>
                              <span className="text-[10px] text-[#5e6b67] font-mono">{u.f.code}</span>
                            </td>
                            <td className="py-2.5 font-medium text-[#17211f]">{formatBrl(u.fat)}</td>
                            <td className="py-2.5 text-center">
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-extrabold text-[10px]">
                                {(u.royPct * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-extrabold text-amber-900">
                              {formatBrl(u.royValue)}
                            </td>
                            <td className="py-2.5 text-right text-purple-700 font-medium">
                              {formatBrl(u.fppValue)}
                            </td>
                            <td className="py-2.5 text-right font-black text-[#17211f]">
                              {formatBrl(u.totalDevidoMatriz)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#dfe4df] flex items-center justify-between text-xs font-bold text-[#17211f]">
                  <span>Total Consolidado da Rede:</span>
                  <span className="text-emerald-700 font-black text-sm">
                    {formatBrl(totalRoyalties + totalFpp)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* GRÁFICO 5: FATURAMENTO POR ESTADO                           */}
          {/* ----------------------------------------------------------- */}
          {(activeChartFilter === "all" || activeChartFilter === "estados") && (
            <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#17211f] flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[#6a4ecb]" />
                    Faturamento Consolidado por Estado (R$)
                  </h3>
                  <p className="text-[11px] text-[#5e6b67] mt-0.5">
                    Visão geográfica do faturamento da rede de franquias
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedChart("estados")}
                    className="p-1.5 rounded-lg border border-[#dfe4df] bg-white text-[#5e6b67] hover:text-[#0f4c5c] hover:bg-[#e3eff1] cursor-pointer transition-all flex items-center gap-1 text-[10px] font-extrabold shadow-2xs"
                    title="Ampliar gráfico"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Ampliar</span>
                  </button>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                    Geográfico
                  </span>
                </div>
              </div>
              <div className="h-72 w-full">
                <canvas ref={stateCanvasRef} />
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* RANKING COMPLETO E COMPARATIVO DE PERFORMANCE               */}
          {/* ----------------------------------------------------------- */}
          <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#17211f]">
                  Ranking de Performance Financeira das Franquias
                </h3>
                <p className="text-[11px] text-[#5e6b67] mt-0.5">
                  Ordenado por maior lucratividade líquida e eficiência operacional apurada
                </p>
              </div>
              <button
                onClick={() => onNavigate("dre")}
                className="flex items-center gap-1 text-xs font-extrabold text-[#0f4c5c] hover:underline cursor-pointer"
              >
                <span>Ver DRE Completo</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dfe4df] text-[10px] font-extrabold text-[#5e6b67]">
                    <th className="pb-2.5">Pos.</th>
                    <th className="pb-2.5">Franquia</th>
                    <th className="pb-2.5">Rede</th>
                    <th className="pb-2.5 text-right">Faturamento</th>
                    <th className="pb-2.5 text-right">CMV</th>
                    <th className="pb-2.5 text-right">Royalties</th>
                    <th className="pb-2.5 text-right">Lucro Líquido</th>
                    <th className="pb-2.5 text-center">Margem</th>
                    <th className="pb-2.5 text-center">Saúde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f3f0]">
                  {[...unitCalculations]
                    .sort((a, b) => b.d.lucroLiquido - a.d.lucroLiquido)
                    .map((u, idx) => (
                      <tr key={u.f.id} className="hover:bg-[#f7f9f7] transition-colors">
                        <td className="py-3 font-bold text-[#5e6b67]">#{idx + 1}</td>
                        <td className="py-3">
                          <button
                            onClick={() => onSelectTenant(u.f.id)}
                            className="font-extrabold text-[#17211f] hover:text-[#0f4c5c] text-left cursor-pointer"
                          >
                            {u.f.name}
                          </button>
                          <span className="block text-[10px] text-[#5e6b67]">{u.f.city} — Resp: {u.f.resp}</span>
                        </td>
                        <td className="py-3 font-medium text-[#5e6b67]">{u.biz?.brand || "Rede"}</td>
                        <td className="py-3 text-right font-extrabold text-[#17211f]">{formatBrl(u.fat)}</td>
                        <td className="py-3 text-right text-[#b93a48]">{formatBrl(u.d.cmv)}</td>
                        <td className="py-3 text-right text-amber-800 font-bold">{formatBrl(u.royValue)}</td>
                        <td className="py-3 text-right font-black text-[#1a7f5a]">{formatBrl(u.d.lucroLiquido)}</td>
                        <td className="py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-800">
                            {formatPct(u.d.margemLiquida)}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          {u.f.status === "green" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" /> Saudável
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="h-3 w-3" /> Atenção
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE GRÁFICO AMPLIADO / MAXIMIZADO                       */}
      {/* ------------------------------------------------------------- */}
      {expandedChart && (
        <div 
          className="fixed inset-0 bg-[#17211f]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setExpandedChart(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-[#c9d1cb] shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#f0f3f0] mb-4">
              <div>
                <span className="text-[10px] font-extrabold text-[#0f4c5c]">
                  Visualização em Alta Resolução
                </span>
                <h2 className="text-lg font-black text-[#17211f]">
                  {expandedChart === "mensal" && "Evolução Temporal Mensal"}
                  {expandedChart === "unidades" && "Faturamento por Unidade"}
                  {expandedChart === "empilhado" && "Colunas Empilhadas - Estrutura de Custos"}
                  {expandedChart === "royalties" && "Royalties e Fundo de Propaganda por Unidade"}
                  {expandedChart === "estados" && "Faturamento Consolidado por Estado"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setExpandedChart(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-all cursor-pointer"
              >
                Fechar [X]
              </button>
            </div>
            <div className="flex-1 w-full relative min-h-0">
              <canvas ref={expandedCanvasRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
