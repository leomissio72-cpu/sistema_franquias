import React from "react";
import { FranchiseUnit, Business, ScreenType } from "../../types";
import { formatBrl, formatPct, calculateDre } from "../../utils/calculations";
import {
  Building2,
  MapPin,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Layers,
  Plus
} from "lucide-react";

interface NetworkScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onNavigate: (screen: ScreenType) => void;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
  onRefreshData?: () => void;
}

export const NetworkScreen: React.FC<NetworkScreenProps> = ({
  franchises,
  businesses,
  currentTenantId,
  onSelectTenant,
  onNavigate,
  dreParams,
  royalties,
  onRefreshData,
}) => {
  const visibleUnits = franchises.filter((f) => {
    if (currentTenantId === "dono" || currentTenantId === "equipe") return true;
    if (currentTenantId.startsWith("biz")) return f.businessId === currentTenantId;
    return f.id === currentTenantId;
  });

  const totalFat = visibleUnits.reduce((s, f) => s + f.faturamento, 0);
  let totalLucro = 0;
  visibleUnits.forEach((f) => {
    const p = dreParams[f.id] || dreParams["dono"];
    const roy = royalties[f.businessId];
    const calc = calculateDre(f.faturamento, p, roy);
    totalLucro += calc.lucroLiquido;
  });

  const margemConsolidada = totalFat ? totalLucro / totalFat : 0;
  const healthyCount = visibleUnits.filter((f) => f.status === "green").length;
  const warnCount = visibleUnits.filter((f) => f.status !== "green").length;
  const maxFat = Math.max(...visibleUnits.map((f) => f.faturamento), 1);
  const healthRate = visibleUnits.length ? Math.round((healthyCount / visibleUnits.length) * 100) : 0;

  const getBusinessBrand = (bizId: string) => {
    return businesses.find((b) => b.id === bizId)?.brand || bizId;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Franqueadora · Dados Consolidados em Tempo Real
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <Building2 className="h-6 w-6 text-[#3c63da]" />
            Rede e Unidades
          </h2>
          <p className="text-xs text-[#69778c] mt-1 max-w-2xl">
            Vários negócios, vários franqueados. A diretoria acompanha o ecossistema completo; cada rede e
            unidade opera no seu respectivo escopo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate("tenants")}
            className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] hover:bg-[#2f52c0] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Cadastrar Novo Franqueado</span>
          </button>
          <button
            onClick={() => onNavigate("map")}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] transition-all cursor-pointer"
          >
            <MapPin className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>Ver no Mapa</span>
          </button>
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className="flex items-center gap-1.5 rounded-lg border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] transition-all shadow-2xs cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Atualizar</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Unidades na Rede
          </span>
          <strong className="text-2xl font-extrabold text-[#152238] block mt-1">
            {visibleUnits.length}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            {visibleUnits.length} licenças ativas
          </small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Faturamento do Mês
          </span>
          <strong className="text-2xl font-extrabold text-[#152238] block mt-1">
            {formatBrl(totalFat)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Soma de todas as lojas
          </small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Lucro Líquido Consolidado
          </span>
          <strong className="text-2xl font-extrabold text-[#118464] block mt-1">
            {formatBrl(totalLucro)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Após impostos, CMV e taxas
          </small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Margem Líquida da Rede
          </span>
          <strong className="text-2xl font-extrabold text-[#3c63da] block mt-1">
            {formatPct(margemConsolidada)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Lucro líquido ÷ receita
          </small>
        </div>
      </div>

      {/* Progress Bars and Health Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#e5eaf1] mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#152238]">Faturamento x Lucro por Unidade</h3>
              <p className="text-[11px] text-[#69778c]">Comparativo de performance do mês corrente.</p>
            </div>
            <span className="rounded-full bg-[#edf2ff] px-2.5 py-1 text-xs font-bold text-[#3c63da]">
              {healthyCount} Saudáveis · {warnCount} em Atenção
            </span>
          </div>

          <div className="space-y-4">
            {visibleUnits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#cdd7e7] bg-[#fbfcff] p-8 text-center">
                <Building2 className="mx-auto h-8 w-8 text-[#9aa9bf]" />
                <p className="mt-3 text-sm font-bold text-[#334155]">Nenhuma unidade cadastrada</p>
                <p className="mt-1 text-xs text-[#69778c]">Esta página continua disponível. Cadastre uma unidade para ver os indicadores.</p>
              </div>
            ) : visibleUnits.map((f) => {
              const p = dreParams[f.id] || dreParams["dono"];
              const roy = royalties[f.businessId];
              const calc = calculateDre(f.faturamento, p, roy);
              const pctFat = (f.faturamento / maxFat) * 100;
              const pctLucro = (calc.lucroLiquido / maxFat) * 100;

              return (
                <div key={f.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#152238] flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          f.status === "green" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <b>{f.name}</b>
                      <span className="text-[10px] text-[#69778c]">· {f.code}</span>
                    </span>
                    <span className="font-mono text-xs">
                      {formatBrl(f.faturamento)}{" "}
                      <span className="text-[10px] text-[#69778c]">
                        ({formatPct(calc.margemLiquida)} margem)
                      </span>
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-[#eef2f8] overflow-hidden flex">
                    <div
                      style={{ width: `${pctFat}%` }}
                      className="h-full rounded-full bg-[#3c63da] transition-all"
                    />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#eef2f8] overflow-hidden flex">
                    <div
                      style={{ width: `${Math.max(0, pctLucro)}%` }}
                      className="h-full rounded-full bg-[#118464] transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Health and Alerts Box */}
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238]">Saúde da Rede & Alertas</h3>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-[#69778c]">Status Operacional:</span>
              <span className="text-emerald-700 font-bold">
                {healthRate}% Saudável
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#eef2f8] overflow-hidden flex">
              <div
                style={{ width: `${healthRate}%` }}
                className="h-full bg-[#118464]"
              />
              <div
                style={{ width: `${visibleUnits.length ? (warnCount / visibleUnits.length) * 100 : 0}%` }}
                className="h-full bg-[#a86a08]"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 text-xs divide-y divide-[#e5eaf1]">
            <div className="flex justify-between pt-2">
              <span className="text-[#69778c]">Unidades saudáveis</span>
              <b className="text-emerald-700">{healthyCount} unidades</b>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-[#69778c]">Unidades em atenção</span>
              <b className="text-amber-700">{warnCount} unidades</b>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-[#69778c]">Média de pendências</span>
              <b>
                {(
                  visibleUnits.reduce((s, f) => s + f.pendencias, 0) /
                  (visibleUnits.length || 1)
                ).toFixed(1)}
              </b>
            </div>
          </div>

          <div className="rounded-lg bg-[#f8faff] p-3 border border-[#e5eaf1] text-xs space-y-1">
            <span className="font-bold text-[#152238] block">Atalho Rápido:</span>
            <p className="text-[11px] text-[#69778c]">
              Clique em qualquer unidade para inspecionar os lançamentos e o DRE discriminado.
            </p>
          </div>
        </div>
      </div>

      {/* Franchise Cards Bento Grid */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold text-[#152238]">Todas as Unidades</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {visibleUnits.map((f) => {
            const p = dreParams[f.id] || dreParams["dono"];
            const roy = royalties[f.businessId];
            const calc = calculateDre(f.faturamento, p, roy);
            const isCurrent = currentTenantId === f.id;

            return (
              <div
                key={f.id}
                onClick={() => {
                  onSelectTenant(f.id);
                  onNavigate("dre");
                }}
                className={`rounded-xl border p-4.5 bg-white transition-all cursor-pointer hover:shadow-md ${
                  isCurrent
                    ? "border-[#3c63da] bg-[#f8faff] ring-2 ring-[#3c63da]/20"
                    : "border-[#e5eaf1] hover:border-[#3c63da]/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase bg-[#edf2ff] text-[#3c63da] px-2 py-0.5 rounded-full">
                      {getBusinessBrand(f.businessId)}
                    </span>
                    <h4 className="text-sm font-bold text-[#152238] mt-1.5">{f.name}</h4>
                    <p className="text-[10px] text-[#69778c]">
                      {f.code} · Resp: {f.resp}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      f.status === "green"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {f.status === "green" ? "Saudável" : "Atenção"}
                  </span>
                </div>

                <div className="mt-3.5">
                  <div className="text-xl font-extrabold text-[#152238]">
                    {formatBrl(f.faturamento)}
                  </div>
                  <div className="text-[11px] text-[#69778c] mt-0.5 flex items-center justify-between">
                    <span>Lucro: <b className="text-emerald-700">{formatBrl(calc.lucroLiquido)}</b></span>
                    <span>Margem: <b>{formatPct(calc.margemLiquida)}</b></span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#e5eaf1] flex items-center justify-between text-[10px] text-[#69778c]">
                  <span>{f.city} · {f.region}</span>
                  <span className="text-[#3c63da] font-bold flex items-center gap-0.5">
                    Ver DRE <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
