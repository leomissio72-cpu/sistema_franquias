import React, { useEffect, useRef, useState } from "react";
import { FranchiseUnit, Business, ScreenType, UserSession } from "../../types";
import { formatBrl, formatPct, calculateDre } from "../../utils/calculations";
import {
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Store,
  MapPin,
  LayoutGrid,
  Filter,
  Eye,
  ArrowUpDown,
  Search,
  Check,
  Percent,
  Calendar,
  Layers,
  Sparkles,
  Phone,
  Mail,
  X,
  ExternalLink,
  MessageSquare,
  BarChart3,
  SlidersHorizontal,
  Table as TableIcon,
  ArrowUpRight
} from "lucide-react";
import L from "leaflet";
import {
  DateMultiFilter,
  DateFilterSelection,
  AVAILABLE_DAYS,
  AVAILABLE_MONTHS,
  AVAILABLE_YEARS,
  CURRENT_YEAR,
  CURRENT_MONTH,
} from "../DateMultiFilter";

interface HomeScreenProps {
  currentTenantId: string;
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentBusinessId: string;
  onSelectTenant: (tenantId: string) => void;
  onSelectBusiness: (bizId: string) => void;
  userSession: UserSession | null;
  onNavigate: (screen: ScreenType) => void;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentTenantId,
  franchises,
  businesses,
  currentBusinessId,
  onSelectTenant,
  onSelectBusiness,
  userSession,
  onNavigate,
  dreParams,
  royalties,
}) => {
  // -------------------------------------------------------------
  // Filters: Data / Período (Ano, Mês, Dia), Negócio, Franqueado
  // -------------------------------------------------------------
  const [dateSelection, setDateSelection] = useState<DateFilterSelection>({
    years: [CURRENT_YEAR],
    months: [CURRENT_MONTH],
    days: AVAILABLE_DAYS,
  });
  const [selectedBusiness, setSelectedBusiness] = useState<string>(currentBusinessId || "all");
  const [selectedFranchiseFilter, setSelectedFranchiseFilter] = useState<string>("all");
  const [mapStatusFilter, setMapStatusFilter] = useState<"all" | "green" | "amber">("all");
  const [searchFranchiseQuery, setSearchFranchiseQuery] = useState<string>("");

  // Franqueados in-page Modal / Panel state
  const [isFranchiseesModalOpen, setIsFranchiseesModalOpen] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>("");
  const [modalBrandFilter, setModalBrandFilter] = useState<string>("all");
  const [modalStatusFilter, setModalStatusFilter] = useState<"all" | "green" | "yellow">("all");
  const [modalRevenueRange, setModalRevenueRange] = useState<"all" | "low" | "mid" | "high">("all");
  const [modalSort, setModalSort] = useState<"fat_desc" | "fat_asc" | "margin_desc" | "name_asc" | "city_asc">("fat_desc");
  const [modalViewMode, setModalViewMode] = useState<"cards" | "table">("cards");

  // Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const isOwner = userSession?.profile === "dono" || userSession?.profile === "equipe";
  const isAdmin = userSession?.profile === "admin";
  const isFranchisee = userSession?.profile === "franqueado" || userSession?.profile === "operador";

  // Dynamic date multiplier for calculations based on selected years, months and days
  const numYears = dateSelection.years.length;
  const numMonths = dateSelection.months.length;
  const numDays = dateSelection.days.length;
  const daysRatio = numDays / 31;
  const periodMultiplier = Math.max(0.032, numYears * numMonths * daysRatio);

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

  // Os filtros do cabeçalho e da barra lateral representam o mesmo escopo.
  // Sincronize os dois sentidos para que uma seleção feita no menu lateral
  // atualize imediatamente os indicadores e a lista da tela inicial.
  useEffect(() => {
    setSelectedBusiness(currentBusinessId || "all");
    const isKnownUnit = franchises.some((franchise) => franchise.id === currentTenantId);
    if (isKnownUnit) {
      setSelectedFranchiseFilter(currentTenantId);
    } else {
      setSelectedFranchiseFilter("all");
    }
  }, [currentBusinessId, currentTenantId, franchises]);

  // Regra fundamental: uma unidade não pode ver outra, a menos que pertença comprovadamente ao mesmo dono
  const isUnitOwnedByUser = (f: FranchiseUnit): boolean => {
    if (!userSession) return false;
    if (isOwner) return true;
    if (isAdmin) {
      if (userSession.tenant?.startsWith("biz")) return f.businessId === userSession.tenant;
      return true;
    }
    // Para franqueados: verifica tenant direto
    const allowedTenants = (userSession.tenant || "").split(",").map((t) => t.trim().toLowerCase());
    return allowedTenants.includes(f.id.toLowerCase());
  };

  // Available franchises given current brand selection and user permissions
  const availableFranchises = franchises.filter((f) => {
    if (isFranchisee && !isUnitOwnedByUser(f)) return false;
    if (isAdmin && userSession?.tenant?.startsWith("biz") && f.businessId !== userSession.tenant) return false;
    if (selectedBusiness === "all") return true;
    return f.businessId === selectedBusiness;
  });

  // Filter units according to the user's top filter controls
  const filteredUnits = franchises.filter((f) => {
    // 1. User ownership filter
    if (isFranchisee && !isUnitOwnedByUser(f)) return false;
    if (isAdmin && userSession?.tenant?.startsWith("biz") && f.businessId !== userSession.tenant) return false;
    // 2. Business filter
    if (selectedBusiness !== "all" && f.businessId !== selectedBusiness) return false;
    // 3. Franchise filter
    if (selectedFranchiseFilter !== "all" && f.id !== selectedFranchiseFilter) return false;
    return true;
  });
  const mappedFilteredUnits = filteredUnits.filter((f): f is FranchiseUnit & { lat: number; lng: number } => Number.isFinite(f.lat) && Number.isFinite(f.lng) && f.coordinatesVerified !== false);

  // Calculate totals for filtered scope
  const totalFat = filteredUnits.reduce((s, f) => s + f.faturamento * periodMultiplier, 0);
  let totalLucro = 0;
  filteredUnits.forEach((f) => {
    const params = dreParams[f.id] || dreParams["dono"];
    const roy = royalties[f.businessId];
    const calc = calculateDre(f.faturamento * periodMultiplier, params, roy);
    totalLucro += calc.lucroLiquido;
  });

  const margemConsolidada = totalFat > 0 ? totalLucro / totalFat : 0;
  const totalPendencias = filteredUnits.reduce((s, f) => s + f.pendencias, 0);
  const totalRp = filteredUnits.reduce((s, f) => s + f.rpDone, 0);
  const healthyCount = filteredUnits.filter((f) => f.status === "green").length;
  const warnCount = filteredUnits.filter((f) => f.status !== "green").length;
  const maxFat = Math.max(...filteredUnits.map((f) => f.faturamento * periodMultiplier), 1);

  // Active unit info
  const currentUnit = franchises.find((f) => f.id === currentTenantId);
  const currentBiz = businesses.find((b) => b.id === (currentUnit?.businessId || currentTenantId));

  const getGestaoTitle = () => {
    if (currentUnit?.name) return `Gestão: ${currentUnit.name}`;
    if (currentTenantId.startsWith("biz") && currentBiz) return `Gestão: Matriz ${currentBiz.brand || currentBiz.name}`;
    if (currentTenantId === "dono") return "Gestão: Rede Consolidada";
    return `Gestão: ${currentTenantId}`;
  };

  // Sync selected business filter
  const handleBusinessFilterChange = (bizId: string) => {
    setSelectedBusiness(bizId);
    onSelectBusiness(bizId);
    setSelectedFranchiseFilter("all");
    if (bizId === "all") {
      onSelectTenant("dono");
    } else {
      onSelectTenant(bizId);
    }
  };

  const handleFranchiseFilterChange = (val: string) => {
    setSelectedFranchiseFilter(val);
    if (val !== "all") {
      onSelectTenant(val);
    } else {
      onSelectTenant(selectedBusiness === "all" ? "dono" : selectedBusiness);
    }
  };

  // -------------------------------------------------------------
  // Leaflet Map Initialization & Reactive Update
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false, // Prevents mobile scroll trapping
        dragging: !L.Browser.mobile, // Responsive touch drag
        tapHold: true,
      }).setView([-15.5, -48.0], 4);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      // Re-enable touch drag for mobile nicely
      if (L.Browser.mobile) {
        map.dragging.enable();
      }

      const markersGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersGroupRef.current = markersGroup;
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;

    if (markersGroup) {
      markersGroup.clearLayers();

      const mapUnits = mappedFilteredUnits.filter((f) => {
        if (mapStatusFilter !== "all" && f.status !== mapStatusFilter) return false;
        return true;
      });

      mapUnits.forEach((f) => {
        const biz = businesses.find((b) => b.id === f.businessId);
        const pinColor = f.status === "green" ? "#118464" : "#a86a08";
        const calc = calculateDre(f.faturamento * periodMultiplier, dreParams[f.id] || dreParams["dono"], royalties[f.businessId]);

        const customIcon = L.divIcon({
          className: "",
          html: `<div style="background:${pinColor};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.3);display:grid;place-items:center;">
            <span style="transform:rotate(45deg);color:#fff;font-size:12px;font-weight:900;">📍</span>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([f.lat, f.lng], { icon: customIcon }).addTo(markersGroup);

        const popupDiv = document.createElement("div");
        popupDiv.className = "p-1 font-sans";
        popupDiv.innerHTML = `
          <div style="font-size:9px;font-weight:800;color:${biz?.color || "#3c63da"};margin-bottom:2px;">${biz?.name || ""}</div>
          <div style="font-weight:800;font-size:13px;color:#152238;">${f.name}</div>
          <div style="font-size:10px;color:#69778c;margin-bottom:6px;">${f.address}</div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>Faturamento:</span><b>${formatBrl(f.faturamento * periodMultiplier)}</b></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>Lucro:</span><b style="color:#118464">${formatBrl(calc.lucroLiquido)}</b></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;"><span>Margem:</span><b>${formatPct(calc.margemLiquida)}</b></div>
        `;

        const btn = document.createElement("button");
        btn.innerText = "Mudar Visão para Esta Unidade";
        btn.className = "w-full rounded-lg bg-[#3c63da] text-white py-1.5 text-xs font-bold hover:bg-[#2f52c0] cursor-pointer shadow-xs";
        btn.onclick = () => {
          onSelectTenant(f.id);
        };
        popupDiv.appendChild(btn);

        marker.bindPopup(popupDiv);
      });

      if (mapUnits.length > 0) {
        const bounds = L.latLngBounds(mapUnits.map((f) => [f.lat, f.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    }

    const timer = setTimeout(() => {
      map?.invalidateSize();
    }, 250);

    return () => clearTimeout(timer);
  }, [mappedFilteredUnits, mapStatusFilter, periodMultiplier, businesses, dreParams, royalties, onSelectTenant]);

  // Franchise units for modal with advanced multi-filter & sorting
  const modalFilteredFranchises = franchises
    .filter((f) => {
      // 0. Ownership check: unidade só pode ver as suas próprias lojas ou do mesmo dono
      if (isFranchisee && !isUnitOwnedByUser(f)) return false;
      if (isAdmin && userSession?.tenant?.startsWith("biz") && f.businessId !== userSession.tenant) return false;

      // 1. Text Search (safe null checks)
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase();
        const match =
          (f.name || "").toLowerCase().includes(q) ||
          (f.code || "").toLowerCase().includes(q) ||
          (f.city || "").toLowerCase().includes(q) ||
          (f.resp || "").toLowerCase().includes(q) ||
          (f.phone || "").toLowerCase().includes(q) ||
          (f.email || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Brand Filter
      if (modalBrandFilter !== "all" && f.businessId !== modalBrandFilter) return false;

      // 3. Health Status Filter
      if (modalStatusFilter !== "all" && f.status !== modalStatusFilter) return false;

      // 4. Revenue Range Filter
      const rev = f.faturamento * periodMultiplier;
      if (modalRevenueRange === "low" && rev >= 50000) return false;
      if (modalRevenueRange === "mid" && (rev < 50000 || rev > 80000)) return false;
      if (modalRevenueRange === "high" && rev <= 80000) return false;

      return true;
    })
    .sort((a, b) => {
      const revA = a.faturamento * periodMultiplier;
      const revB = b.faturamento * periodMultiplier;
      if (modalSort === "fat_desc") return revB - revA;
      if (modalSort === "fat_asc") return revA - revB;
      if (modalSort === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (modalSort === "city_asc") return (a.city || "").localeCompare(b.city || "");
      if (modalSort === "margin_desc") {
        const margA = calculateDre(revA, dreParams[a.id] || dreParams["dono"], royalties[a.businessId]).margemLiquida;
        const margB = calculateDre(revB, dreParams[b.id] || dreParams["dono"], royalties[b.businessId]).margemLiquida;
        return margB - margA;
      }
      return 0;
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR: FILTROS UNIFICADOS (DATA, NEGÓCIO, FRANQUEADO)     */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#edf2ff] text-[#3c63da] text-[11px] font-extrabold uppercase tracking-wide">
                <Building2 className="h-3 w-3" />
                {currentTenantId === "dono" ? "Rede Consolidada" : currentUnit?.name || currentTenantId}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#152238] tracking-tight">
              Gestão de Franquias
            </h1>
            <p className="text-xs text-[#69778c] mt-0.5">
              Acompanhamento da operação da rede em um só lugar.
            </p>
          </div>

          {/* Quick Button to open Franqueados Directory inside Home */}
          <button
            type="button"
            id="btn-open-franqueados-modal"
            onClick={() => setIsFranchiseesModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#cbd5e1] hover:border-[#3c63da] hover:text-[#3c63da] px-4 py-2.5 text-xs font-extrabold text-[#152238] transition-all shadow-2xs hover:shadow-xs cursor-pointer flex-shrink-0"
          >
            <Store className="h-4 w-4 text-[#3c63da]" />
            <span>{isFranchisee ? "Minha(s) Unidade(s)" : "Ver Franqueados & Unidades"}</span>
            <span className="rounded-full bg-[#3c63da] text-white px-2 py-0.5 text-[10px] font-bold">
              {isFranchisee ? filteredUnits.length : franchises.length}
            </span>
          </button>
        </div>

        {/* Filters Controls */}
        <div className="mt-4 pt-4 border-t border-[#e5eaf1] space-y-4">
          {/* Seletor Temporal Separado: Ano, Mês e Dia */}
          <DateMultiFilter selection={dateSelection} onChange={setDateSelection} />

          {/* Filtros Operacionais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#f1f5f9]">
            {/* Filter 1: Negócio / Marca */}
            <div>
              <label
                htmlFor="filter-business"
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#152238] mb-1.5"
              >
                <Building2 className="h-3.5 w-3.5 text-[#3c63da]" />
                <span>Rede / Marca</span>
              </label>
              <select
                id="filter-business"
                disabled={isFranchisee}
                value={selectedBusiness}
                onChange={(e) => handleBusinessFilterChange(e.target.value)}
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

            {/* Filter 2: Franqueado / Unidade */}
            <div>
              <label
                htmlFor="filter-franchisee"
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#152238] mb-1.5"
              >
                <Store className="h-3.5 w-3.5 text-[#3c63da]" />
                <span>Unidade / Franqueado</span>
              </label>
              <select
                id="filter-franchisee"
                disabled={isFranchisee}
                value={selectedFranchiseFilter}
                onChange={(e) => handleFranchiseFilterChange(e.target.value)}
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

          {/* Resumo do Período Ativo */}
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
                  years: [CURRENT_YEAR],
                  months: [CURRENT_MONTH],
                  days: AVAILABLE_DAYS,
                });
                handleBusinessFilterChange("all");
                handleFranchiseFilterChange("all");
              }}
              className="text-[11px] font-bold text-[#69778c] hover:text-[#3c63da] transition-colors cursor-pointer self-end sm:self-auto"
            >
              Redefinir Filtros Padrão
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. KPI METRICS CARDS                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Faturamento Filtrado
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#152238] block mt-1">
            {formatBrl(totalFat)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            {filteredUnits.length} unidade(s) no escopo
          </small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Lucro Líquido Apurado
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#118464] block mt-1">
            {formatBrl(totalLucro)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Margem Líquida: {formatPct(margemConsolidada)}
          </small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Pendências Operacionais
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#a86a08] block mt-1">
            {String(totalPendencias).padStart(2, "0")}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Conciliações a regularizar
          </small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Rotinas / RP em Dia
          </span>
          <strong className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#3c63da] block mt-1">
            {String(totalRp).padStart(2, "0")}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">
            Obrigações e pagamentos
          </small>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SEÇÃO DIRETA NA TELA: MAPA DAS UNIDADES                    */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#3c63da]" />
              <h2 className="text-base sm:text-lg font-extrabold text-[#152238]">
                Mapa das Unidades & Geolocalização
              </h2>
            </div>
            <p className="text-xs text-[#69778c] mt-0.5">
              Visualize cada franquia no mapa, inspecione a saúde operacional e mude a visão com 1 clique.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#f8faff] p-1 rounded-xl border border-[#e5eaf1] flex-shrink-0">
            <button
              onClick={() => setMapStatusFilter("all")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                mapStatusFilter === "all" ? "bg-[#3c63da] text-white" : "text-[#69778c] hover:text-[#152238]"
              }`}
            >
              Todas ({filteredUnits.length})
            </button>
            <button
              onClick={() => setMapStatusFilter("green")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                mapStatusFilter === "green" ? "bg-emerald-600 text-white" : "text-[#69778c] hover:text-emerald-700"
              }`}
            >
              Saudáveis ({healthyCount})
            </button>
            <button
              onClick={() => setMapStatusFilter("amber")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                mapStatusFilter === "amber" ? "bg-amber-600 text-white" : "text-[#69778c] hover:text-amber-700"
              }`}
            >
              Atenção ({warnCount})
            </button>
          </div>
        </div>

        {/* Leaflet Map Display */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-[#e5eaf1] overflow-hidden min-h-[380px] sm:min-h-[440px] relative z-0 isolate">
            <div ref={mapContainerRef} className="h-full w-full min-h-[380px] sm:min-h-[440px]" />
          </div>

          {/* Quick Unit Cards on the side of the Map */}
          <div className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] p-3 max-h-[440px] overflow-y-auto space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#e5eaf1]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                Unidades no Mapa ({mappedFilteredUnits.length})
              </span>
              <span className="text-[10px] text-[#3c63da] font-bold">Focar & Mudar Visão</span>
            </div>

            {filteredUnits.map((f) => {
              const isCurrent = currentTenantId === f.id;
              const p = dreParams[f.id] || dreParams["dono"];
              const roy = royalties[f.businessId];
              const calc = calculateDre(f.faturamento * periodMultiplier, p, roy);

              return (
                <div
                  key={f.id}
                  onClick={() => {
                    const lat = f.lat;
                    const lng = f.lng;
                    if (mapInstanceRef.current && typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && f.coordinatesVerified !== false) {
                      mapInstanceRef.current.setView([lat, lng], 14);
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-white border-[#3c63da] shadow-xs ring-2 ring-[#3c63da]/20"
                      : "bg-white border-[#e5eaf1] hover:border-[#3c63da]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#152238] truncate">{f.name}</span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                        f.status === "green" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                  </div>
                  <div className="text-[10px] text-[#69778c] truncate mt-0.5">
                    {f.city} · {f.code} · Resp: {f.resp}
                  </div>

                  <div className="mt-2 pt-2 border-t border-[#f0f4f9] flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#152238]">
                      {formatBrl(f.faturamento * periodMultiplier)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTenant(f.id);
                      }}
                      className="text-[10px] font-extrabold text-[#3c63da] hover:underline cursor-pointer"
                    >
                      {isCurrent ? "✓ Visão Ativa" : "Mudar Visão"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. SEÇÃO DIRETA NA TELA: REDE E COMPARATIVO DE UNIDADES        */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#3c63da]" />
              <h2 className="text-base sm:text-lg font-extrabold text-[#152238]">
                Rede & Comparativo de Unidades
              </h2>
            </div>
            <p className="text-xs text-[#69778c] mt-0.5">
              Ranking de faturamento, margem líquida e barras comparativas da operação.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#edf2ff] px-3 py-1 text-xs font-bold text-[#3c63da]">
              {healthyCount} Saudáveis · {warnCount} em Atenção
            </span>
          </div>
        </div>

        {/* Ranking Bars of Units */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            <div className="text-xs font-bold text-[#69778c] mb-2 flex justify-between">
              <span>Unidade / Responsável</span>
              <span>Faturamento x Lucro Líquido</span>
            </div>

            <div className="space-y-3">
              {filteredUnits.map((f) => {
                const p = dreParams[f.id] || dreParams["dono"];
                const roy = royalties[f.businessId];
                const calc = calculateDre(f.faturamento * periodMultiplier, p, roy);
                const pctFat = ((f.faturamento * periodMultiplier) / maxFat) * 100;
                const pctLucro = (calc.lucroLiquido / maxFat) * 100;
                const isCurrent = currentTenantId === f.id;

                return (
                  <div
                    key={f.id}
                    onClick={() => onSelectTenant(f.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-[#edf2ff] border-[#3c63da] shadow-xs"
                        : "bg-[#f8faff] border-[#e5eaf1] hover:border-[#3c63da]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="text-[#152238] flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            f.status === "green" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        <span>{f.name}</span>
                        <span className="text-[10px] text-[#69778c] font-mono">({f.code})</span>
                        {isCurrent && (
                          <span className="text-[9px] font-extrabold bg-[#3c63da] text-white px-1.5 py-0.2 rounded-full">
                            Visão Ativa
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs text-[#152238]">
                        {formatBrl(f.faturamento * periodMultiplier)}{" "}
                        <span className="text-[10px] text-emerald-700 font-bold">
                          ({formatPct(calc.margemLiquida)})
                        </span>
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-[#e5eaf1] overflow-hidden flex mb-1">
                      <div
                        style={{ width: `${pctFat}%` }}
                        className="h-full rounded-full bg-[#3c63da] transition-all"
                      />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#e5eaf1] overflow-hidden flex">
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

          {/* Network Health Summary Box */}
          <div className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] p-4.5 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#152238]">
              Saúde da Rede no Período
            </h4>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-[#69778c]">Índice Saudável:</span>
                <span className="text-emerald-700 font-extrabold">
                  {Math.round((healthyCount / (filteredUnits.length || 1)) * 100)}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#e5eaf1] overflow-hidden flex">
                <div
                  style={{ width: `${(healthyCount / (filteredUnits.length || 1)) * 100}%` }}
                  className="h-full bg-[#118464]"
                />
                <div
                  style={{ width: `${(warnCount / (filteredUnits.length || 1)) * 100}%` }}
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
                    filteredUnits.reduce((s, f) => s + f.pendencias, 0) /
                    (filteredUnits.length || 1)
                  ).toFixed(1)}
                </b>
              </div>
            </div>

            <button
              onClick={() => onNavigate("dre")}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#3c63da] py-2 text-xs font-bold text-white hover:bg-[#2f52c0] transition-all shadow-xs cursor-pointer"
            >
              <span>Abrir DRE Completo & Metas</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. IN-PAGE MODAL: GESTÃO & LISTA DE FRANQUEADOS COM FILTRO     */}
      {/* ------------------------------------------------------------- */}
      {isFranchiseesModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e5eaf1] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#e5eaf1] flex items-center justify-between bg-[#f8faff]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3c63da] text-white shadow-md">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold text-[#152238]">
                      Gestão & Diretório de Franqueados
                    </h3>
                    <span className="rounded-full bg-[#3c63da] text-white text-[11px] font-extrabold px-2.5 py-0.5">
                      {modalFilteredFranchises.length} de {franchises.length}
                    </span>
                  </div>
                  <p className="text-xs text-[#69778c]">
                    Indicadores em tempo real, DRE individual, contatos com WhatsApp e alternância imediata de visão da loja.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsFranchiseesModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-white border border-[#e5eaf1] flex items-center justify-center text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238] transition-all cursor-pointer"
                title="Fechar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Filters & Tools Bar */}
            <div className="p-4 border-b border-[#e5eaf1] bg-white space-y-3">
              {/* Row 1: Search & View Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#69778c]" />
                  <input
                    type="text"
                    placeholder="Pesquisar por franqueado, código, cidade, responsável, telefone..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full rounded-xl border border-[#e5eaf1] bg-[#f8faff] pl-9 pr-8 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                  {modalSearch && (
                    <button
                      onClick={() => setModalSearch("")}
                      className="absolute right-2.5 top-2.5 text-[#69778c] hover:text-[#152238]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 bg-[#f0f4f9] p-1 rounded-xl border border-[#e5eaf1] flex-shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setModalViewMode("cards")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modalViewMode === "cards"
                        ? "bg-white text-[#3c63da] shadow-xs"
                        : "text-[#69778c] hover:text-[#152238]"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Cards Detalhados</span>
                  </button>
                  <button
                    onClick={() => setModalViewMode("table")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modalViewMode === "table"
                        ? "bg-white text-[#3c63da] shadow-xs"
                        : "text-[#69778c] hover:text-[#152238]"
                    }`}
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    <span>Tabela Analítica</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Secondary Quick Filters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                {/* Brand filter */}
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">
                    Rede / Marca
                  </label>
                  <select
                    value={modalBrandFilter}
                    onChange={(e) => setModalBrandFilter(e.target.value)}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#152238] shadow-2xs focus:border-[#3c63da] focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todas as Redes</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Health Status */}
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">
                    Saúde Operacional
                  </label>
                  <select
                    value={modalStatusFilter}
                    onChange={(e) => setModalStatusFilter(e.target.value as any)}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#152238] shadow-2xs focus:border-[#3c63da] focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="green">🟢 Saudável</option>
                    <option value="yellow">🟡 Em Atenção</option>
                  </select>
                </div>

                {/* Revenue Range */}
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">
                    Faixa de Faturamento
                  </label>
                  <select
                    value={modalRevenueRange}
                    onChange={(e) => setModalRevenueRange(e.target.value as any)}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#152238] shadow-2xs focus:border-[#3c63da] focus:outline-none cursor-pointer"
                  >
                    <option value="all">Qualquer Faturamento</option>
                    <option value="high">Acima de R$ 80k/mês</option>
                    <option value="mid">Entre R$ 50k e R$ 80k</option>
                    <option value="low">Abaixo de R$ 50k/mês</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">
                    Ordenar Por
                  </label>
                  <select
                    value={modalSort}
                    onChange={(e) => setModalSort(e.target.value as any)}
                    className="w-full rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#152238] shadow-2xs focus:border-[#3c63da] focus:outline-none cursor-pointer"
                  >
                    <option value="fat_desc">Maior Faturamento</option>
                    <option value="fat_asc">Menor Faturamento</option>
                    <option value="margin_desc">Maior Margem % DRE</option>
                    <option value="name_asc">Nome da Loja (A-Z)</option>
                    <option value="city_asc">Cidade (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Body: Content Area */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
              {modalFilteredFranchises.length === 0 ? (
                <div className="py-12 text-center text-[#69778c] space-y-2">
                  <Store className="h-10 w-10 mx-auto text-[#a0aec0]" />
                  <div className="text-sm font-bold text-[#152238]">Nenhuma franquia encontrada</div>
                  <p className="text-xs">Tente ajustar os termos de pesquisa ou remover os filtros aplicados.</p>
                  <button
                    onClick={() => {
                      setModalSearch("");
                      setModalBrandFilter("all");
                      setModalStatusFilter("all");
                      setModalRevenueRange("all");
                    }}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-[#edf2ff] text-[#3c63da] text-xs font-bold hover:bg-[#3c63da] hover:text-white transition-all cursor-pointer"
                  >
                    Limpar Todos os Filtros
                  </button>
                </div>
              ) : modalViewMode === "cards" ? (
                /* Cards View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modalFilteredFranchises.map((f) => {
                    const biz = businesses.find((b) => b.id === f.businessId);
                    const isCurrent = currentTenantId === f.id;
                    const periodRev = f.faturamento * periodMultiplier;
                    const unitDre = calculateDre(periodRev, dreParams[f.id] || dreParams["dono"], royalties[f.businessId]);
                    const cleanPhone = (f.phone || "").replace(/\D/g, "");

                    return (
                      <div
                        key={f.id}
                        className={`rounded-2xl border p-4 bg-white transition-all flex flex-col justify-between shadow-xs ${
                          isCurrent
                            ? "border-[#3c63da] bg-[#f8faff] ring-2 ring-[#3c63da]/25 shadow-md"
                            : "border-[#e5eaf1] hover:border-[#3c63da] hover:shadow-sm"
                        }`}
                      >
                        <div>
                          {/* Card Top: Brand & Health Status */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-extrabold uppercase bg-[#edf2ff] text-[#3c63da] px-2 py-0.5 rounded-md border border-[#3c63da]/20 truncate">
                              {biz?.brand || f.businessId}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                f.status === "green"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  f.status === "green" ? "bg-emerald-500" : "bg-amber-500"
                                }`}
                              />
                              {f.status === "green" ? "Saudável" : "Atenção"}
                            </span>
                          </div>

                          {/* Unit Title */}
                          <h4 className="text-sm font-bold text-[#152238] mt-2.5 truncate" title={f.name}>
                            {f.name}
                          </h4>
                          <p className="text-[11px] text-[#69778c] flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-[#3c63da]" />
                            <span>{f.city}</span>
                            <span>·</span>
                            <span className="font-mono font-bold text-[#152238]">{f.code}</span>
                          </p>

                          {/* Financial Metrics Strip */}
                          <div className="mt-3 p-2.5 rounded-xl bg-[#f8f9fc] border border-[#e5eaf1] grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[9px] uppercase font-extrabold text-[#69778c] block">
                                Faturamento
                              </span>
                              <strong className="font-mono text-[13px] text-[#152238]">
                                {formatBrl(periodRev)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-extrabold text-[#69778c] block">
                                Lucro Líq. (DRE)
                              </span>
                              <strong
                                className={`font-mono text-[13px] ${
                                  unitDre.lucroLiquido >= 0 ? "text-emerald-700" : "text-red-600"
                                }`}
                              >
                                {formatBrl(unitDre.lucroLiquido)}
                              </strong>
                            </div>
                            <div className="col-span-2 pt-1.5 border-t border-[#e5eaf1] flex items-center justify-between text-[10px]">
                              <span className="text-[#69778c]">Margem Líquida:</span>
                              <span
                                className={`font-bold font-mono px-1.5 py-0.2 rounded ${
                                  unitDre.margemLiquida >= 0.15
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {formatPct(unitDre.margemLiquida)}
                              </span>
                            </div>
                          </div>

                          {/* Contact and Responsible */}
                          <div className="mt-3 pt-2.5 border-t border-[#e5eaf1] space-y-1 text-[11px] text-[#69778c]">
                            <div className="truncate">
                              Responsável: <strong className="text-[#152238]">{f.resp}</strong>
                            </div>
                            {f.phone && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="flex items-center gap-1 truncate text-[#48566a]">
                                  <Phone className="h-3 w-3 text-[#69778c] flex-shrink-0" />
                                  <span>{f.phone}</span>
                                </span>
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/55${cleanPhone}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-0.5 hover:underline"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    <span>WhatsApp</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {f.email && (
                              <div className="flex items-center gap-1 text-[10px] truncate text-[#48566a]">
                                <Mail className="h-3 w-3 text-[#69778c] flex-shrink-0" />
                                <a href={`mailto:${f.email}`} className="truncate hover:underline text-[#3c63da]">
                                  {f.email}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="mt-4 pt-3 border-t border-[#e5eaf1] space-y-2">
                          <button
                            onClick={() => {
                              onSelectTenant(f.id);
                              setIsFranchiseesModalOpen(false);
                            }}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isCurrent
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-[#3c63da] text-white hover:bg-[#2f52c0] shadow-xs"
                            }`}
                          >
                            {isCurrent ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Visão Ativa Neste Painel</span>
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                <span>Mudar Visão para Esta Loja</span>
                              </>
                            )}
                          </button>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => {
                                onSelectTenant(f.id);
                                setIsFranchiseesModalOpen(false);
                                onNavigate("dre");
                              }}
                              className="py-1.5 px-2 rounded-lg border border-[#e5eaf1] bg-[#f8faff] text-[10px] font-bold text-[#152238] hover:bg-[#edf2ff] hover:text-[#3c63da] hover:border-[#3c63da]/30 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <BarChart3 className="h-3 w-3 text-[#3c63da]" />
                              <span>Ver DRE</span>
                            </button>
                            <button
                              onClick={() => {
                                onSelectTenant(f.id);
                                setIsFranchiseesModalOpen(false);
                                onNavigate("lancamentos");
                              }}
                              className="py-1.5 px-2 rounded-lg border border-[#e5eaf1] bg-[#f8faff] text-[10px] font-bold text-[#152238] hover:bg-[#edf2ff] hover:text-[#3c63da] hover:border-[#3c63da]/30 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <Receipt className="h-3 w-3 text-[#3c63da]" />
                              <span>Lançamento</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="border border-[#e5eaf1] rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                          <th className="p-3">Unidade / Franquia</th>
                          <th className="p-3">Rede</th>
                          <th className="p-3">Cidade / UF</th>
                          <th className="p-3">Responsável & Contato</th>
                          <th className="p-3">Saúde</th>
                          <th className="p-3 text-right">Faturamento</th>
                          <th className="p-3 text-right">Lucro Líquido</th>
                          <th className="p-3 text-right">Margem</th>
                          <th className="p-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5eaf1]">
                        {modalFilteredFranchises.map((f) => {
                          const biz = businesses.find((b) => b.id === f.businessId);
                          const isCurrent = currentTenantId === f.id;
                          const periodRev = f.faturamento * periodMultiplier;
                          const unitDre = calculateDre(periodRev, dreParams[f.id] || dreParams["dono"], royalties[f.businessId]);

                          return (
                            <tr
                              key={f.id}
                              className={`hover:bg-[#f8faff] transition-colors ${
                                isCurrent ? "bg-[#edf2ff]/40 font-semibold" : ""
                              }`}
                            >
                              <td className="p-3">
                                <div className="font-bold text-[#152238]">{f.name}</div>
                                <span className="font-mono text-[10px] text-[#69778c]">{f.code}</span>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded bg-[#edf2ff] text-[#3c63da] text-[10px] font-bold">
                                  {biz?.brand || f.businessId}
                                </span>
                              </td>
                              <td className="p-3 text-[#48566a]">{f.city}</td>
                              <td className="p-3 text-[11px]">
                                <div className="font-bold text-[#152238]">{f.resp}</div>
                                <div className="text-[10px] text-[#69778c]">{f.phone || f.email}</div>
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    f.status === "green"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  {f.status === "green" ? "Saudável" : "Atenção"}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-[#152238]">
                                {formatBrl(periodRev)}
                              </td>
                              <td
                                className={`p-3 text-right font-mono font-bold ${
                                  unitDre.lucroLiquido >= 0 ? "text-emerald-700" : "text-red-600"
                                }`}
                              >
                                {formatBrl(unitDre.lucroLiquido)}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-[#48566a]">
                                {formatPct(unitDre.margemLiquida)}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      onSelectTenant(f.id);
                                      setIsFranchiseesModalOpen(false);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      isCurrent
                                        ? "bg-emerald-600 text-white"
                                        : "bg-[#3c63da] text-white hover:bg-[#2f52c0]"
                                    }`}
                                  >
                                    {isCurrent ? "✓ Ativo" : "Ver Loja"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      onSelectTenant(f.id);
                                      setIsFranchiseesModalOpen(false);
                                      onNavigate("dre");
                                    }}
                                    className="p-1 text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] rounded cursor-pointer"
                                    title="Abrir DRE"
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#f8faff] border-t border-[#e5eaf1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-[#69778c]">
                Mostrando <strong className="text-[#152238]">{modalFilteredFranchises.length}</strong> unidades. Todos os dados são sincronizados diretamente na nuvem.
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => setIsFranchiseesModalOpen(false)}
                  className="rounded-xl border border-[#e5eaf1] bg-white px-4 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
