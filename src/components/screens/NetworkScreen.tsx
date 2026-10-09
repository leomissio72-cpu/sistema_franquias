import React, { useEffect, useRef, useState } from "react";
import { FranchiseUnit, Business, ScreenType, ManualEntry } from "../../types";
import { formatBrl, formatPct, calculateDre, getUnitRealFinancials } from "../../utils/calculations";
import {
  Building2,
  MapPin,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Layers,
  Plus,
  Eye,
  Check
} from "lucide-react";
import L from "leaflet";

interface NetworkScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onNavigate: (screen: ScreenType) => void;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
  onRefreshData?: () => void;
  initialFocus?: "map" | "overview";
  manualEntries?: ManualEntry[];
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
  initialFocus = "overview",
  manualEntries = [],
}) => {
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [mapFilter, setMapFilter] = useState<"all" | "green" | "amber">("all");
  const [selectedPinUnitId, setSelectedPinUnitId] = useState<string | null>(null);

  const visibleUnits = franchises.filter((f) => {
    if (currentTenantId === "dono" || currentTenantId === "equipe") return true;
    if (currentTenantId.startsWith("biz")) return f.businessId === currentTenantId;
    return f.id === currentTenantId;
  });

  const filteredMapUnits = visibleUnits.filter((f) => {
    if (mapFilter === "all") return true;
    return f.status === mapFilter;
  });

  const mappedUnits = filteredMapUnits.filter(
    (unit): unit is FranchiseUnit & { lat: number; lng: number } =>
      Number.isFinite(unit.lat) && Number.isFinite(unit.lng) && unit.coordinatesVerified !== false
  );

  const getUnitEffectiveRev = (f: FranchiseUnit): number => {
    const unitFin = getUnitRealFinancials(f.id, manualEntries);
    return unitFin.count > 0 ? unitFin.faturamento : f.faturamento;
  };

  const totalFat = visibleUnits.reduce((s, f) => s + getUnitEffectiveRev(f), 0);
  let totalLucro = 0;
  visibleUnits.forEach((f) => {
    const rev = getUnitEffectiveRev(f);
    const p = dreParams[f.id] || dreParams["dono"];
    const roy = royalties[f.businessId];
    const calc = calculateDre(rev, p, roy);
    totalLucro += calc.lucroLiquido;
  });

  const margemConsolidada = totalFat ? totalLucro / totalFat : 0;
  const healthyCount = visibleUnits.filter((f) => f.status === "green").length;
  const warnCount = visibleUnits.filter((f) => f.status !== "green").length;
  const maxFat = Math.max(...visibleUnits.map((f) => getUnitEffectiveRev(f)), 1);
  const healthRate = visibleUnits.length ? Math.round((healthyCount / visibleUnits.length) * 100) : 0;
  const citiesCount = new Set(mappedUnits.map((f) => f.city)).size;

  const getBusinessBrand = (bizId: string) => {
    return businesses.find((b) => b.id === bizId)?.brand || bizId;
  };

  useEffect(() => {
    if (initialFocus === "map" && mapSectionRef.current) {
      setTimeout(() => {
        mapSectionRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [initialFocus]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([-15.5, -48.0], 4);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersGroupRef.current = markersGroup;
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;

    if (markersGroup) {
      markersGroup.clearLayers();

      const markers: L.Marker[] = [];

      mappedUnits.forEach((f) => {
        const biz = businesses.find((b) => b.id === f.businessId);
        const pinColor = f.status === "green" ? "#118464" : "#a86a08";
        const unitRev = getUnitEffectiveRev(f);
        const calc = calculateDre(unitRev, dreParams[f.id] || dreParams["dono"], royalties[f.businessId]);

        const customIcon = L.divIcon({
          className: "",
          html: `<div style="background:${pinColor};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:grid;place-items:center;">
            <span style="transform:rotate(45deg);color:#fff;font-size:12px;font-weight:900;">📍</span>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([f.lat, f.lng], { icon: customIcon }).addTo(markersGroup);

        const popupContent = document.createElement("div");
        popupContent.className = "p-1 font-sans";
        popupContent.innerHTML = `
          <div style="font-size:9px;font-weight:800;color:${biz?.color || "#3c63da"};margin-bottom:2px;">${biz?.name || ""}</div>
          <div style="font-weight:800;font-size:13px;color:#152238;">${f.name}</div>
          <div style="font-size:10px;color:#69778c;margin-bottom:8px;line-height:1.4;">${f.address}</div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;"><span>Faturamento:</span><b>${formatBrl(f.faturamento)}</b></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;"><span>Lucro Líquido:</span><b style="color:#118464">${formatBrl(calc.lucroLiquido)}</b></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px;"><span>Margem:</span><b>${formatPct(calc.margemLiquida)}</b></div>
        `;

        const btn = document.createElement("button");
        btn.innerText = "Ver DRE da Unidade";
        btn.className = "w-full rounded bg-[#3c63da] text-white py-1.5 text-xs font-bold hover:bg-[#2f52c0] cursor-pointer";
        btn.onclick = () => {
          onSelectTenant(f.id);
          onNavigate("dre");
        };
        popupContent.appendChild(btn);

        marker.bindPopup(popupContent);
        markers.push(marker);
      });

      if (mappedUnits.length > 0) {
        const bounds = L.latLngBounds(mappedUnits.map((f) => [f.lat, f.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    }

    setTimeout(() => {
      map?.invalidateSize();
    }, 200);
  }, [mappedUnits, businesses, dreParams, royalties]);

  const scrollToMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth" });
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
            onClick={scrollToMap}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] transition-all cursor-pointer shadow-2xs"
          >
            <MapPin className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>Ver Mapa na Página</span>
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

      {/* ------------------------------------------------------------- */}
      {/* MAPA DAS UNIDADES & REDE INTEGRADOS NA MESMA PÁGINA           */}
      {/* ------------------------------------------------------------- */}
      <div ref={mapSectionRef} className="rounded-2xl border border-[#e5eaf1] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#3c63da]/10 text-[#3c63da] flex items-center justify-center">
                <MapPin className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-extrabold text-[#152238]">
                Mapa Georreferenciado das Unidades (Presença Nacional)
              </h3>
              <span className="text-[11px] font-bold text-[#3c63da] bg-[#3c63da]/10 px-2 py-0.5 rounded-full">
                {mappedUnits.length} geolocalizadas · {citiesCount} cidades
              </span>
            </div>
            <p className="text-xs text-[#69778c] mt-1">
              Visualize a distribuição geográfica de todas as unidades da franquia no mapa interativo em tempo real. Clique nos pins para abrir indicadores e DRE.
            </p>
          </div>

          {/* Filtros do Mapa */}
          <div className="flex items-center gap-1.5 bg-[#f8fafc] p-1 rounded-xl border border-[#e5eaf1] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMapFilter("all")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mapFilter === "all" ? "bg-[#3c63da] text-white shadow-xs" : "text-[#69778c] hover:text-[#152238]"
              }`}
            >
              Todas ({visibleUnits.length})
            </button>
            <button
              type="button"
              onClick={() => setMapFilter("green")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                mapFilter === "green" ? "bg-emerald-600 text-white shadow-xs" : "text-[#69778c] hover:text-[#152238]"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Saudáveis ({healthyCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setMapFilter("amber")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                mapFilter === "amber" ? "bg-amber-600 text-white shadow-xs" : "text-[#69778c] hover:text-[#152238]"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Atenção ({warnCount})</span>
            </button>
          </div>
        </div>

        {/* Container do Mapa Leaflet */}
        <div className="relative w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden border border-[#dbe4ef] shadow-inner bg-[#f1f5f9]">
          <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: "360px" }} />
          {mappedUnits.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-2xs p-4 text-center">
              <div>
                <MapPin className="h-8 w-8 text-[#9aa9bf] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#152238]">Nenhuma unidade com coordenadas geográficas nesta seleção.</p>
                <p className="text-[11px] text-[#69778c] mt-0.5">Cadastre ou edite as franquias informando endereço ou latitude/longitude.</p>
              </div>
            </div>
          )}
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
              const unitRev = getUnitEffectiveRev(f);
              const calc = calculateDre(unitRev, p, roy);
              const pctFat = (unitRev / maxFat) * 100;
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
                      {formatBrl(unitRev)}{" "}
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
