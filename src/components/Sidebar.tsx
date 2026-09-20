import React from "react";
import {
  ScreenType,
  Business,
  FranchiseUnit,
  UserSession
} from "../types";
import {
  Home,
  LayoutGrid,
  TrendingUp,
  Percent,
  FilePenLine,
  ArrowLeftRight,
  FileSpreadsheet,
  Cog,
  FileBarChart,
  Users,
  KeyRound,
  Settings,
  CloudCog,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  CreditCard
  ,UploadCloud
} from "lucide-react";

interface SidebarProps {
  currentScreen: ScreenType;
  onSelectScreen: (screen: ScreenType) => void;
  businesses: Business[];
  franchises: FranchiseUnit[];
  currentBusinessId: string;
  currentTenantId: string;
  onSelectBusiness: (bizId: string) => void;
  onSelectTenant: (tenantId: string) => void;
  userSession: UserSession | null;
  permissions: Record<string, Record<string, boolean>>;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: ScreenType;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onSelectScreen,
  businesses,
  franchises,
  currentBusinessId,
  currentTenantId,
  onSelectBusiness,
  onSelectTenant,
  userSession,
  permissions,
  isOpenMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const userProfile = userSession?.profile || "franqueado";
  const userPerms = permissions[userProfile] || {};

  const isOwner = userProfile === "dono" || userProfile === "equipe";
  const isAdmin = userProfile === "admin";
  const isFranchisee = userProfile === "franqueado" || userProfile === "operador";

  const canAccessScreen = (screen: ScreenType): boolean => {
    // Unidades franqueadas têm acesso estritamente a Início, Analítico, Lançamentos e Taxas (consulta)
    if (isFranchisee) {
      return ["home", "dashboard", "fees", "pagamentos_despesas", "lancamentos", "import_base"].includes(screen);
    }
    if (screen === "home") return true;
    if (userProfile === "dono" || userProfile === "equipe") return true;
    if (screen === "configuracao") {
      return userProfile === "admin";
    }
    if (screen === "pagamentos_despesas") {
      return (
        userPerms.pagamentos_despesas !== false &&
        (userPerms.lancamentos !== false ||
          userPerms.rp !== false ||
          userPerms.vt !== false ||
          userPerms.conciliation !== false)
      );
    }
    return userPerms[screen] !== false;
  };

  // Filtered franchise list according to business context and user permissions
  // Uma unidade não pode ver outra, a menos que pertença comprovadamente ao mesmo dono
  const availableFranchises = franchises.filter((f) => {
    if (isFranchisee) {
      const allowedTenants = (userSession?.tenant || "").split(",").map((t) => t.trim().toLowerCase());
      if (allowedTenants.includes(f.id.toLowerCase())) return true;
      if (userSession?.name && f.resp && f.resp.toLowerCase().trim() === userSession.name.toLowerCase().trim()) {
        return true;
      }
      return false;
    }
    if (isAdmin) {
      const allowedBiz = userSession?.tenant.startsWith("biz") ? userSession.tenant : null;
      if (allowedBiz) return f.businessId === allowedBiz;
    }
    if (currentBusinessId === "all") return true;
    return f.businessId === currentBusinessId;
  });

  const activeFranchise = franchises.find((f) => f.id === currentTenantId);
  const activeBiz = businesses.find((b) => b.id === (activeFranchise?.businessId || currentTenantId));

  const getGestaoTitle = () => {
    if (activeFranchise?.name) return `Gestão: ${activeFranchise.name}`;
    if (currentTenantId.startsWith("biz") && activeBiz) return `Gestão: Matriz ${activeBiz.brand || activeBiz.name}`;
    if (currentTenantId === "dono") return "Gestão: Rede Consolidada";
    return `Gestão: ${currentTenantId}`;
  };

  // 1. Principal: Início & Analítico (Disponível para todos os perfis)
  const principalNav: NavItem[] = [
    { id: "home", label: "Início", icon: <Home className="h-4 w-4" /> },
    { id: "dashboard", label: "Analítico", icon: <TrendingUp className="h-4 w-4 text-sky-400" /> },
  ];

  // 2. Financeiro & Pagamentos / Lançamentos
  // Taxas e Recebimentos visível para unidades (modo consulta) e donos (edição)
  const financialNav: NavItem[] = isFranchisee
    ? [
        { id: "import_base", label: "Upload de bases", icon: <UploadCloud className="h-4 w-4" /> },
        { id: "pagamentos_despesas", label: "Lançamentos", icon: <CreditCard className="h-4 w-4 text-emerald-400" /> },
        { id: "fees", label: "Taxas e Recebimentos", icon: <Percent className="h-4 w-4 text-sky-400" /> },
      ]
    : [
        { id: "import_base", label: "Upload de bases", icon: <UploadCloud className="h-4 w-4" /> },
        { id: "dre", label: "DRE e Resultados", icon: <TrendingUp className="h-4 w-4" /> },
        { id: "pagamentos_despesas", label: "Pagamentos/Despesas", icon: <CreditCard className="h-4 w-4 text-emerald-400" /> },
        { id: "fees", label: "Taxas e Recebimentos", icon: <Percent className="h-4 w-4" /> },
      ];

  // 3. Gestão & Sistema (Relatórios de gestão removidos conforme solicitado)
  const managementNav: NavItem[] = isFranchisee
    ? []
    : [
        { id: "configuracao", label: "Configurações & Preferências", icon: <CloudCog className="h-4 w-4 text-amber-400" /> },
        { id: "employees", label: "Funcionários", icon: <Users className="h-4 w-4" /> },
        { id: "users", label: "Acessos e Logins", icon: <KeyRound className="h-4 w-4" /> },
      ];

  const handleNavClick = (screen: ScreenType) => {
    onSelectScreen(screen);
    if (isOpenMobile) {
      onCloseMobile();
    }
  };

  const renderNavGroup = (title: string, items: NavItem[]) => {
    const visibleItems = items.filter((item) => canAccessScreen(item.id));
    if (visibleItems.length === 0) return null;

    return (
      <div className="mb-3">
        {!isCollapsed && (
          <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-[#7185a5] mb-1.5 truncate">
            {title}
          </div>
        )}
        <nav className="flex flex-col gap-0.5">
          {visibleItems.map((item) => {
            const isActive =
              currentScreen === item.id ||
              (item.id === "pagamentos_despesas" &&
                ["pagamentos_despesas", "lancamentos", "conciliation", "vt", "rp"].includes(currentScreen));
            const isSpecialConfig = item.id === "configuracao";
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`flex w-full items-center rounded-lg transition-all text-left group ${
                  isCollapsed
                    ? "justify-center p-2.5"
                    : "gap-2.5 px-3 py-2 text-xs font-semibold"
                } ${
                  isActive
                    ? "bg-[#2563eb] text-white shadow-sm font-bold"
                    : item.id === "import_base"
                    ? "bg-[#eff6ff] text-[#1d4ed8] font-bold border border-[#bfdbfe] hover:bg-[#dbeafe]"
                    : isSpecialConfig
                    ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                    : "text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                }`}
              >
                <span
                  className={`flex-shrink-0 ${
                    isActive
                      ? "text-white"
                      : item.id === "import_base"
                      ? "text-[#2563eb]"
                      : isSpecialConfig
                      ? "text-amber-400"
                      : "text-[#64748b] group-hover:text-[#2563eb]"
                  }`}
                >
                  {item.icon}
                </span>
                {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                {!isCollapsed && isSpecialConfig && (
                  <span className="text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                    Nuvem
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#f8fafc] text-[#334155] p-4 overflow-y-auto overflow-x-hidden border-r border-[#e2e8f0]">
      {/* Brand Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0]">
        {!isCollapsed ? (
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-[#0f172a] flex items-center gap-1.5">
              <span>Gestão de Franquias</span>
            </h1>
            <p className="text-[10px] text-[#64748b] mt-0.5 truncate">
              Gestão Financeira & Nuvem
            </p>
          </div>
        ) : (
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563eb] font-extrabold text-white text-xs shadow-md">
            GF
          </div>
        )}

        {/* Toggle Collapse Button Desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-[#e2e8f0] text-[#64748b] hover:bg-[#eff6ff] hover:text-[#2563eb] transition-colors cursor-pointer"
          title={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        {isOpenMobile && (
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-[#e2e8f0] text-[#64748b] hover:bg-[#eff6ff] lg:hidden cursor-pointer"
            aria-label="Fechar Menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Franchise & Tenant Highlight Box - Visão Aprimorada */}
      {!isCollapsed ? (
        <div className="my-4 rounded-2xl bg-white border border-[#e2e8f0] p-3 shadow-sm">
          {/* Card de Painel Ativo */}
          <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-[#dbeafe]">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#2563eb] flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Painel Ativo
              </span>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                Nuvem OK
              </span>
            </div>
            <div className="text-[#0f172a] text-xs font-extrabold truncate">
              {getGestaoTitle()}
            </div>
            {activeFranchise && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] font-mono font-bold bg-[#1b2f4f] text-[#a0c0f8] px-1.5 py-0.5 rounded border border-[#304d7c]">
                  {activeFranchise.code}
                </span>
                <span className="text-[10px] text-[#93a6c2] truncate">
                  📍 {activeFranchise.city}{activeFranchise.state ? `/${activeFranchise.state}` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Seletor de Rede/Negócio para Administrador/Dono */}
          {!isFranchisee && (
            <div className="mt-2.5">
              <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#8ea1be] mb-1">
                Negócio / Rede
              </label>
              <select
                id="select-business-context"
                disabled={isAdmin}
                value={currentBusinessId}
                onChange={(e) => onSelectBusiness(e.target.value)}
                className="w-full rounded-lg bg-white border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-[#2563eb] disabled:opacity-75 truncate"
              >
                {isOwner && (
                  <option value="all">🌐 Todos os Negócios (Consolidado)</option>
                )}
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    🏢 {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seletor de Franquia / Unidade Conectada */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#8ea1be]">
                {isFranchisee ? "Franquia Conectada" : "Alternar Unidade"}
              </label>
              {isFranchisee && (
                <span className="text-[9px] font-semibold text-[#8ea1be]">
                  {availableFranchises.length > 1 ? `${availableFranchises.length} lojas` : "Loja Própria"}
                </span>
              )}
            </div>

            {isFranchisee && availableFranchises.length <= 1 ? (
              <div className="flex items-center justify-between rounded-lg bg-white border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-semibold text-[#0f172a]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[#3c63da]">📍</span>
                  <span className="truncate">{activeFranchise?.name || "Minha Unidade"}</span>
                </div>
                <span className="text-[9px] font-mono font-bold bg-[#1b2f4f] text-[#7ba4ff] px-1.5 py-0.5 rounded border border-[#304d7c]">
                  {activeFranchise?.code || "UNIDADE"}
                </span>
              </div>
            ) : (
              <select
                id="select-tenant-context"
                value={currentTenantId}
                onChange={(e) => onSelectTenant(e.target.value)}
                className="w-full rounded-lg bg-white border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-[#2563eb] cursor-pointer truncate"
              >
                {isOwner && currentBusinessId === "all" && (
                  <option value="dono">👑 Visão do Dono (Todas as Redes)</option>
                )}
                {businesses
                  .filter((b) => currentBusinessId === "all" || b.id === currentBusinessId)
                  .map((b) => (
                    <option key={`matriz_${b.id}`} value={b.id}>
                      🏢 Matriz {b?.brand || b?.name || b?.id}
                    </option>
                  ))}
                {availableFranchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    📍 {f?.name || f?.code} ({f?.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      ) : (
        <div className="my-2 flex flex-col items-center gap-1.5 py-2 border-b border-[#304566]/60">
          <button
            onClick={() => onSelectScreen("home")}
            title={getGestaoTitle()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1b2d4b] text-[#3c63da] border border-[#3c63da]/30 hover:bg-[#273b60]"
          >
            <Store className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Nav Groups */}
      <div className="flex-1 space-y-1 mt-1">
        {renderNavGroup("Principal", principalNav)}
        {renderNavGroup("Financeiro & Despesas", financialNav)}
        {renderNavGroup("Gestão & Sistema", managementNav)}
      </div>

      {/* Collapse Toggle at Bottom */}
      <div className="mt-auto pt-2 border-t border-[#304566]">
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex w-full items-center justify-center gap-2 rounded-lg bg-[#1b2d4b]/60 px-2 py-1.5 text-[11px] font-semibold text-[#8ea1be] hover:bg-[#1b2d4b] hover:text-white transition-colors cursor-pointer"
          title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Recolher Menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Collapsible Fixed) */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-40 transition-all duration-300 ease-in-out ${
          isCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-[#10192c]">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
