import React, { useEffect, useRef, useState } from "react";
import { FranchiseUnit, Business, ScreenType, DreParams, UserSession } from "../../types";
import {
  formatBrl,
  formatBrl2,
  formatPct,
  formatPct2,
  calculateDre,
} from "../../utils/calculations";
import { dreExpenseDefs, defaultDreParams } from "../../data/initialData";
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
  Sliders
} from "lucide-react";
import Chart from "chart.js/auto";
import {
  DateMultiFilter,
  DateFilterSelection,
  AVAILABLE_DAYS,
  AVAILABLE_MONTHS,
  AVAILABLE_YEARS,
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
}) => {
  // Main sub-tab: demonstrativo vs parametros
  const [activeSubTab, setActiveSubTab] = useState<"demonstrativo" | "parametros">("demonstrativo");

  // -------------------------------------------------------------
  // Granular Date Selection (Ano, Mês e Dia)
  // -------------------------------------------------------------
  const [dateSelection, setDateSelection] = useState<DateFilterSelection>({
    years: [2026],
    months: [9], // Setembro
    days: AVAILABLE_DAYS,
  });

  // Business & Franchise Filters
  const [selectedBusiness, setSelectedBusiness] = useState<string>(currentBusinessId || "all");
  const [selectedFranchise, setSelectedFranchise] = useState<string>(
    franchises.some((franchise) => franchise.id === currentTenantId) ? currentTenantId : "all"
  );

  // Power BI Interactive Features
  const [highlightedMonth, setHighlightedMonth] = useState<string | null>(null);
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);
  const [chartViewMode, setChartViewMode] = useState<"bar" | "line">("bar");

  // Chart references
  const dailyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const monthlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dailyChartInstance = useRef<Chart | null>(null);
  const monthlyChartInstance = useRef<Chart | null>(null);

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

  const targetUnit = franchises.find((f) => f.id === selectedFranchise);
  const targetBiz = businesses.find(
    (b) => b.id === (targetUnit?.businessId || (selectedBusiness !== "all" ? selectedBusiness : ""))
  );
  const unitRoyalty = targetUnit
    ? (royalties[targetUnit.businessId] ?? targetBiz?.royalty ?? 0.06)
    : (selectedBusiness !== "all" ? (royalties[selectedBusiness] ?? targetBiz?.royalty) : undefined);

  const dre = calculateDre(baseFat, currentParams, unitRoyalty);

  // -----------------------------------------------------------------
  // Form state for unified Parâmetros do DRE
  // -----------------------------------------------------------------
  const [paramsForm, setParamsForm] = useState<DreParams>({
    impostos: currentParams.impostos,
    cmv: currentParams.cmv,
    fees: currentParams.fees,
    discount: currentParams.discount,
    despesas: { ...currentParams.despesas },
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const updated = dreParams[targetTenantKey] || dreParams["dono"] || defaultDreParams;
    setParamsForm({
      impostos: updated.impostos,
      cmv: updated.cmv,
      fees: updated.fees,
      discount: updated.discount,
      despesas: { ...updated.despesas },
    });
  }, [targetTenantKey, dreParams]);

  const handleGeneralChange = (field: keyof DreParams, valueStr: string) => {
    const val = parseFloat(valueStr || "0") / 100;
    setParamsForm((prev) => ({
      ...prev,
      [field]: val,
    }));
    setIsSaved(false);
  };

  const handleExpenseChange = (expId: string, valueStr: string) => {
    const val = parseFloat(valueStr || "0") / 100;
    setParamsForm((prev) => ({
      ...prev,
      despesas: {
        ...prev.despesas,
        [expId]: val,
      },
    }));
    setIsSaved(false);
  };

  const handleSaveParams = async () => {
    if (!onSaveParams) return;
    setIsSaving(true);
    try {
      await onSaveParams(targetTenantKey, paramsForm);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetParams = () => {
    setParamsForm(JSON.parse(JSON.stringify(defaultDreParams)));
    setIsSaved(false);
  };

  const previewDre = calculateDre(baseFat, paramsForm, unitRoyalty);

  // Helper text for current period
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

  // -----------------------------------------------------------------
  // Power BI Custom Data Labels Plugin
  // -----------------------------------------------------------------
  const pbiDataLabelsPlugin = {
    id: "pbiDataLabels",
    afterDatasetsDraw(chart: any, args: any, options: any) {
      if (options?.enabled === false) return;
      const { ctx } = chart;
      ctx.save();

      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta || meta.hidden) return;

        meta.data.forEach((element: any, index: number) => {
          const val = dataset.data[index];
          if (val === null || val === undefined || isNaN(val)) return;

          const pos = element.tooltipPosition ? element.tooltipPosition() : null;
          if (!pos) return;

          // Compact currency format: R$ 142k, R$ 1.2M
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

          ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          const textWidth = ctx.measureText(text).width;
          const pillW = textWidth + 8;
          const pillH = 14;
          const pillX = pos.x - pillW / 2;
          const pillY = Math.max(4, pos.y - pillH - 4);

          // Power BI Pill Background
          ctx.fillStyle =
            datasetIndex === 0
              ? "rgba(60, 99, 218, 0.95)"
              : "rgba(17, 132, 100, 0.95)";
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(pillX, pillY, pillW, pillH, 3);
          } else {
            ctx.rect(pillX, pillY, pillW, pillH);
          }
          ctx.fill();

          // Border outline
          ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Label text
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, pos.x, pillY + pillH / 2);
        });
      });

      ctx.restore();
    },
  };

  // -----------------------------------------------------------------
  // Charts useEffect: Recalculates whenever ANY filter changes
  // -----------------------------------------------------------------
  useEffect(() => {
    if (activeSubTab !== "demonstrativo") return;

    // Seasonal retail weights for months
    const seasonWeights: Record<number, number> = {
      1: 0.88,
      2: 0.92,
      3: 0.98,
      4: 1.0,
      5: 1.08,
      6: 1.02,
      7: 0.96,
      8: 1.04,
      9: 1.01,
      10: 1.05,
      11: 1.18,
      12: 1.38,
    };

    // ---------------------------------------------------------------
    // 1. DAILY CHART (Evolução Diária do Faturamento & Lucro)
    // ---------------------------------------------------------------
    if (dailyCanvasRef.current) {
      if (dailyChartInstance.current) dailyChartInstance.current.destroy();

      // Plot the selected days from dateSelection.days
      const sortedDays = [...dateSelection.days].sort((a, b) => a - b);
      const dailyLabels = sortedDays.map((d) => `Dia ${String(d).padStart(2, "0")}`);

      // Daily revenue per day factoring in the number of selected months & years
      const avgDayBase = baseMonthlyUnits / 30;
      const dailyValues = sortedDays.map((d) => {
        // Weekday fluctuation pattern (Fridays/Saturdays higher)
        const dayMod = d % 7;
        const weekendFactor = dayMod === 5 || dayMod === 6 ? 1.25 : dayMod === 0 ? 0.85 : 1.02;
        const seedVal = ((d * 9301 + 49297) % 233280) / 233280;
        const noise = 0.92 + seedVal * 0.16;
        return Math.round(avgDayBase * weekendFactor * noise * numMonths * numYears);
      });

      const dailyLucros = dailyValues.map((val) =>
        Math.round(val * (dre.margemLiquida || 0.18))
      );

      dailyChartInstance.current = new Chart(dailyCanvasRef.current, {
        type: "line",
        data: {
          labels: dailyLabels,
          datasets: [
            {
              label: "Faturamento Diário (R$)",
              data: dailyValues,
              borderColor: "#3c63da",
              backgroundColor: "rgba(60, 99, 218, 0.12)",
              fill: true,
              tension: 0.35,
              pointRadius: sortedDays.length > 20 ? 3 : 4,
              pointHoverRadius: 6,
              pointBackgroundColor: "#3c63da",
              borderWidth: 2,
            },
            {
              label: "Lucro Líquido Estimado (R$)",
              data: dailyLucros,
              borderColor: "#118464",
              backgroundColor: "rgba(17, 132, 100, 0.08)",
              fill: true,
              tension: 0.35,
              pointRadius: sortedDays.length > 20 ? 3 : 4,
              pointHoverRadius: 6,
              pointBackgroundColor: "#118464",
              borderWidth: 2,
              borderDash: [4, 4],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: {
              position: "top",
              labels: { font: { size: 10, weight: "bold" }, usePointStyle: true, boxWidth: 6 },
            },
            tooltip: {
              backgroundColor: "#152238",
              titleFont: { size: 11, weight: "bold" },
              bodyFont: { size: 11 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${formatBrl(ctx.raw as number)}`,
                afterBody: (items) => {
                  if (!items || items.length === 0) return [];
                  const fat = (items[0]?.raw as number) || 1;
                  const luc = (items[1]?.raw as number) || 0;
                  const pct = ((luc / fat) * 100).toFixed(1);
                  return [` Margem Líquida do Dia: ${pct}%`];
                },
              },
            },
            // @ts-ignore
            pbiDataLabels: {
              enabled: showDataLabels && sortedDays.length <= 15,
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 9 }, maxTicksLimit: 16 },
            },
            y: {
              grid: { color: "#f0f4f9" },
              ticks: {
                font: { size: 9 },
                callback: (val) => "R$ " + (Number(val) / 1000).toFixed(0) + "k",
              },
            },
          },
        },
        plugins: [pbiDataLabelsPlugin],
      });
    }

    // ---------------------------------------------------------------
    // 2. MONTHLY CHART (Sazonalidade & Performance Mensal)
    // ---------------------------------------------------------------
    if (monthlyCanvasRef.current) {
      if (monthlyChartInstance.current) monthlyChartInstance.current.destroy();

      // Sorted selected months
      const sortedMonths = [...dateSelection.months].sort((a, b) => a - b);
      const monthlyLabels = sortedMonths.map((m) => {
        const item = AVAILABLE_MONTHS.find((mo) => mo.value === m);
        const name = item ? item.label.split(" ")[0] : `Mês ${m}`;
        return name.toUpperCase();
      });

      // Values adjusted to selected days ratio & years
      const fatValues = sortedMonths.map((m) => {
        const weight = seasonWeights[m] || 1.0;
        return Math.round(baseMonthlyUnits * weight * daysRatio * numYears);
      });

      const lucroValues = fatValues.map((fat) =>
        Math.round(fat * (dre.margemLiquida || 0.18))
      );

      // Power BI Cross-Highlight colors
      const getBarColor = (baseColor: string, dimColor: string, isFat: boolean) => {
        return monthlyLabels.map((label) => {
          if (!highlightedMonth) return baseColor;
          return label === highlightedMonth ? baseColor : dimColor;
        });
      };

      const fatColors = getBarColor("#3c63da", "rgba(60, 99, 218, 0.28)", true);
      const lucroColors = getBarColor("#118464", "rgba(17, 132, 100, 0.28)", false);

      monthlyChartInstance.current = new Chart(monthlyCanvasRef.current, {
        type: chartViewMode,
        data: {
          labels: monthlyLabels,
          datasets: [
            {
              label: "Faturamento Bruto (R$)",
              data: fatValues,
              backgroundColor: chartViewMode === "bar" ? fatColors : "rgba(60, 99, 218, 0.15)",
              borderColor: "#3c63da",
              borderWidth: chartViewMode === "line" ? 2.5 : 1,
              fill: chartViewMode === "line",
              tension: 0.35,
              borderRadius: 6,
              barPercentage: 0.65,
              categoryPercentage: 0.8,
            },
            {
              label: "Lucro Líquido (R$)",
              data: lucroValues,
              backgroundColor: chartViewMode === "bar" ? lucroColors : "rgba(17, 132, 100, 0.15)",
              borderColor: "#118464",
              borderWidth: chartViewMode === "line" ? 2.5 : 1,
              fill: chartViewMode === "line",
              tension: 0.35,
              borderRadius: 6,
              barPercentage: 0.65,
              categoryPercentage: 0.8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          onClick: (event, elements) => {
            if (elements && elements.length > 0) {
              const idx = elements[0].index;
              const clickedMonth = monthlyLabels[idx];
              setHighlightedMonth((prev) => (prev === clickedMonth ? null : clickedMonth));
            } else {
              setHighlightedMonth(null);
            }
          },
          plugins: {
            legend: {
              position: "top",
              labels: { font: { size: 10, weight: "bold" }, usePointStyle: true, boxWidth: 6 },
            },
            tooltip: {
              backgroundColor: "#152238",
              titleFont: { size: 12, weight: "bold" },
              bodyFont: { size: 11 },
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                title: (items) => `📅 Mês: ${items[0]?.label || ""}`,
                label: (ctx) => ` ${ctx.dataset.label}: ${formatBrl(ctx.raw as number)}`,
                afterBody: (items) => {
                  if (!items || items.length === 0) return [];
                  const fat = (items[0]?.raw as number) || 1;
                  const luc = (items[1]?.raw as number) || 0;
                  const cmv = Math.round(fat * (currentParams.cmv || 0.3));
                  const pct = ((luc / fat) * 100).toFixed(1);
                  return [
                    ` Estimativa CMV: ${formatBrl(cmv)}`,
                    ` Margem Líquida: ${pct}%`,
                    ` 💡 Dica Power BI: Clique na barra para filtrar`,
                  ];
                },
              },
            },
            // @ts-ignore
            pbiDataLabels: {
              enabled: showDataLabels,
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 10, weight: "bold" } },
            },
            y: {
              grid: { color: "#f0f4f9" },
              ticks: {
                font: { size: 9 },
                callback: (val) => "R$ " + (Number(val) / 1000).toFixed(0) + "k",
              },
            },
          },
        },
        plugins: [pbiDataLabelsPlugin],
      });
    }

    return () => {
      if (dailyChartInstance.current) dailyChartInstance.current.destroy();
      if (monthlyChartInstance.current) monthlyChartInstance.current.destroy();
    };
  }, [
    activeSubTab,
    baseMonthlyUnits,
    dre.margemLiquida,
    dre.margemBruta,
    dateSelection,
    visibleUnits.length,
    showDataLabels,
    chartViewMode,
    highlightedMonth,
    currentParams,
    daysRatio,
    numMonths,
    numYears,
  ]);

  const handleExportCsv = () => {
    let csv = "Item;Valor Nominal (R$);Percentual (%)\n";
    csv += `Faturamento Bruto;${dre.fatBruta.toFixed(2)};100.00%\n`;
    csv += `Descontos / Estornos;-${dre.desconto.toFixed(2)};${((dre.desconto / (dre.fatBruta || 1)) * 100).toFixed(2)}%\n`;
    csv += `Impostos sobre Vendas;-${dre.impostos.toFixed(2)};${((dre.impostos / (dre.receitaAjustada || 1)) * 100).toFixed(2)}%\n`;
    csv += `Receita Liquida;${dre.receitaLiquida.toFixed(2)};100.00%\n`;
    csv += `CMV (Custo Mercadoria);-${dre.cmv.toFixed(2)};${((dre.cmv / (dre.receitaLiquida || 1)) * 100).toFixed(2)}%\n`;
    csv += `Taxas de Cartao / Negocio;-${dre.taxasNegocio.toFixed(2)};${((dre.taxasNegocio / (dre.receitaLiquida || 1)) * 100).toFixed(2)}%\n`;
    csv += `Lucro Bruto;${dre.lucroBruto.toFixed(2)};${(dre.margemBruta * 100).toFixed(2)}%\n`;
    dre.despesas.forEach((d) => {
      csv += `${d?.name || "Despesa"};-${d.value.toFixed(2)};${((d.value / (dre.receitaLiquida || 1)) * 100).toFixed(2)}%\n`;
    });
    csv += `Lucro Liquido;${dre.lucroLiquido.toFixed(2)};${(dre.margemLiquida * 100).toFixed(2)}%\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${targetTenantKey}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getScopeTitle = () => {
    if (targetUnit?.name) return `${targetUnit.name} (${targetUnit.code})`;
    if (selectedBusiness !== "all") {
      const b = businesses.find((biz) => biz.id === selectedBusiness);
      return b ? `Rede ${b.name}` : selectedBusiness;
    }
    return "Toda a Rede Consolidada";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Unified Sub-Tab Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Demonstrativo Financeiro & Metas
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-0.5">
            <TrendingUp className="h-6 w-6 text-[#3c63da]" />
            DRE e Resultados — {getScopeTitle()}
          </h2>
          <p className="text-xs text-[#69778c] mt-0.5">
            Apuração contábil em nuvem, controle de margens e gráficos interativos tipo Power BI.
          </p>
        </div>

        {/* Unified Sub-Tabs Toggle: Demonstrativo vs Parâmetros */}
        <div className="flex items-center gap-1.5 rounded-xl bg-white border border-[#e5eaf1] p-1 shadow-xs">
          <button
            onClick={() => setActiveSubTab("demonstrativo")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "demonstrativo"
                ? "bg-[#3c63da] text-white shadow-xs"
                : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Demonstrativo & Resultados</span>
          </button>

          <button
            onClick={() => setActiveSubTab("parametros")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "parametros"
                ? "bg-[#3c63da] text-white shadow-xs"
                : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Parâmetros do DRE</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. ABA: DEMONSTRATIVO & RESULTADOS                            */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === "demonstrativo" && (
        <div className="space-y-6">
          {/* Card Unificado de Filtros com Seletores Granulares (Ano, Mês, Dia, Marca, Unidade) */}
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#3c63da]" />
                <span className="text-xs font-bold text-[#152238] uppercase tracking-wider">
                  Filtros de Período & Escopo
                </span>
                <span className="text-[11px] font-bold text-[#3c63da] bg-[#3c63da]/10 px-2 py-0.5 rounded-full">
                  {visibleUnits.length} unidade(s)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-bold text-[#152238] hover:bg-[#f8faff] hover:border-[#3c63da] transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Exportar CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-bold text-[#152238] hover:bg-[#f8faff] hover:border-[#3c63da] transition-all cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-[#69778c]" />
                  <span className="hidden sm:inline">Imprimir</span>
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

            {/* Resumo do Período Ativo & Multiplicador */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[#f8faff] border border-[#e5eaf1] text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#152238]">Período Ativo:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[#3c63da] font-extrabold text-[11px]">
                  <Calendar className="h-3 w-3" />
                  {getPeriodSummary()}
                </span>
                <span className="text-[11px] text-[#69778c]">
                  Multiplicador proporcional: <strong>{periodMultiplier.toFixed(2)}x</strong>
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
                  setSelectedFranchise("all");
                  setHighlightedMonth(null);
                }}
                className="text-[11px] font-bold text-[#69778c] hover:text-[#3c63da] transition-colors cursor-pointer self-end sm:self-auto"
              >
                Redefinir Filtros Padrão
              </button>
            </div>
          </div>

          {/* Banner de Destaque Interativo Power BI (quando usuário clica em um mês) */}
          {highlightedMonth && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-[#3c63da]/10 via-[#3c63da]/5 to-transparent border border-[#3c63da]/30 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="h-2 w-2 rounded-full bg-[#3c63da]" />
                <span className="font-bold text-[#152238]">
                  Filtro Interativo Power BI Ativo:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#3c63da] text-white font-extrabold text-xs">
                  Mês {highlightedMonth}
                </span>
                <span className="text-[#69778c] text-[11px]">
                  (Barras destacadas no gráfico abaixo. Clique novamente na barra ou no botão ao lado para limpar)
                </span>
              </div>
              <button
                onClick={() => setHighlightedMonth(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#cbd5e1] text-xs font-bold text-[#152238] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpar Filtro de Mês</span>
              </button>
            </div>
          )}

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

              <div className="text-right">
                <span className="text-[11px] text-[#69778c] block">Resultado Líquido</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {formatPct(dre.margemLiquida)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8faff] border-b border-[#e5eaf1] text-[#69778c]">
                    <th className="py-2.5 px-4 font-bold uppercase text-[10px]">Conta Contábil / Descrição</th>
                    <th className="py-2.5 px-4 text-right font-bold uppercase text-[10px]">Valor Nominal (R$)</th>
                    <th className="py-2.5 px-4 text-right font-bold uppercase text-[10px]">% Sobre Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5eaf1]">
                  <tr className="font-bold text-[#152238] bg-[#f8faff]/50">
                    <td className="py-2.5 px-4">(=) RECEITA BRUTA OPERACIONAL</td>
                    <td className="py-2.5 px-4 text-right font-mono text-emerald-800">
                      {formatBrl2(dre.fatBruta)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">100,00%</td>
                  </tr>
                  <tr className="text-[#69778c]">
                    <td className="py-2.5 px-4 pl-8">(-) Descontos & Cancelamentos</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.desconto)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatPct2(dre.desconto / (dre.fatBruta || 1))}
                    </td>
                  </tr>
                  <tr className="text-[#69778c]">
                    <td className="py-2.5 px-4 pl-8">(-) Impostos sobre Vendas</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.impostos)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatPct2(dre.impostos / (dre.receitaAjustada || 1))}
                    </td>
                  </tr>
                  <tr className="font-bold text-[#152238] bg-[#f4f7fb]/60">
                    <td className="py-2.5 px-4">(=) RECEITA LÍQUIDA OPERACIONAL</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatBrl2(dre.receitaLiquida)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">100,00%</td>
                  </tr>
                  <tr className="text-[#69778c]">
                    <td className="py-2.5 px-4 pl-8">(-) Custo das Mercadorias Vendidas (CMV)</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.cmv)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatPct2(dre.cmv / (dre.receitaLiquida || 1))}
                    </td>
                  </tr>
                  <tr className="text-[#69778c]">
                    <td className="py-2.5 px-4 pl-8">(-) Taxas de Cartão & Plataforma</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.taxasNegocio)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatPct2(dre.taxasNegocio / (dre.receitaLiquida || 1))}
                    </td>
                  </tr>
                  <tr className="bg-[#edf2ff] font-bold text-[#152238]">
                    <td className="py-3 px-4">(=) Margem de Contribuição Bruta (Lucro Bruto)</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#3c63da]">
                      {formatBrl2(dre.lucroBruto)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatPct2(dre.margemBruta)}</td>
                  </tr>

                  {/* Despesas Fixas Group */}
                  <tr className="bg-[#f8faff]">
                    <td colSpan={3} className="py-2 px-4 text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                      Despesas Operacionais Fixas & Administrativas
                    </td>
                  </tr>
                  {dre.despesas.map((item) => (
                    <tr key={item.id} className="text-[#69778c]">
                      <td className="py-2 px-4 pl-8 text-xs">{item.name}</td>
                      <td className="py-2 px-4 text-right font-mono text-[#b44b4b]">
                        -{formatBrl2(item.value)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-[11px]">
                        {formatPct2(item.value / (dre.receitaLiquida || 1))}
                      </td>
                    </tr>
                  ))}

                  {/* Final Net Profit */}
                  <tr className="bg-emerald-50 text-emerald-950 font-extrabold text-sm border-t-2 border-emerald-500">
                    <td className="py-4 px-4">(=) RESULTADO LÍQUIDO DO PERÍODO</td>
                    <td className="py-4 px-4 text-right font-mono text-emerald-800 text-base">
                      {formatBrl2(dre.lucroLiquido)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-emerald-800 text-base">
                      {formatPct2(dre.margemLiquida)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* GRÁFICOS INTERATIVOS ESTILO POWER BI (Com Rótulos de Dados)   */}
          {/* ------------------------------------------------------------- */}
          <div className="space-y-4">
            {/* Barra de Ferramentas Power BI */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-[#e5eaf1] shadow-xs">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#3c63da]/10 text-[#3c63da] flex items-center justify-center font-black text-xs">
                  PBI
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#152238] flex items-center gap-1.5">
                    <span>Gráficos Interativos Dinâmicos</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">
                      Rótulos de Dados
                    </span>
                  </h4>
                  <p className="text-[11px] text-[#69778c]">
                    Altere os filtros acima para atualizar os gráficos instantaneamente. Clique nas barras para filtrar.
                  </p>
                </div>
              </div>

              {/* Botões de Controle Interativos */}
              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                {/* Toggle Rótulos de Dados */}
                <button
                  type="button"
                  onClick={() => setShowDataLabels((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    showDataLabels
                      ? "bg-[#3c63da] text-white border-[#3c63da] shadow-xs"
                      : "bg-white text-[#69778c] border-[#cbd5e1] hover:bg-[#f8faff]"
                  }`}
                  title="Ligar ou desligar rótulos de dados sobre as barras e pontos"
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span>Rótulos: {showDataLabels ? "Ligados" : "Desligados"}</span>
                </button>

                {/* Toggle Formato do Gráfico Mensal (Barras ou Linha) */}
                <div className="flex items-center rounded-xl border border-[#cbd5e1] bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartViewMode("bar")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      chartViewMode === "bar"
                        ? "bg-[#152238] text-white shadow-2xs"
                        : "text-[#69778c] hover:text-[#152238]"
                    }`}
                    title="Visualização em Colunas Agrupadas"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewMode("line")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      chartViewMode === "line"
                        ? "bg-[#152238] text-white shadow-2xs"
                        : "text-[#69778c] hover:text-[#152238]"
                    }`}
                    title="Visualização em Linhas de Tendência"
                  >
                    <LineChart className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Grid dos 2 Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Gráfico 1: Evolução Diária */}
              <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-[#152238] flex items-center gap-1.5">
                    <LineChart className="h-4 w-4 text-[#3c63da]" />
                    <span>Evolução Diária do Faturamento & Lucro</span>
                  </h3>
                  <span className="text-[10px] font-extrabold text-[#3c63da] bg-[#3c63da]/10 px-2 py-0.5 rounded-full">
                    {dateSelection.days.length} dia(s)
                  </span>
                </div>
                <p className="text-[11px] text-[#69778c] mb-4">
                  Curva diária conforme os dias selecionados no filtro.
                </p>
                <div className="h-72 w-full flex-1 relative">
                  <canvas ref={dailyCanvasRef} />
                </div>
              </div>

              {/* Gráfico 2: Sazonalidade Mensal com Interatividade Power BI */}
              <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-[#152238] flex items-center gap-1.5">
                    <BarChart2 className="h-4 w-4 text-emerald-600" />
                    <span>Sazonalidade Mensal (Faturamento x Lucro)</span>
                  </h3>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {dateSelection.months.length} mês(es)
                  </span>
                </div>
                <p className="text-[11px] text-[#69778c] mb-4">
                  Comparativo mensal. Clique em qualquer barra para destacar no estilo Power BI.
                </p>
                <div className="h-72 w-full flex-1 relative">
                  <canvas ref={monthlyCanvasRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. ABA: PARÂMETROS DO DRE UNIFICADOS                          */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === "parametros" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#e5eaf1] shadow-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
                Parametrização Centralizada
              </span>
              <h3 className="text-base font-bold text-[#152238]">
                Alíquotas e Despesas — {getScopeTitle()}
              </h3>
              <p className="text-xs text-[#69778c]">
                Ajuste os percentuais aplicados nas apurações financeiras e salve na nuvem.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetParams}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#69778c] hover:bg-[#f4f7fb] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restaurar Padrões</span>
              </button>

              <button
                onClick={handleSaveParams}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSaved ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
                <span>{isSaved ? "Salvo na Nuvem!" : isSaving ? "Salvando..." : "Salvar Parâmetros"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Form Fields: Impostos, CMV, Taxas */}
            <div className="lg:col-span-2 space-y-5">
              {/* Contas Gerais */}
              <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
                <h4 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#3c63da]" />
                  <span>Deduções & Custos Variáveis Principais</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#152238] mb-1">
                      Alíquota de Impostos sobre Vendas (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={((paramsForm.impostos || 0) * 100).toFixed(1)}
                        onChange={(e) => handleGeneralChange("impostos", e.target.value)}
                        className="w-full rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                    </div>
                    <span className="text-[10px] text-[#69778c] mt-0.5 block">Simples Nacional ou presumido</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#152238] mb-1">
                      Custo de Mercadoria Vendida (CMV) (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={((paramsForm.cmv || 0) * 100).toFixed(1)}
                        onChange={(e) => handleGeneralChange("cmv", e.target.value)}
                        className="w-full rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                    </div>
                    <span className="text-[10px] text-[#69778c] mt-0.5 block">Custo direto dos insumos/produtos</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#152238] mb-1">
                      Taxas de Cartões & Meios de Pagamento (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={((paramsForm.fees || 0) * 100).toFixed(1)}
                        onChange={(e) => handleGeneralChange("fees", e.target.value)}
                        className="w-full rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                    </div>
                    <span className="text-[10px] text-[#69778c] mt-0.5 block">MDR médio adquirentes e pix</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#152238] mb-1">
                      Descontos & Cancelamentos Estimados (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={((paramsForm.discount || 0) * 100).toFixed(1)}
                        onChange={(e) => handleGeneralChange("discount", e.target.value)}
                        className="w-full rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                    </div>
                    <span className="text-[10px] text-[#69778c] mt-0.5 block">Promoções e cortesias</span>
                  </div>
                </div>
              </div>

              {/* Despesas Fixas Detalhadas */}
              <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3">
                <h4 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#3c63da]" />
                  <span>Despesas Operacionais Fixas Parametrizadas</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dreExpenseDefs.map((def) => {
                    const currentVal = paramsForm.despesas[def.id] ?? def.pct;
                    return (
                      <div key={def.id} className="p-3 rounded-xl border border-[#e5eaf1] bg-[#f8faff]">
                        <div className="flex items-center justify-between text-xs font-bold text-[#152238] mb-1">
                          <span className="truncate">{def.name}</span>
                          <span className="text-[10px] text-[#69778c] uppercase font-mono">{def.group}</span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="100"
                            value={(currentVal * 100).toFixed(2)}
                            onChange={(e) => handleExpenseChange(def.id, e.target.value)}
                            className="w-full rounded-lg border border-[#e5eaf1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                          />
                          <span className="absolute right-2.5 top-1.5 text-xs font-bold text-[#69778c]">%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live Impact Preview Card */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs sticky top-20 space-y-4">
                <h4 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-2 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Simulação de Impacto em Tempo Real</span>
                </h4>

                <p className="text-xs text-[#69778c]">
                  Baseado no faturamento atual de <strong>{formatBrl(baseFat)}</strong>:
                </p>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#e5eaf1]">
                    <span className="text-[#69778c]">Impostos:</span>
                    <b className="text-[#b44b4b]">-{formatBrl(previewDre.impostos)}</b>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#e5eaf1]">
                    <span className="text-[#69778c]">CMV Total:</span>
                    <b className="text-[#b44b4b]">-{formatBrl(previewDre.cmv)}</b>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#e5eaf1]">
                    <span className="text-[#69778c]">Lucro Bruto:</span>
                    <b className="text-[#3c63da]">{formatBrl(previewDre.lucroBruto)}</b>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#e5eaf1]">
                    <span className="text-[#69778c]">Despesas Fixas:</span>
                    <b className="text-[#b44b4b]">-{formatBrl(previewDre.totalDesp)}</b>
                  </div>
                  <div className="flex justify-between py-2 bg-emerald-50 px-2.5 rounded-lg text-emerald-900 font-extrabold text-sm border border-emerald-200">
                    <span>Lucro Líquido:</span>
                    <span>{formatBrl(previewDre.lucroLiquido)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1">
                    <span>Margem Líquida Estimada:</span>
                    <span>{formatPct(previewDre.margemLiquida)}</span>
                  </div>
                </div>

                <button
                  onClick={handleSaveParams}
                  disabled={isSaving}
                  className="w-full rounded-xl bg-[#3c63da] py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaved ? "Salvo com Sucesso!" : isSaving ? "Salvando..." : "Salvar Alterações na Nuvem"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
