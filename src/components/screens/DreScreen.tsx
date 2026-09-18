import React, { useEffect, useRef, useState } from "react";
import { FranchiseUnit, Business, ScreenType, DreParams } from "../../types";
import {
  formatBrl,
  formatBrl2,
  formatPct,
  formatPct2,
  calculateDre,
  generateDailyRevenue,
  generateMonthlyRevenue
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
  DollarSign
} from "lucide-react";
import Chart from "chart.js/auto";

interface DreScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentTenantId: string;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
  onNavigate: (screen: ScreenType) => void;
  onSelectTenant: (tenantId: string) => void;
  onSaveParams?: (tenantId: string, params: DreParams) => Promise<void>;
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
}) => {
  // Main sub-tab: demonstrativo vs parametros
  const [activeSubTab, setActiveSubTab] = useState<"demonstrativo" | "parametros">("demonstrativo");
  const [range, setRange] = useState<"mes" | "trimestre" | "ano">("mes");

  // Chart references
  const dailyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const monthlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dailyChartInstance = useRef<Chart | null>(null);
  const monthlyChartInstance = useRef<Chart | null>(null);

  const mult = range === "mes" ? 1 : range === "trimestre" ? 3 : 12;
  const isRede = currentTenantId === "dono" || currentTenantId === "equipe" || currentTenantId.startsWith("biz");

  const visibleUnits = franchises.filter((f) => {
    if (currentTenantId === "dono" || currentTenantId === "equipe") return true;
    if (currentTenantId.startsWith("biz")) return f.businessId === currentTenantId;
    return f.id === currentTenantId;
  });

  const baseFat = visibleUnits.reduce((s, f) => s + f.faturamento, 0) * mult;
  const currentParams: DreParams = dreParams[currentTenantId] || dreParams["dono"] || defaultDreParams;
  const currentUnit = franchises.find((f) => f.id === currentTenantId);
  const unitRoyalty = currentUnit ? royalties[currentUnit.businessId] : undefined;

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

  // Synchronize paramsForm when currentTenantId or dreParams updates
  useEffect(() => {
    const updated = dreParams[currentTenantId] || dreParams["dono"] || defaultDreParams;
    setParamsForm({
      impostos: updated.impostos,
      cmv: updated.cmv,
      fees: updated.fees,
      discount: updated.discount,
      despesas: { ...updated.despesas },
    });
  }, [currentTenantId, dreParams]);

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
      await onSaveParams(currentTenantId, paramsForm);
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

  // -----------------------------------------------------------------
  // Charts useEffect
  // -----------------------------------------------------------------
  useEffect(() => {
    if (activeSubTab !== "demonstrativo") return;

    // 1. Daily chart
    if (dailyCanvasRef.current) {
      if (dailyChartInstance.current) dailyChartInstance.current.destroy();

      const dailyData = generateDailyRevenue(baseFat / mult, 30, isRede ? 101 : 202);
      const labels = dailyData.map((d) => d.label);
      const values = dailyData.map((d) => d.value);
      const lucros = dailyData.map((d) => Math.round(d.value * (dre.margemLiquida || 0.18)));

      dailyChartInstance.current = new Chart(dailyCanvasRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Faturamento Diário (R$)",
              data: values,
              borderColor: "#3c63da",
              backgroundColor: "rgba(60, 99, 218, 0.12)",
              fill: true,
              tension: 0.35,
              pointRadius: 2,
              borderWidth: 2,
            },
            {
              label: "Lucro Estimado (R$)",
              data: lucros,
              borderColor: "#118464",
              backgroundColor: "transparent",
              tension: 0.35,
              pointRadius: 2,
              borderWidth: 1.5,
              borderDash: [4, 4],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { font: { size: 10, weight: "bold" } } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 12 } },
            y: {
              grid: { color: "#f0f4f9" },
              ticks: {
                font: { size: 9 },
                callback: (val) => "R$ " + (Number(val) / 1000).toFixed(0) + "k",
              },
            },
          },
        },
      });
    }

    // 2. Monthly chart
    if (monthlyCanvasRef.current) {
      if (monthlyChartInstance.current) monthlyChartInstance.current.destroy();

      const monthlyData = generateMonthlyRevenue(baseFat / mult, isRede ? 303 : 404);
      const labels = monthlyData.map((m) => m.label);
      const fatValues = monthlyData.map((m) => m.value);
      const lucroValues = monthlyData.map((m) => Math.round(m.value * (dre.margemLiquida || 0.18)));

      monthlyChartInstance.current = new Chart(monthlyCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Faturamento (R$)",
              data: fatValues,
              backgroundColor: "#3c63da",
              borderRadius: 6,
              barPercentage: 0.6,
            },
            {
              label: "Lucro Líquido (R$)",
              data: lucroValues,
              backgroundColor: "#118464",
              borderRadius: 6,
              barPercentage: 0.6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { font: { size: 10, weight: "bold" } } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 } } },
            y: {
              grid: { color: "#f0f4f9" },
              ticks: {
                font: { size: 9 },
                callback: (val) => "R$ " + (Number(val) / 1000).toFixed(0) + "k",
              },
            },
          },
        },
      });
    }

    return () => {
      if (dailyChartInstance.current) dailyChartInstance.current.destroy();
      if (monthlyChartInstance.current) monthlyChartInstance.current.destroy();
    };
  }, [baseFat, dre.margemLiquida, activeSubTab, mult, isRede]);

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
    a.download = `DRE_${currentTenantId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getScopeTitle = () => {
    if (currentUnit?.name) return `${currentUnit.name} (${currentUnit.code})`;
    if (currentTenantId.startsWith("biz")) {
      const b = businesses.find((biz) => biz.id === currentTenantId);
      return b ? `Matriz ${b.brand || b.name || b.id}` : currentTenantId;
    }
    return "Rede Consolidada (Todas as Unidades)";
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
            Apuração contábil em nuvem, controle de margens e parametrização unificada de custos.
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
      {/* 1. ABA: DEMONSTRATIVO & RESULTADOS */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === "demonstrativo" && (
        <div className="space-y-6">
          {/* Controls: Range Selector + Export Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5eaf1] bg-white p-3 shadow-xs">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-[#69778c] mr-2 hidden sm:inline">
                Período de Apuração:
              </span>
              <button
                onClick={() => setRange("mes")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  range === "mes" ? "bg-[#3c63da] text-white" : "text-[#69778c] hover:bg-[#f4f7fb]"
                }`}
              >
                Mês Corrente
              </button>
              <button
                onClick={() => setRange("trimestre")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  range === "trimestre" ? "bg-[#3c63da] text-white" : "text-[#69778c] hover:bg-[#f4f7fb]"
                }`}
              >
                Trimestre (3M)
              </button>
              <button
                onClick={() => setRange("ano")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  range === "ano" ? "bg-[#3c63da] text-white" : "text-[#69778c] hover:bg-[#f4f7fb]"
                }`}
              >
                Ano (12M)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5eaf1] bg-white px-3 py-1.5 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5eaf1] bg-white px-3 py-1.5 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-[#69778c]" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
            </div>
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

          {/* DRE Detailed Table */}
          <div className="rounded-2xl border border-[#e5eaf1] bg-white shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#e5eaf1] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#152238]">
                  Demonstrativo Detalhado de Resultados
                </h3>
                <p className="text-[11px] text-[#69778c]">
                  Contas apuradas conforme os parâmetros vigentes da franquia.
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab("parametros")}
                className="text-xs font-bold text-[#3c63da] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ajustar Parâmetros</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8faff] border-b border-[#e5eaf1] text-[#69778c]">
                    <th className="py-3 px-4 font-bold uppercase text-[10px]">Conta Contábil</th>
                    <th className="py-3 px-4 font-bold uppercase text-[10px] text-right">Valor (R$)</th>
                    <th className="py-3 px-4 font-bold uppercase text-[10px] text-right">% Receita Líq.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5eaf1]">
                  <tr className="bg-white font-bold text-[#152238]">
                    <td className="py-3 px-4">(=) Receita Bruta / Faturamento</td>
                    <td className="py-3 px-4 text-right font-mono">{formatBrl2(dre.fatBruta)}</td>
                    <td className="py-3 px-4 text-right font-mono">100,00%</td>
                  </tr>
                  <tr className="text-[#b44b4b]">
                    <td className="py-2.5 px-4 pl-8">(-) Descontos Concedidos & Devoluções</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.desconto)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatPct2(dre.desconto / (dre.fatBruta || 1))}
                    </td>
                  </tr>
                  <tr className="text-[#b44b4b]">
                    <td className="py-2.5 px-4 pl-8">(-) Impostos sobre Vendas</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.impostos)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatPct2(dre.impostos / (dre.receitaAjustada || 1))}
                    </td>
                  </tr>
                  <tr className="bg-[#f8faff] font-bold text-[#152238]">
                    <td className="py-3 px-4">(=) Receita Operacional Líquida</td>
                    <td className="py-3 px-4 text-right font-mono text-[#3c63da]">{formatBrl2(dre.receitaLiquida)}</td>
                    <td className="py-3 px-4 text-right font-mono">100,00%</td>
                  </tr>
                  <tr className="text-[#b44b4b]">
                    <td className="py-2.5 px-4 pl-8">(-) Custo de Mercadorias Vendidas (CMV)</td>
                    <td className="py-2.5 px-4 text-right font-mono">-{formatBrl2(dre.cmv)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatPct2(dre.cmv / (dre.receitaLiquida || 1))}
                    </td>
                  </tr>
                  <tr className="text-[#b44b4b]">
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

          {/* Interactive Charts: Daily and Monthly Evolution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col">
              <h3 className="text-sm font-bold text-[#152238] mb-1">
                Evolução do Faturamento & Lucro Diário
              </h3>
              <p className="text-[11px] text-[#69778c] mb-4">
                Últimos 30 dias de operação com curva de lucratividade.
              </p>
              <div className="h-64 w-full flex-1 relative">
                <canvas ref={dailyCanvasRef} />
              </div>
            </div>

            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col">
              <h3 className="text-sm font-bold text-[#152238] mb-1">
                Sazonalidade Mensal (Faturamento x Lucro)
              </h3>
              <p className="text-[11px] text-[#69778c] mb-4">
                Demonstrativo comparativo dos últimos 12 meses.
              </p>
              <div className="h-64 w-full flex-1 relative">
                <canvas ref={monthlyCanvasRef} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. ABA: PARÂMETROS DO DRE UNIFICADOS */}
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
