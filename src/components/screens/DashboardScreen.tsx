import React, { useEffect, useRef, useState } from "react";
import { FranchiseUnit, Business, ScreenType, UserSession } from "../../types";
import {
  formatBrl,
  formatBrl2,
  formatPct,
  formatPct2,
  calculateDre
} from "../../utils/calculations";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Filter,
  DollarSign,
  PieChart as PieIcon,
  Layers,
  FileSpreadsheet,
  Download,
  Printer,
  FileText,
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
  Sliders
} from "lucide-react";
import Chart from "chart.js/auto";
import {
  DateMultiFilter,
  DateFilterSelection,
  AVAILABLE_MONTHS,
  AVAILABLE_YEARS,
  AVAILABLE_DAYS,
} from "../DateMultiFilter";

interface DashboardScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onNavigate: (screen: ScreenType) => void;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
  initialTab?: "analytics" | "reports";
  userSession?: UserSession | null;
}

type PeriodType = "mes_atual" | "mes_anterior" | "trimestre" | "semestre" | "ano";
type ActiveChartType = "all" | "unidades" | "mensal" | "empilhado" | "royalties";

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  franchises,
  businesses,
  currentTenantId,
  onSelectTenant,
  onNavigate,
  dreParams,
  royalties,
  initialTab = "analytics",
  userSession,
}) => {
  // Franqueado permission check
  const isFranchisee = userSession?.profile === "franqueado" || userSession?.profile === "operador";

  // Check if unit is owned by user
  const isUnitOwnedByUser = (unitTenantId: string): boolean => {
    if (!userSession) return true;
    if (userSession.profile === "dono" || userSession.profile === "equipe") return true;
    if (userSession.tenant === unitTenantId) return true;
    if (userSession.login === "franqueado_sp" && (unitTenantId === "f1" || unitTenantId === "f2")) return true;
    if (userSession.login === "franqueado_sul" && (unitTenantId === "f4" || unitTenantId === "f6")) return true;
    return false;
  };

  // Units accessible by this session
  const allowedUnits = franchises.filter((f) => isUnitOwnedByUser(f.id));

  // Navigation sub-tabs inside Analítico
  const [activeTab, setActiveTab] = useState<"analytics" | "reports">(initialTab);

  // View mode: consolidated network or individual unit KPIs
  const [viewMode, setViewMode] = useState<"consolidated" | "unit">(() => {
    if (isFranchisee || (currentTenantId && currentTenantId.startsWith("f"))) {
      return "unit";
    }
    return "consolidated";
  });

  // Filters
  const [dateSelection, setDateSelection] = useState<DateFilterSelection>({
    years: [2026],
    months: [9], // Setembro
    days: AVAILABLE_DAYS, // Todos os 31 dias por padrão
  });
  const [selectedBusiness, setSelectedBusiness] = useState<string>("all");
  const [selectedFranchise, setSelectedFranchise] = useState<string>(() => {
    if (isFranchisee) {
      return allowedUnits[0]?.id || "f1";
    }
    if (currentTenantId && currentTenantId.startsWith("f")) {
      return currentTenantId;
    }
    return "all";
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "green" | "amber">("all");
  const [activeChartFilter, setActiveChartFilter] = useState<ActiveChartType>("all");
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);

  // Chart Canvas Refs
  const monthlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const unitsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stackedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const royaltiesCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart Instances
  const monthlyChartInstance = useRef<Chart | null>(null);
  const unitsChartInstance = useRef<Chart | null>(null);
  const stackedChartInstance = useRef<Chart | null>(null);
  const royaltiesChartInstance = useRef<Chart | null>(null);

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

  // Sync selected franchise with currentTenantId if it is a single unit
  useEffect(() => {
    if (currentTenantId && currentTenantId.startsWith("f") && isUnitOwnedByUser(currentTenantId)) {
      setSelectedFranchise(currentTenantId);
      setViewMode("unit");
    }
  }, [currentTenantId]);

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
    return true;
  });

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
    const fat = f.faturamento * periodMultiplier;
    const p = dreParams[f.id] || dreParams["dono"];
    const royPct = royalties[f.businessId] ?? (f.businessId === "biz1" ? 0.06 : f.businessId === "biz2" ? 0.05 : 0.07);
    const d = calculateDre(fat, p, royPct);
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

  // Active Unit for Individual Unit View (KPIs de Unidades Individuais)
  const activeUnitId =
    selectedFranchise !== "all" && isUnitOwnedByUser(selectedFranchise)
      ? selectedFranchise
      : currentTenantId.startsWith("f") && isUnitOwnedByUser(currentTenantId)
      ? currentTenantId
      : allowedUnits[0]?.id || franchises[0]?.id;

  const activeUnit = franchises.find((u) => u.id === activeUnitId) || allowedUnits[0] || franchises[0];
  const activeBiz = businesses.find((b) => b.id === activeUnit.businessId);

  // Dedicated metrics for activeUnit
  const unitFat = activeUnit.faturamento * periodMultiplier;
  const unitDreParams = dreParams[activeUnit.id] || dreParams["dono"];
  const unitRoyPct = royalties[activeUnit.businessId] ?? (activeUnit.businessId === "biz1" ? 0.06 : activeUnit.businessId === "biz2" ? 0.05 : 0.07);
  const unitDre = calculateDre(unitFat, unitDreParams, unitRoyPct);
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
    if (activeTab !== "analytics") return;

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
            let textColor = "#152238";
            let borderColor = dataset.borderColor || dataset.backgroundColor || "#3c63da";
            if (typeof borderColor === "object" && Array.isArray(borderColor)) {
              borderColor = borderColor[index] || "#3c63da";
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

      const monthsLabels: string[] = [];
      const dataFatMes: number[] = [];
      const dataLucroMes: number[] = [];
      const dataRoyMes: number[] = [];
      const baseMonthly = (totalFat / (periodMultiplier || 1)) * (dateSelection.days.length / 31);

      if (dateSelection.months.length > 1) {
        const sortedMonths = [...dateSelection.months].sort((a, b) => a - b);
        const yr = dateSelection.years[0] || 2026;
        sortedMonths.forEach((mVal) => {
          const mObj = AVAILABLE_MONTHS.find((m) => m.value === mVal);
          monthsLabels.push(`${mObj?.short || mVal}/${yr.toString().slice(-2)}`.toUpperCase());
          const factor = 1 + ((mVal % 3) - 1) * 0.04;
          const valFat = Math.round(baseMonthly * factor);
          const valLucro = Math.round(valFat * (margem || 0.18));
          const valRoy = Math.round(valFat * (avgRoyaltiesRate / 100));
          dataFatMes.push(valFat);
          dataLucroMes.push(valLucro);
          dataRoyMes.push(valRoy);
        });
      } else {
        const targetMonth = dateSelection.months[0] || 9;
        const yr = dateSelection.years[0] || 2026;
        for (let i = 5; i >= 0; i--) {
          const mIndex = ((targetMonth - 1 - i + 12) % 12) + 1;
          const mObj = AVAILABLE_MONTHS.find((m) => m.value === mIndex);
          monthsLabels.push(`${mObj?.short || mIndex}/${yr.toString().slice(-2)}`.toUpperCase());
          const factor = 1 + (5 - i) * 0.02 + ((i % 3) - 1) * 0.03;
          const valFat = Math.round(baseMonthly * factor);
          const valLucro = Math.round(valFat * (margem || 0.18));
          const valRoy = Math.round(valFat * (avgRoyaltiesRate / 100));
          dataFatMes.push(valFat);
          dataLucroMes.push(valLucro);
          dataRoyMes.push(valRoy);
        }
      }

      monthlyChartInstance.current = new Chart(monthlyCanvasRef.current, {
        type: "line",
        data: {
          labels: monthsLabels,
          datasets: [
            {
              label: "Faturamento Mensal (R$)",
              data: dataFatMes,
              borderColor: "#3c63da",
              backgroundColor: "rgba(60, 99, 218, 0.08)",
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              borderWidth: 2.5,
            },
            {
              label: "Lucro Líquido (R$)",
              data: dataLucroMes,
              borderColor: "#118464",
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
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11, weight: 600 } } },
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
              grid: { color: "#f1f5f9" },
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
      const backgroundColors = sortedByFat.map((u) => (u.f.status === "green" ? "#3c63da" : "#f59e0b"));

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
              grid: { color: "#f1f5f9" },
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
              backgroundColor: "#118464", // Verde
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
              backgroundColor: "#3c63da", // Azul
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
              backgroundColor: "#94a3b8", // Cinza Ardósia
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
              grid: { color: "#f1f5f9" },
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
              grid: { color: "#f1f5f9" },
              ticks: { callback: (v) => "R$ " + (Number(v) / 1000).toFixed(0) + "k" },
            },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
        },
        plugins: [dashboardDataLabelsPlugin],
      });
    }

    return () => {
      monthlyChartInstance.current?.destroy();
      unitsChartInstance.current?.destroy();
      stackedChartInstance.current?.destroy();
      royaltiesChartInstance.current?.destroy();
    };
  }, [totalFat, totalLucro, totalRoyalties, dateSelection, filteredUnits, activeTab, showDataLabels]);

  // Export functions for Reports tab
  const exportConsolidatedExcel = () => {
    const rows = [
      ["RELATÓRIO CONSOLIDADO ANALÍTICO DA REDE DE FRANQUIAS"],
      ["Data de Emissão", new Date().toLocaleString("pt-BR")],
      ["Período Selecionado", getPeriodSummary()],
      [],
      [
        "Código",
        "Unidade",
        "Rede / Marca",
        "Responsável",
        "Cidade/UF",
        "Faturamento Bruto (R$)",
        "Alíquota Royalties (%)",
        "Valor dos Royalties (R$)",
        "Fundo Propaganda (R$)",
        "Total Devido Matriz (R$)",
        "CMV (R$)",
        "Impostos (R$)",
        "Despesas Operacionais (R$)",
        "Lucro Líquido (R$)",
        "Margem Líquida (%)",
      ],
    ];

    unitCalculations.forEach((u) => {
      rows.push([
        u.f.code,
        u.f.name,
        u.biz?.name || u.f.businessId,
        u.f.resp,
        `${u.f.city}/${u.f.state || "SP"}`,
        u.fat.toFixed(2),
        (u.royPct * 100).toFixed(1) + "%",
        u.royValue.toFixed(2),
        u.fppValue.toFixed(2),
        u.totalDevidoMatriz.toFixed(2),
        u.d.cmv.toFixed(2),
        u.d.impostos.toFixed(2),
        u.d.totalDesp.toFixed(2),
        u.d.lucroLiquido.toFixed(2),
        formatPct(u.d.margemLiquida),
      ]);
    });

    const csvContent = "\ufeff" + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Analitico_Franquias_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

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
        "Apurado na Nuvem",
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
      {/* 1. HEADER PRINCIPAL COM TÍTULO E ABAS DO ANALÍTICO            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
              Módulo de Inteligência Financeira
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#edf2ff] text-[#3c63da] text-[10px] font-bold border border-[#3c63da]/20">
              Analítico Integrado
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <TrendingUp className="h-6 w-6 text-[#3c63da]" />
            Analítico
          </h1>
          <p className="text-xs text-[#69778c] mt-1">
            Painel analítico completo: faturamento por unidade e mês, gráficos de colunas empilhadas, valor dos royalties e relatórios integrados.
          </p>
        </div>

        {/* View Switcher Tabs: Painel Analítico vs Central de Relatórios */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-[#e5eaf1] rounded-xl shadow-xs self-start md:self-auto">
          <button
            id="tab-analitico-painel"
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === "analytics"
                ? "bg-[#3c63da] text-white shadow-xs"
                : "text-[#69778c] hover:text-[#152238] hover:bg-[#f8faff]"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Painel & Gráficos</span>
          </button>
          <button
            id="tab-analitico-relatorios"
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === "reports"
                ? "bg-[#3c63da] text-white shadow-xs"
                : "text-[#69778c] hover:text-[#152238] hover:bg-[#f8faff]"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Central de Relatórios</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. BARRA DE FILTROS COMPLETOS (ANO, MÊS, DIA, REDE, UNIDADE, STATUS) */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs space-y-4">
        {/* Header dos Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf2ff] text-[#3c63da]">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-[#152238] uppercase tracking-wide">
                Filtros do Analítico
              </span>
              <p className="text-[11px] text-[#69778c]">
                Filtro temporal separado por Ano, Mês e Dia com seleção múltipla, além de Rede e Unidades
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#3c63da] bg-[#edf2ff] px-2.5 py-1 rounded-full border border-[#3c63da]/20">
              {filteredUnits.length} unidade(s) filtrada(s)
            </span>
          </div>
        </div>

        {/* 1. SELETORES TEMPORAIS SEPARADOS: ANO, MÊS E DIA (Com Múltipla Escolha e Selecionar Tudo) */}
        <div>
          <DateMultiFilter selection={dateSelection} onChange={setDateSelection} />
        </div>

        {/* 2. FILTROS DA REDE / OPERACIONAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#f1f5f9]">
          {/* Filtro 1: Rede / Marca */}
          <div>
            <label
              htmlFor="filter-analytics-business"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#152238] mb-1.5"
            >
              <Building2 className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Rede / Marca</span>
            </label>
            <select
              id="filter-analytics-business"
              value={selectedBusiness}
              onChange={(e) => {
                setSelectedBusiness(e.target.value);
                setSelectedFranchise("all");
              }}
              className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#152238] shadow-2xs hover:border-[#94a3b8] focus:border-[#3c63da] focus:ring-2 focus:ring-[#3c63da]/15 focus:outline-none cursor-pointer transition-all"
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
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#152238] mb-1.5"
            >
              <Store className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Unidade Franqueada</span>
            </label>
            <select
              id="filter-analytics-franchise"
              value={selectedFranchise}
              onChange={(e) => {
                setSelectedFranchise(e.target.value);
                if (e.target.value !== "all") {
                  setViewMode("unit");
                }
              }}
              className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#152238] shadow-2xs hover:border-[#94a3b8] focus:border-[#3c63da] focus:ring-2 focus:ring-[#3c63da]/15 focus:outline-none cursor-pointer transition-all"
            >
              {!isFranchisee && <option value="all">Todas as Unidades ({allowedUnits.length})</option>}
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
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#152238] mb-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Status Operacional</span>
            </label>
            <select
              id="filter-analytics-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#152238] shadow-2xs hover:border-[#94a3b8] focus:border-[#3c63da] focus:ring-2 focus:ring-[#3c63da]/15 focus:outline-none cursor-pointer transition-all"
            >
              <option value="all">Todos os Status</option>
              <option value="green">🟢 Operação Saudável</option>
              <option value="amber">🟡 Em Atenção</option>
            </select>
          </div>
        </div>

        {/* Barra de Resumo do Período Selecionado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[#f8faff] border border-[#e5eaf1] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#152238]">Período Ativo:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[#3c63da] font-extrabold text-[11px]">
              <Calendar className="h-3 w-3" />
              {getPeriodSummary()}
            </span>
            <span className="text-[11px] text-[#69778c]">
              Multiplicador proporcional: <strong>{periodMultiplier.toFixed(2)}x</strong> ({daysInPeriod} dias analisados)
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setDateSelection({
                years: [2026],
                months: [9],
                days: AVAILABLE_DAYS,
              });
              setSelectedBusiness("all");
              setSelectedFranchise(isFranchisee ? allowedUnits[0]?.id || "f1" : "all");
              setStatusFilter("all");
            }}
            className="text-[11px] font-bold text-[#69778c] hover:text-[#3c63da] transition-colors cursor-pointer self-end sm:self-auto"
          >
            Redefinir Filtros Padrão
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* ABA 1: PAINEL ANALÍTICO & GRÁFICOS                            */}
      {/* ============================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* ----------------------------------------------------------- */}
          {/* SELETOR DE MODO DE VISÃO: CONSOLIDADO VS UNIDADE INDIVIDUAL  */}
          {/* ----------------------------------------------------------- */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-[#f8faff] via-white to-[#f1f5f9] border border-[#e5eaf1] shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3c63da]/10 text-[#3c63da]">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-[#152238] flex items-center gap-1.5">
                  Visualização de Desempenho
                  {isFranchisee && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                      Painel do Franqueado
                    </span>
                  )}
                </span>
                <p className="text-[11px] text-[#69778c]">
                  {viewMode === "unit"
                    ? `Acompanhando indicadores específicos de: ${activeUnit.name} (${activeUnit.code})`
                    : "Visão agregada e consolidada de todas as lojas da rede"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-white border border-[#e5eaf1] rounded-xl shadow-2xs">
              {!isFranchisee && (
                <button
                  type="button"
                  id="btn-view-consolidated"
                  onClick={() => {
                    setViewMode("consolidated");
                    setSelectedFranchise("all");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === "consolidated"
                      ? "bg-[#3c63da] text-white shadow-xs"
                      : "text-[#69778c] hover:text-[#152238] hover:bg-[#f8faff]"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Consolidado da Rede</span>
                </button>
              )}
              <button
                type="button"
                id="btn-view-unit"
                onClick={() => setViewMode("unit")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "unit"
                    ? "bg-[#3c63da] text-white shadow-xs"
                    : "text-[#69778c] hover:text-[#152238] hover:bg-[#f8faff]"
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
              <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-extrabold text-sm shadow-xs"
                      style={{ backgroundColor: activeBiz?.color || "#3c63da" }}
                    >
                      {activeBiz?.brand || "HQ"}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-[#152238]">
                          {activeUnit.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#294285] font-mono text-[11px] font-bold">
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
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-[#69778c] mt-1">
                        <span>
                          <strong className="text-[#152238]">Rede:</strong> {activeBiz?.name}
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-[#152238]">Responsável:</strong> {activeUnit.resp}
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-[#152238]">Localização:</strong> {activeUnit.city}/{activeUnit.state || "SP"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Seletor Rápido de Unidade do Usuário */}
                  {allowedUnits.length > 1 && (
                    <div className="flex items-center gap-2 self-start md:self-auto bg-[#f8faff] p-2 rounded-xl border border-[#e5eaf1]">
                      <span className="text-[11px] font-bold text-[#69778c]">Trocar Loja:</span>
                      <select
                        id="quick-unit-selector"
                        value={activeUnit.id}
                        onChange={(e) => {
                          setSelectedFranchise(e.target.value);
                        }}
                        className="rounded-lg border border-[#e5eaf1] bg-white py-1 px-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none shadow-2xs cursor-pointer"
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
                <div className="rounded-2xl border-2 border-[#3c63da]/20 bg-gradient-to-br from-[#3c63da]/5 via-white to-white p-5 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3c63da] text-white shadow-xs">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#3c63da] block">
                          Total de Vendas
                        </span>
                        <span className="text-[11px] text-[#69778c]">Faturamento da Unidade</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <ArrowUpRight className="h-3 w-3" />
                      +8.2% MoM
                    </span>
                  </div>

                  <div className="mt-4">
                    <strong className="text-2xl sm:text-3xl font-black text-[#152238] block tracking-tight">
                      {formatBrl(unitFat)}
                    </strong>
                    <div className="flex items-center justify-between text-xs text-[#69778c] mt-2">
                      <span>Média diária: <strong className="text-[#152238]">{formatBrl(unitDailyAvg)}/dia</strong></span>
                      <span><strong>{unitEstimatedOrders.toLocaleString("pt-BR")}</strong> pedidos</span>
                    </div>
                  </div>

                  {/* Barra de Progresso de Meta da Unidade */}
                  <div className="mt-3.5 pt-3 border-t border-[#e5eaf1]">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-[#69778c]">Meta do Período ({unitTargetAtingido}%)</span>
                      <span className="font-extrabold text-[#152238]">{formatBrl(unitSalesTarget)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#e5eaf1] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#3c63da] to-indigo-500 transition-all duration-500"
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
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 block">
                          Margem Líquida
                        </span>
                        <span className="text-[11px] text-[#69778c]">Rentabilidade Real</span>
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
                    <div className="flex items-center justify-between text-xs text-[#69778c] mt-2">
                      <span>Lucro líquido: <strong className="text-emerald-800 font-bold">{formatBrl(unitLucro)}</strong></span>
                      <span>Margem bruta: <strong className="text-[#152238]">{formatPct(unitMargemBruta)}</strong></span>
                    </div>
                  </div>

                  {/* Classificação de Saúde Financeira */}
                  <div className="mt-3.5 pt-3 border-t border-[#e5eaf1] flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#69778c]">Diagnóstico Operacional:</span>
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
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 block">
                          Ticket Médio
                        </span>
                        <span className="text-[11px] text-[#69778c]">Gasto Médio por Venda</span>
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
                    <div className="flex items-center justify-between text-xs text-[#69778c] mt-2">
                      <span>Volume: <strong className="text-[#152238]">{unitEstimatedOrders.toLocaleString("pt-BR")} transações</strong></span>
                      <span>Média rede: <strong className="text-[#152238]">{formatBrl2(networkAvgTicket)}</strong></span>
                    </div>
                  </div>

                  {/* Indicador de Desempenho do Ticket */}
                  <div className="mt-3.5 pt-3 border-t border-[#e5eaf1] flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#69778c]">Média de Itens/Cupom:</span>
                    <span className="font-extrabold text-[#152238] flex items-center gap-1">
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
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    Lucro Líquido Real
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-emerald-700 block mt-1">
                    {formatBrl(unitLucro)}
                  </strong>
                  <span className="text-[10px] text-[#69778c] block mt-1">
                    Retenção líquida da unidade
                  </span>
                </div>

                {/* 2. CMV da Loja (Insumos) */}
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    CMV (Insumos/Produtos)
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-[#b44b4b] block mt-1">
                    {formatBrl(unitDre.cmv)}
                  </strong>
                  <span className="text-[10px] text-[#69778c] block mt-1">
                    {unitFat > 0 ? ((unitDre.cmv / unitFat) * 100).toFixed(1) : 0}% das vendas
                  </span>
                </div>

                {/* 3. Despesas Fixas e Pessoal */}
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    Despesas Operacionais
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-[#294285] block mt-1">
                    {formatBrl(unitDre.totalDesp)}
                  </strong>
                  <span className="text-[10px] text-[#69778c] block mt-1">
                    Equipe, aluguel & ocupação
                  </span>
                </div>

                {/* 4. Royalties & FPP Devidos */}
                <div className="rounded-xl border border-[#e5eaf1] bg-amber-50/40 border-amber-200/70 p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
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
                <div className="col-span-2 lg:col-span-1 rounded-xl border border-[#e5eaf1] bg-[#f8faff] p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3c63da] block">
                    Break-Even (Ponto Equilíbrio)
                  </span>
                  <strong className="text-lg sm:text-xl font-extrabold text-[#152238] block mt-1">
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
              <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#3c63da]" />
                      Raio-X Financeiro: Onde vai cada R$ 100,00 faturados por esta unidade?
                    </h3>
                    <p className="text-xs text-[#69778c]">
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
                    className="bg-[#b44b4b] h-full flex items-center justify-center text-[10px] text-white font-extrabold"
                    title={`CMV: ${formatPct(unitDre.cmv / unitFat)}`}
                  >
                    CMV
                  </div>
                  <div
                    style={{ width: `${Math.max(5, (unitDre.totalDesp / (unitFat || 1)) * 100)}%` }}
                    className="bg-[#294285] h-full flex items-center justify-center text-[10px] text-white font-extrabold"
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-3 border-t border-[#e5eaf1] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#b44b4b] shrink-0" />
                    <div>
                      <span className="text-[#69778c] block text-[10px]">Insumos (CMV)</span>
                      <strong className="text-[#152238]">R$ {unitFat > 0 ? ((unitDre.cmv / unitFat) * 100).toFixed(1) : 0}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#294285] shrink-0" />
                    <div>
                      <span className="text-[#69778c] block text-[10px]">Despesas & Equipe</span>
                      <strong className="text-[#152238]">R$ {unitFat > 0 ? ((unitDre.totalDesp / unitFat) * 100).toFixed(1) : 0}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#8b5cf6] shrink-0" />
                    <div>
                      <span className="text-[#69778c] block text-[10px]">Impostos Fiscais</span>
                      <strong className="text-[#152238]">R$ {unitFat > 0 ? ((unitDre.impostos / unitFat) * 100).toFixed(1) : 0}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#f59e0b] shrink-0" />
                    <div>
                      <span className="text-[#69778c] block text-[10px]">Royalties & FPP</span>
                      <strong className="text-[#152238]">R$ {unitFat > 0 ? ((unitDevidoMatriz / unitFat) * 100).toFixed(1) : 0}</strong>
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
              <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
                    <Scale className="h-4 w-4 text-[#3c63da]" />
                    Benchmark Comparativo: Unidade vs Padrão da Rede Franqueadora
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e5eaf1] bg-[#f8faff] text-[11px] font-extrabold uppercase tracking-wider text-[#69778c]">
                        <th className="py-2.5 px-3">Indicador de Desempenho</th>
                        <th className="py-2.5 px-3">Esta Unidade ({activeUnit.code})</th>
                        <th className="py-2.5 px-3">Média da Rede</th>
                        <th className="py-2.5 px-3">Diferencial</th>
                        <th className="py-2.5 px-3">Classificação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5eaf1] font-medium">
                      <tr>
                        <td className="py-3 px-3 font-bold text-[#152238] flex items-center gap-1.5">
                          <ShoppingBag className="h-3.5 w-3.5 text-[#3c63da]" />
                          Total de Vendas / Faturamento
                        </td>
                        <td className="py-3 px-3 font-extrabold text-[#152238]">{formatBrl(unitFat)}</td>
                        <td className="py-3 px-3 text-[#69778c]">{formatBrl(avgFatPerUnit)}</td>
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
                        <td className="py-3 px-3 font-bold text-[#152238] flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                          Margem Líquida da Operação
                        </td>
                        <td className="py-3 px-3 font-extrabold text-emerald-700">{formatPct(unitMargem)}</td>
                        <td className="py-3 px-3 text-[#69778c]">{formatPct(networkAvgMargin)}</td>
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
                        <td className="py-3 px-3 font-bold text-[#152238] flex items-center gap-1.5">
                          <Receipt className="h-3.5 w-3.5 text-amber-600" />
                          Ticket Médio por Venda
                        </td>
                        <td className="py-3 px-3 font-extrabold text-amber-900">{formatBrl2(unitRealTicket)}</td>
                        <td className="py-3 px-3 text-[#69778c]">{formatBrl2(networkAvgTicket)}</td>
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
                        <td className="py-3 px-3 font-bold text-[#152238] flex items-center gap-1.5">
                          <Scale className="h-3.5 w-3.5 text-[#b44b4b]" />
                          CMV % (Custo Mercadorias Vendidas)
                        </td>
                        <td className="py-3 px-3 font-extrabold text-[#b44b4b]">
                          {unitFat > 0 ? formatPct(unitDre.cmv / unitFat) : "0%"}
                        </td>
                        <td className="py-3 px-3 text-[#69778c]">
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
                  <Store className="h-4 w-4 text-[#3c63da]" />
                  <span>
                    Deseja inspecionar uma loja individualmente com <strong>Total de Vendas</strong>, <strong>Margem Líquida</strong> e <strong>Ticket Médio</strong>?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("unit");
                    if (selectedFranchise === "all") {
                      setSelectedFranchise(allowedUnits[0]?.id || "f1");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#3c63da] text-white font-extrabold text-xs shadow-xs hover:bg-[#294285] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Abrir KPIs da Loja</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 8 Cards Analíticos Consolidados */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Faturamento Total */}
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    Faturamento Bruto
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#152238] block mt-1">
                    {formatBrl(totalFat)}
                  </strong>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      +6.2% MoM
                    </span>
                    <span className="text-[10px] text-[#69778c]">vs período ant.</span>
                  </div>
                </div>

                {/* 2. Faturamento Médio por Loja */}
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    Média por Unidade
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#3c63da] block mt-1">
                    {formatBrl(avgFatPerUnit)}
                  </strong>
                  <span className="text-[10px] text-[#69778c] block mt-1">
                    {filteredUnits.length} lojas ativas no filtro
                  </span>
                </div>

                {/* 3. Valor dos Royalties (DESTACADO EXPLICITAMENTE SOLICITADO) */}
                <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
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
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    Fundo Propaganda (FPP)
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-purple-700 block mt-1">
                    {formatBrl(totalFpp)}
                  </strong>
                  <span className="text-[10px] text-[#69778c] block mt-1">
                    2.0% padrão da rede franqueada
                  </span>
                </div>

                {/* 5. Lucro Líquido Real DRE */}
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    Lucro Líquido Consolidado
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#118464] block mt-1">
                    {formatBrl(totalLucro)}
                  </strong>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                    Margem líquida: {formatPct(margem)}
                  </span>
                </div>

                {/* 6. CMV Total (Insumos) */}
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    CMV Consolidado (Insumos)
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#b44b4b] block mt-1">
                    {formatBrl(totalCmv)}
                  </strong>
                  <span className="text-[10px] text-[#69778c] block mt-1">
                    {totalFat > 0 ? ((totalCmv / totalFat) * 100).toFixed(1) : 0}% do faturamento
                  </span>
                </div>

                {/* 7. Despesas Operacionais Totais */}
                <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
                    Despesas Operacionais
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#294285] block mt-1">
                    {formatBrl(totalDesp)}
                  </strong>
                  <span className="text-[10px] text-[#69778c] block mt-1">
                    Pessoal, ocupação & utilidades
                  </span>
                </div>

                {/* 8. Total Devido à Matriz (Royalties + FPP) */}
                <div className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] p-4 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3c63da] block">
                    Total Faturado à Matriz
                  </span>
                  <strong className="text-xl sm:text-2xl font-extrabold text-[#152238] block mt-1">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#f8faff] rounded-2xl border border-[#e5eaf1]">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              <span className="text-[11px] font-bold text-[#69778c] mr-2">Visualizar:</span>
              {[
                { id: "all", label: "Todos os Gráficos" },
                { id: "unidades", label: "Faturamento por Unidade" },
                { id: "mensal", label: "Faturamento por Mês" },
                { id: "empilhado", label: "Colunas Empilhadas" },
                { id: "royalties", label: "Valor dos Royalties" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setActiveChartFilter(btn.id as ActiveChartType)}
                  className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeChartFilter === btn.id
                      ? "bg-[#152238] text-white shadow-xs"
                      : "bg-white border border-[#e5eaf1] text-[#69778c] hover:text-[#152238] hover:bg-[#f8faff]"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Toggle Rótulos de Dados do Painel */}
            <button
              type="button"
              onClick={() => setShowDataLabels((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${
                showDataLabels
                  ? "bg-[#3c63da] text-white border-[#3c63da] shadow-xs"
                  : "bg-white text-[#69778c] border-[#cbd5e1] hover:bg-[#f8faff]"
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
                <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
                        <Store className="h-4 w-4 text-[#3c63da]" />
                        Faturamento por Unidade (R$)
                      </h3>
                      <p className="text-[11px] text-[#69778c] mt-0.5">
                        Comparativo de receita bruta das lojas franqueadas
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#edf2ff] text-[#3c63da]">
                      {filteredUnits.length} Lojas
                    </span>
                  </div>
                  <div className="h-72 w-full">
                    <canvas ref={unitsCanvasRef} />
                  </div>
                </div>
              )}

              {/* Gráfico 2: Faturamento por Mês */}
              {(activeChartFilter === "all" || activeChartFilter === "mensal") && (
                <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[#3c63da]" />
                        Faturamento por Mês (Evolução Temporal)
                      </h3>
                      <p className="text-[11px] text-[#69778c] mt-0.5">
                        Tendência mês a mês: Faturamento, Lucro Líquido e Royalties
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      Série Histórica
                    </span>
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
            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      Gráfico de Colunas Empilhadas (Decomposição Estrutural de Custos & Lucro)
                    </h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Empilhado
                    </span>
                  </div>
                  <p className="text-[11px] text-[#69778c] mt-0.5">
                    Decomposição exata de cada unidade em: Lucro Líquido, Royalties, Despesas Operacionais, CMV e Impostos.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-[#69778c]">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#118464]" /> Lucro</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#eab308]" /> Royalties</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#3c63da]" /> Despesas</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f43f5e]" /> CMV</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#94a3b8]" /> Impostos</span>
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
              <div className="lg:col-span-5 rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-600" />
                      Valor dos Royalties por Unidade
                    </h3>
                    <p className="text-[11px] text-[#69778c] mt-0.5">
                      Royalties contratuais vs Fundo de Propaganda
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {formatBrl(totalRoyalties)}
                  </span>
                </div>
                <div className="h-72 w-full">
                  <canvas ref={royaltiesCanvasRef} />
                </div>
              </div>

              {/* Tabela Analítica de Royalties das Lojas */}
              <div className="lg:col-span-7 rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      Tabela de Apuração de Royalties da Rede
                    </h3>
                    <button
                      onClick={exportRoyaltiesReport}
                      className="flex items-center gap-1 text-[11px] font-extrabold text-[#3c63da] hover:underline cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#e5eaf1] text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                          <th className="pb-2">Unidade / Código</th>
                          <th className="pb-2">Faturamento</th>
                          <th className="pb-2 text-center">Taxa</th>
                          <th className="pb-2 text-right">Valor Royalties</th>
                          <th className="pb-2 text-right">FPP (2%)</th>
                          <th className="pb-2 text-right">Total Matriz</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f4f8]">
                        {unitCalculations.slice(0, 7).map((u) => (
                          <tr key={u.f.id} className="hover:bg-[#f8faff] transition-colors">
                            <td className="py-2.5">
                              <span className="font-extrabold text-[#152238] block">{u.f.name}</span>
                              <span className="text-[10px] text-[#69778c] font-mono">{u.f.code}</span>
                            </td>
                            <td className="py-2.5 font-medium text-[#152238]">{formatBrl(u.fat)}</td>
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
                            <td className="py-2.5 text-right font-black text-[#152238]">
                              {formatBrl(u.totalDevidoMatriz)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e5eaf1] flex items-center justify-between text-xs font-bold text-[#152238]">
                  <span>Total Consolidado da Rede:</span>
                  <span className="text-emerald-700 font-black text-sm">
                    {formatBrl(totalRoyalties + totalFpp)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* RANKING COMPLETO E COMPARATIVO DE PERFORMANCE               */}
          {/* ----------------------------------------------------------- */}
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#152238]">
                  Ranking de Performance Financeira das Franquias
                </h3>
                <p className="text-[11px] text-[#69778c] mt-0.5">
                  Ordenado por maior lucratividade líquida e eficiência operacional apurada
                </p>
              </div>
              <button
                onClick={() => onNavigate("dre")}
                className="flex items-center gap-1 text-xs font-extrabold text-[#3c63da] hover:underline cursor-pointer"
              >
                <span>Ver DRE Completo</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e5eaf1] text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
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
                <tbody className="divide-y divide-[#f0f4f8]">
                  {[...unitCalculations]
                    .sort((a, b) => b.d.lucroLiquido - a.d.lucroLiquido)
                    .map((u, idx) => (
                      <tr key={u.f.id} className="hover:bg-[#f8faff] transition-colors">
                        <td className="py-3 font-bold text-[#69778c]">#{idx + 1}</td>
                        <td className="py-3">
                          <button
                            onClick={() => onSelectTenant(u.f.id)}
                            className="font-extrabold text-[#152238] hover:text-[#3c63da] text-left cursor-pointer"
                          >
                            {u.f.name}
                          </button>
                          <span className="block text-[10px] text-[#69778c]">{u.f.city} — Resp: {u.f.resp}</span>
                        </td>
                        <td className="py-3 font-medium text-[#69778c]">{u.biz?.brand || "Rede"}</td>
                        <td className="py-3 text-right font-extrabold text-[#152238]">{formatBrl(u.fat)}</td>
                        <td className="py-3 text-right text-[#b44b4b]">{formatBrl(u.d.cmv)}</td>
                        <td className="py-3 text-right text-amber-800 font-bold">{formatBrl(u.royValue)}</td>
                        <td className="py-3 text-right font-black text-[#118464]">{formatBrl(u.d.lucroLiquido)}</td>
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
      )}

      {/* ============================================================= */}
      {/* ABA 2: CENTRAL DE RELATÓRIOS (INTEGRADA DENTRO DO ANALÍTICO)  */}
      {/* ============================================================= */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#152238] flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  Central de Relatórios & Livros Fiscais da Rede
                </h2>
                <p className="text-xs text-[#69778c] mt-0.5">
                  Exportação de dados consolidados, balancetes de DRE e apurações financeiras sincronizadas na nuvem.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-export-excel-consolidado"
                  onClick={exportConsolidatedExcel}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-all cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Baixar Planilha (.CSV)</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f8faff] shadow-2xs transition-all cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-[#3c63da]" />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cards de Tipos de Relatórios Prontos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Relatório 1: Consolidado da Rede */}
            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-[#152238]">Consolidado Geral da Rede</h3>
                <p className="text-xs text-[#69778c] leading-relaxed">
                  Planilha detalhada contendo faturamento, CMV, impostos fiscais, despesas operacionais, royalties apurados e margem líquida de todas as unidades da rede.
                </p>
              </div>
              <button
                onClick={exportConsolidatedExcel}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all cursor-pointer shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar Planilha Completa</span>
              </button>
            </div>

            {/* Relatório 2: DRE em PDF */}
            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf2ff] text-[#3c63da]">
                  <Printer className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-[#152238]">DRE Gerencial Consolidado</h3>
                <p className="text-xs text-[#69778c] leading-relaxed">
                  Demonstrativo do Resultado do Exercício formatado e padronizado para apresentação à diretoria e conselho de franqueados.
                </p>
              </div>
              <button
                onClick={() => {
                  onNavigate("dre");
                  setTimeout(() => window.print(), 400);
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#3c63da] py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] transition-all cursor-pointer shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Gerar DRE / Imprimir</span>
              </button>
            </div>

            {/* Relatório 3: Mapa e Apuração de Royalties */}
            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Coins className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-[#152238]">Relatório de Royalties & FPP</h3>
                <p className="text-xs text-[#69778c] leading-relaxed">
                  Demonstrativo específico das taxas de franquia e fundo de propaganda para conferência, conciliação e emissão de notas fiscais de royalties.
                </p>
              </div>
              <button
                onClick={exportRoyaltiesReport}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition-all cursor-pointer shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar Relatório de Royalties</span>
              </button>
            </div>
          </div>

          {/* Tabela de Amostra e Visualização dos Dados */}
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
            <h3 className="text-sm font-extrabold text-[#152238] mb-3">
              Pré-visualização do Relatório Consolidado
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e5eaf1] text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                    <th className="pb-2">Unidade</th>
                    <th className="pb-2">Faturamento</th>
                    <th className="pb-2">Royalties</th>
                    <th className="pb-2">CMV</th>
                    <th className="pb-2">Despesas</th>
                    <th className="pb-2">Lucro Líquido</th>
                    <th className="pb-2 text-center">Margem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f4f8]">
                  {unitCalculations.map((u) => (
                    <tr key={u.f.id} className="hover:bg-[#f8faff]">
                      <td className="py-2.5 font-bold text-[#152238]">{u.f.name}</td>
                      <td className="py-2.5 font-medium">{formatBrl(u.fat)}</td>
                      <td className="py-2.5 text-amber-800 font-extrabold">{formatBrl(u.royValue)}</td>
                      <td className="py-2.5 text-[#b44b4b]">{formatBrl(u.d.cmv)}</td>
                      <td className="py-2.5 text-[#294285]">{formatBrl(u.d.totalDesp)}</td>
                      <td className="py-2.5 font-black text-[#118464]">{formatBrl(u.d.lucroLiquido)}</td>
                      <td className="py-2.5 text-center font-bold">{formatPct(u.d.margemLiquida)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
