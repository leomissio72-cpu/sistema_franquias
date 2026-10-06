import React, { useEffect, useRef, useState } from "react";
import { FranchiseUnit, Business, ScreenType } from "../../types";
import { formatBrl, formatPct, calculateDre } from "../../utils/calculations";
import { MapPin, ArrowRight, Layers, Eye } from "lucide-react";
import L from "leaflet";

interface MapScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onNavigate: (screen: ScreenType) => void;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  franchises,
  businesses,
  currentTenantId,
  onSelectTenant,
  onNavigate,
  dreParams,
  royalties,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [filter, setFilter] = useState<"all" | "green" | "amber">("all");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const visibleUnits = franchises.filter((f) => {
    if (filter === "all") return true;
    return f.status === filter;
  });
  const mappedUnits = visibleUnits.filter((unit): unit is FranchiseUnit & { lat: number; lng: number } => Number.isFinite(unit.lat) && Number.isFinite(unit.lng) && unit.coordinatesVerified !== false);

  const totalFat = visibleUnits.reduce((s, f) => s + f.faturamento, 0);
  const citiesCount = new Set(mappedUnits.map((f) => f.city)).size;
  const healthRate = franchises.length ? Math.round((franchises.filter((f) => f.status === "green").length / franchises.length) * 100) : 0;

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
        const calc = calculateDre(f.faturamento, dreParams[f.id] || dreParams["dono"], royalties[f.businessId]);

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
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;"><span>Lucro:</span><b style="color:#118464">${formatBrl(calc.lucroLiquido)}</b></div>
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
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    }

    setTimeout(() => {
      map?.invalidateSize();
    }, 150);
  }, [mappedUnits, businesses, dreParams, royalties]);

  const handleFocusUnit = (unit: FranchiseUnit) => {
    setSelectedUnitId(unit.id);
    const lat = unit.lat;
    const lng = unit.lng;
    if (!mapInstanceRef.current || typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || unit.coordinatesVerified === false) return;
    mapInstanceRef.current.setView([lat, lng], 15);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Distribuição Geográfica da Rede
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <MapPin className="h-6 w-6 text-[#3c63da]" />
            Mapa das Unidades
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Visualize cada franquia pela sua localização geográfica real. Clique em um pino para conferir o resumo financeiro.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#e5eaf1]">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filter === "all" ? "bg-[#3c63da] text-white" : "text-[#69778c] hover:text-[#152238]"
            }`}
          >
            Todas ({franchises.length})
          </button>
          <button
            onClick={() => setFilter("green")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filter === "green" ? "bg-emerald-600 text-white" : "text-[#69778c] hover:text-emerald-700"
            }`}
          >
            Saudáveis
          </button>
          <button
            onClick={() => setFilter("amber")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filter === "amber" ? "bg-amber-600 text-white" : "text-[#69778c] hover:text-amber-700"
            }`}
          >
            Atenção
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Unidades no Mapa
          </span>
          <strong className="text-2xl font-extrabold text-[#152238] block mt-1">
            {mappedUnits.length}
          </strong>
            <small className="text-[11px] text-[#69778c] block mt-0.5">Com endereço confirmado</small>
        </div>
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Cidades Cobertas
          </span>
          <strong className="text-2xl font-extrabold text-[#3c63da] block mt-1">
            {citiesCount}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Polos e capitais</small>
        </div>
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Faturamento da Região
          </span>
          <strong className="text-2xl font-extrabold text-[#152238] block mt-1">
            {formatBrl(totalFat)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Soma das unidades visíveis</small>
        </div>
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Saúde Consolidada
          </span>
          <strong className="text-2xl font-extrabold text-[#118464] block mt-1">
            {healthRate}%
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Operação em conformidade</small>
        </div>
      </div>

      {/* Map + Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border border-[#e5eaf1] bg-white overflow-hidden shadow-xs relative">
          <div ref={mapContainerRef} className="h-[440px] sm:h-[520px] w-full z-10" />
        </div>

        {/* Units Side List */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs max-h-[520px] overflow-y-auto space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#69778c] mb-2">
              Unidades Encontradas ({visibleUnits.length})
            </h3>
            {visibleUnits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#cdd7e7] bg-[#fbfcff] p-6 text-center">
                <MapPin className="mx-auto h-8 w-8 text-[#9aa9bf]" />
                <p className="mt-3 text-sm font-bold text-[#334155]">Nenhuma unidade para exibir</p>
                <p className="mt-1 text-xs text-[#69778c]">O mapa está pronto. Quando houver unidades, elas aparecerão aqui automaticamente.</p>
              </div>
            ) : visibleUnits.map((f) => {
              const isSelected = selectedUnitId === f.id;
              const hasMapLocation = Number.isFinite(f.lat) && Number.isFinite(f.lng) && f.coordinatesVerified !== false;
              return (
                <div
                  key={f.id}
                  onClick={() => handleFocusUnit(f)}
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-[#3c63da] bg-[#edf2ff]"
                      : "border-[#e5eaf1] hover:border-[#3c63da] hover:bg-[#f8faff]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#152238]">{f.name}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        f.status === "green" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                  </div>
                  <p className="text-[10px] text-[#69778c] mt-0.5 truncate">{f.address}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-[#152238]">{formatBrl(f.faturamento)}</span>
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${hasMapLocation ? "text-[#3c63da]" : "text-[#b44b4b]"}`}>
                      {hasMapLocation ? <>Focar no mapa <Eye className="h-3 w-3" /></> : "Endereço sem geolocalização"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
