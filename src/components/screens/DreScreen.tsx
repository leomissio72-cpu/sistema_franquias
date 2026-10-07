import React, { useEffect, useRef, useState } from "react";
import { BillItem, FranchiseUnit, Business, ScreenType, DreParams, UserSession, ManualEntry, IntercompanyRule } from "../../types";
import {
  formatBrl,
  formatBrl2,
  formatPct,
  formatPct2,
  calculateDre,
  getBillDueStatus,
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
import Chart from "chart.js/auto";
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
  // Main sub-tab: demonstrativo vs extrato vs parametros
  const [activeSubTab, setActiveSubTab] = useState<"demonstrativo" | "extrato" | "parametros">("demonstrativo");
  const [calculationMode, setCalculationMode] = useState<"real" | "projecao">("real");

  // -------------------------------------------------------------
  // Granular Date Selection (Ano, Mês e Dia)
  // -------------------------------------------------------------
  const [dateSelection, setDateSelection] = useState<DateFilterSelection>({
    years: [CURRENT_YEAR],
    months: [CURRENT_MONTH],
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
      if (selectedFranchise !== "all" && entry.tenant !== selectedFranchise && entry.tenant !== "dono") {
        return false;
      }

      // 4. Business filter
      if (selectedBusiness !== "all") {
        const unit = franchises.find((f) => f.id === entry.tenant);
        if (unit && unit.businessId !== selectedBusiness) return false;
      }

      // 5. Date filter
      if (entry.date) {
        const parts = entry.date.split("-");
        if (parts.length >= 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (!isNaN(y) && !dateSelection.years.includes(y)) return false;
          if (!isNaN(m) && !dateSelection.months.includes(m)) return false;
          if (!isNaN(d) && !dateSelection.days.includes(d)) return false;
        }
      }

      return true;
    });
  }, [manualEntries, intercompanyRules, selectedFranchise, selectedBusiness, dateSelection, franchises]);

  // Real entries breakdown
  const realEntradas = React.useMemo(() => activeEntries.filter((e) => e.type === "entrada"), [activeEntries]);
  const realDespesas = React.useMemo(() => activeEntries.filter((e) => e.type === "despesa"), [activeEntries]);
  const realFatBruta = React.useMemo(() => realEntradas.reduce((s, e) => s + (Number(e.value) || 0), 0), [realEntradas]);

  // Main DRE calculation
  const dre = React.useMemo(() => {
    // If in Real Data mode and there are NO entries found (or data was deleted/cleared):
    if (calculationMode === "real" && activeEntries.length === 0) {
      const emptyDespesas = dreExpenseDefs.map((e) => ({
        ...e,
        pct: currentParams.despesas?.[e.id] ?? e.pct,
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

    if (calculationMode === "real") {
      // Real entries exist: calculate using real revenue & real expenses
      const calc = calculateDre(realFatBruta, currentParams, unitRoyalty, targetBiz);

      // Group real expenses by category where possible
      const mappedDespesas = dreExpenseDefs.map((e) => {
        const matchedItems = realDespesas.filter((de) => {
          const cId = (de.catId || "").toLowerCase();
          const cName = (de.catName || "").toLowerCase();
          const eId = e.id.toLowerCase();
          const eName = e.name.toLowerCase();
          return cId.includes(eId) || cName.includes(eId) || cName.includes(eName) || eName.includes(cName);
        });

        if (matchedItems.length > 0) {
          const catSum = matchedItems.reduce((s, item) => s + (Number(item.value) || 0), 0);
          return {
            ...e,
            pct: realFatBruta > 0 ? catSum / realFatBruta : 0,
            value: catSum,
          };
        }

        return {
          ...e,
          pct: 0,
          value: 0,
        };
      });

      const totRealDesp = mappedDespesas.reduce((s, d) => s + d.value, 0);
      const lucroLiq = calc.lucroBruto - totRealDesp;

      return {
        ...calc,
        despesas: mappedDespesas,
        totalDesp: totRealDesp,
        lucroLiquido: lucroLiq,
        margemLiquida: realFatBruta > 0 ? lucroLiq / realFatBruta : 0,
      };
    }

    // Projection mode: target projection from franchise baseFat
    return calculateDre(baseFat, currentParams, unitRoyalty, targetBiz);
  }, [calculationMode, activeEntries, realEntradas, realDespesas, realFatBruta, baseFat, currentParams, unitRoyalty]);

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

  const handleGeneratePdfReport = () => {
    const scope = getScopeTitle();
    const yearsStr = dateSelection.years?.length ? dateSelection.years.join(", ") : "Todos";
    const monthsStr = dateSelection.months?.length ? dateSelection.months.map((m) => AVAILABLE_MONTHS.find((item) => item.value === m)?.short || m).join(", ") : "Todos";
    const daysStr = dateSelection.days?.length ? `${dateSelection.days.length} dia(s)` : "Todos";
    const period = `Ano: ${yearsStr} · Mês: ${monthsStr} · Dias: ${daysStr}`;
    const dateStr = new Date().toLocaleDateString("pt-BR");

    let rowsHtml = `
      <tr style="background:#f8faff;font-weight:bold;">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">(=) RECEITA BRUTA OPERACIONAL</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e2e8f0;color:#118464;font-family:monospace;">${formatBrl2(dre.fatBruta)}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;">100,00%</td>
      </tr>
      <tr style="color:#64748b;">
        <td style="padding:7px 12px;padding-left:24px;border-bottom:1px solid #e2e8f0;">(-) Descontos & Cancelamentos</td>
        <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #e2e8f0;color:#b44b4b;font-family:monospace;">-${formatBrl2(dre.desconto)}</td>
        <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;">${formatPct2(dre.desconto / (dre.fatBruta || 1))}</td>
      </tr>
      <tr style="color:#64748b;">
        <td style="padding:7px 12px;padding-left:24px;border-bottom:1px solid #e2e8f0;">(-) Impostos sobre Vendas</td>
        <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #e2e8f0;color:#b44b4b;font-family:monospace;">-${formatBrl2(dre.impostos)}</td>
        <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;">${formatPct2(dre.impostos / (dre.receitaAjustada || 1))}</td>
      </tr>
      <tr style="background:#f1f5f9;font-weight:bold;">
        <td style="padding:8px 12px;border-bottom:1px solid #cbd5e1;">(=) RECEITA LÍQUIDA OPERACIONAL</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #cbd5e1;font-family:monospace;">${formatBrl2(dre.receitaLiquida)}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #cbd5e1;font-family:monospace;">100,00%</td>
      </tr>
      <tr style="color:#64748b;">
        <td style="padding:7px 12px;padding-left:24px;border-bottom:1px solid #e2e8f0;">(-) Custo das Mercadorias Vendidas (CMV)</td>
        <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #e2e8f0;color:#b44b4b;font-family:monospace;">-${formatBrl2(dre.cmv)}</td>
        <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;">${formatPct2(dre.cmv / (dre.receitaLiquida || 1))}</td>
      </tr>
      <tr style="color:#64748b;">
        <td style="padding:7px 12px;padding-left:24px;border-bottom:1px solid #e2e8f0;">(-) Taxas de Cartão & Meios de Pagamento</td>
        <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #e2e8f0;color:#b44b4b;font-family:monospace;">-${formatBrl2(dre.taxasNegocio)}</td>
        <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;">${formatPct2(dre.taxasNegocio / (dre.receitaLiquida || 1))}</td>
      </tr>
      <tr style="background:#edf2ff;font-weight:bold;">
        <td style="padding:8px 12px;border-bottom:1px solid #cbd5e1;color:#1e3a8a;">(=) Lucro Bruto (Margem de Contribuição)</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #cbd5e1;color:#2563eb;font-family:monospace;">${formatBrl2(dre.lucroBruto)}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #cbd5e1;font-family:monospace;">${formatPct2(dre.margemBruta)}</td>
      </tr>
      <tr style="background:#f8fafc;font-weight:bold;">
        <td colspan="3" style="padding:6px 12px;text-transform:uppercase;font-size:10px;color:#64748b;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">Despesas Operacionais Fixas</td>
      </tr>
    `;

    dre.despesas.forEach((d) => {
      rowsHtml += `
        <tr style="color:#64748b;">
          <td style="padding:6px 12px;padding-left:24px;border-bottom:1px solid #f1f5f9;">${d?.name || "Despesa"}</td>
          <td style="padding:6px 12px;text-align:right;border-bottom:1px solid #f1f5f9;color:#b44b4b;font-family:monospace;">-${formatBrl2(d.value)}</td>
          <td style="padding:6px 12px;text-align:right;border-bottom:1px solid #f1f5f9;font-family:monospace;">${formatPct2(d.value / (dre.receitaLiquida || 1))}</td>
        </tr>
      `;
    });

    rowsHtml += `
      <tr style="background:#ecfdf5;font-weight:bold;border-top:2px solid #10b981;">
        <td style="padding:10px 12px;font-size:13px;color:#064e3b;">(=) RESULTADO LÍQUIDO DO PERÍODO</td>
        <td style="padding:10px 12px;text-align:right;font-size:13px;color:#047857;font-family:monospace;">${formatBrl2(dre.lucroLiquido)}</td>
        <td style="padding:10px 12px;text-align:right;font-size:13px;color:#047857;font-family:monospace;">${formatPct2(dre.margemLiquida)}</td>
      </tr>
    `;

    let unitsTableHtml = "";
    if (visibleUnits.length > 1) {
      let unitRows = "";
      visibleUnits.forEach((u) => {
        const uParams = dreParams[u.id] || dreParams["dono"];
        const uRoy = royalties[u.businessId];
        const uCalc = calculateDre(u.faturamento, uParams, uRoy);
        const b = businesses.find(biz => biz.id === u.businessId);
        unitRows += `
          <tr>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${u.code}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${u.name}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${b?.name || u.businessId}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${u.city}</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;">${formatBrl2(u.faturamento)}</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#047857;">${formatBrl2(uCalc.lucroLiquido)}</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-family:monospace;">${formatPct2(uCalc.margemLiquida)}</td>
          </tr>
        `;
      });

      unitsTableHtml = `
        <div style="margin-top:20px;">
          <h3 style="font-size:12px;font-weight:bold;margin-bottom:6px;color:#1e293b;">Demonstrativo por Unidade da Rede</h3>
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <thead>
              <tr style="background:#f8fafc;color:#64748b;text-align:left;">
                <th style="padding:6px 8px;border-bottom:2px solid #cbd5e1;">Código</th>
                <th style="padding:6px 8px;border-bottom:2px solid #cbd5e1;">Unidade</th>
                <th style="padding:6px 8px;border-bottom:2px solid #cbd5e1;">Marca</th>
                <th style="padding:6px 8px;border-bottom:2px solid #cbd5e1;">Cidade</th>
                <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #cbd5e1;">Faturamento</th>
                <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #cbd5e1;">Lucro Líquido</th>
                <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #cbd5e1;">Margem %</th>
              </tr>
            </thead>
            <tbody>${unitRows}</tbody>
          </table>
        </div>
      `;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DRE - ${scope}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #1e293b; line-height: 1.35; background:#fff; }
    .header { border-bottom: 2px solid #3c63da; padding-bottom: 8px; margin-bottom: 14px; }
    .title { font-size: 17px; font-weight: 800; color: #0f172a; margin: 0; }
    .meta-box { font-size: 11px; color: #475569; margin-top: 4px; display: flex; gap: 15px; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; }
    @media print {
      body { margin: 10mm; }
      @page { size: portrait; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">Demonstrativo do Resultado do Exercício (DRE)</h1>
    <div class="meta-box">
      <span><strong>Unidade / Escopo:</strong> ${scope}</span>
      <span><strong>Período:</strong> ${period}</span>
      <span><strong>Emissão:</strong> ${dateStr}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr style="background:#f1f5f9;color:#475569;text-align:left;">
        <th style="padding:8px 12px;border-bottom:2px solid #cbd5e1;">Conta Contábil / Descrição</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #cbd5e1;">Valor Nominal (R$)</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #cbd5e1;">% Sobre Receita</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  ${unitsTableHtml}
</body>
</html>`;

    // Utiliza iframe oculto dedicado: imprime APENAS a tabela, unidade e período, sem a página inteira
    const oldFrame = document.getElementById("dre-print-iframe");
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "dre-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 350);
    }
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
            Apuração contábil, controle de margens e gráficos interativos tipo Power BI.
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
            Demonstrativo DRE & Gráficos
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
          <button
            onClick={() => setActiveSubTab("parametros")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === "parametros"
                ? "bg-[#3c63da] text-white shadow-xs"
                : "bg-white border border-[#e5eaf1] text-[#69778c] hover:text-[#152238]"
            }`}
          >
            Parâmetros do DRE
          </button>
        </div>

        {activeSubTab === "extrato" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
              <div>
                <h3 className="text-base font-extrabold text-[#152238]">Extrato de Entradas, Saídas e Despesas do DRE</h3>
                <p className="text-xs text-[#69778c] mt-0.5">
                  Filtros aplicados: {getPeriodSummary()} | Escopo: {getScopeTitle()}
                </p>
              </div>
              <button
                onClick={handleExportExtratoCsv}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Baixar Extrato (.csv)</span>
              </button>
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

      {activeSubTab === "parametros" && (
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-base font-extrabold text-[#152238]">Parâmetros & Alíquotas do DRE ({targetTenantKey})</h3>
              <p className="text-xs text-[#69778c] mt-0.5">Ajuste os percentuais de impostos, CMV, taxas e despesas para projeções e cálculo contábil.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetParams}
                className="px-3 py-2 rounded-xl border border-[#cbd5e1] bg-white text-xs font-bold text-[#64748b] hover:text-[#152238] transition-colors cursor-pointer"
              >
                Restaurar Padrão
              </button>
              <button
                type="button"
                onClick={() => void handleSaveParams()}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3c63da] text-xs font-bold text-white hover:bg-[#2f52c0] transition-all cursor-pointer shadow-2xs"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Salvando..." : "Salvar Parâmetros"}</span>
              </button>
            </div>
          </div>

          {isSaved && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Parâmetros salvos com sucesso!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#152238] mb-1">Impostos sobre Vendas (%)</label>
              <input
                type="number"
                step="0.1"
                value={Number((paramsForm.impostos * 100).toFixed(2))}
                onChange={(e) => handleGeneralChange("impostos", e.target.value)}
                className="w-full rounded-xl border border-[#cbd5e1] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#152238] mb-1">CMV (%)</label>
              <input
                type="number"
                step="0.1"
                value={Number((paramsForm.cmv * 100).toFixed(2))}
                onChange={(e) => handleGeneralChange("cmv", e.target.value)}
                className="w-full rounded-xl border border-[#cbd5e1] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#152238] mb-1">Taxas de Cartão (%)</label>
              <input
                type="number"
                step="0.1"
                value={Number((paramsForm.fees * 100).toFixed(2))}
                onChange={(e) => handleGeneralChange("fees", e.target.value)}
                className="w-full rounded-xl border border-[#cbd5e1] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#152238] mb-1">Descontos (%)</label>
              <input
                type="number"
                step="0.1"
                value={Number((paramsForm.discount * 100).toFixed(2))}
                onChange={(e) => handleGeneralChange("discount", e.target.value)}
                className="w-full rounded-xl border border-[#cbd5e1] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238]"
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[#e5eaf1]">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#152238]">Despesas Operacionais Fixas (% s/ Faturamento)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dreExpenseDefs.map((def) => {
                const val = paramsForm.despesas?.[def.id] ?? def.pct;
                return (
                  <div key={def.id} className="p-3 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-1">
                    <label className="block text-xs font-bold text-[#152238]">{def.name}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={Number((val * 100).toFixed(2))}
                        onChange={(e) => handleExpenseChange(def.id, e.target.value)}
                        className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-bold text-[#152238]"
                      />
                      <span className="text-xs font-bold text-[#69778c]">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                  title="Baixar planilha completa da DRE com todas as contas e tabela detalhada"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Baixar Tabela DRE (.csv)</span>
                </button>
                <button
                  onClick={handleGeneratePdfReport}
                  className="flex items-center gap-1.5 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff] px-3 py-1.5 text-xs font-bold text-[#3c63da] hover:bg-[#dfe8fe] transition-all cursor-pointer shadow-2xs"
                  title="Baixar relatório formatado em PDF"
                >
                  <Download className="h-3.5 w-3.5 text-[#3c63da]" />
                  <span className="hidden sm:inline">Baixar PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-bold text-[#152238] hover:bg-[#f8faff] hover:border-[#3c63da] transition-all cursor-pointer"
                  title="Imprimir ou Salvar em PDF"
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

            {/* Seleção de Modo de Cálculo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1] text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold text-[#152238]">Origem dos Dados:</span>
                <div className="inline-flex items-center gap-1 bg-[#e2e8f0] p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCalculationMode("real")}
                    className={`px-2 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${
                      calculationMode === "real"
                        ? "bg-[#3c63da] text-white shadow-2xs"
                        : "text-[#64748b] hover:text-[#152238]"
                    }`}
                  >
                    Lançamentos Reais ({activeEntries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalculationMode("projecao")}
                    className={`px-2 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${
                      calculationMode === "projecao"
                        ? "bg-[#3c63da] text-white shadow-2xs"
                        : "text-[#64748b] hover:text-[#152238]"
                    }`}
                  >
                    Projeção Teórica
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDateSelection({
                      years: [CURRENT_YEAR],
                      months: [CURRENT_MONTH],
                      days: AVAILABLE_DAYS,
                    });
                  }}
                  className="flex items-center gap-1 rounded-lg border border-[#cbd5e1] bg-white px-2 py-1 text-[11px] font-bold text-[#64748b] hover:text-[#3c63da] hover:border-[#3c63da] transition-all cursor-pointer"
                  title="Redefinir filtros para o mês atual"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Redefinir</span>
                </button>
              </div>
            </div>

            {calculationMode === "real" && activeEntries.length === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-2xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-amber-950 block text-xs">DRE Zerado — Nenhum lançamento ativo encontrado na base</span>
                  <span className="text-[11px]">
                    Ao apagar ou limpar os dados operacionais, o DRE zera imediatamente refletindo R$ 0,00. Adicione novos lançamentos em <strong>Lançamentos & Extrato</strong> ou selecione outro período acima para atualizar o demonstrativo.
                  </span>
                </div>
              </div>
            )}
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
                    <span>Baixar PDF</span>
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
      </div>
    </div>
  );
};
