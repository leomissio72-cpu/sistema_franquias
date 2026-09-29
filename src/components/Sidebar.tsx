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
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  CreditCard,
  UploadCloud,
  PackageCheck,
  Building2,
  MapPin,
  SlidersHorizontal
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
      return ["home", "dashboard", "fees", "pagamentos_despesas", "lancamentos", "import_base", "produtos", "employees", "users"].includes(screen);
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
        { id: "pagamentos_despesas", label: "Lançamentos", icon: <CreditCard className="h-4 w-4 text-emerald-400" /> },
        { id: "fees", label: "Taxas e Recebimentos", icon: <Percent className="h-4 w-4 text-sky-400" /> },
      ]
    : [
        { id: "dre", label: "DRE e Resultados", icon: <TrendingUp className="h-4 w-4" /> },
        { id: "pagamentos_despesas", label: "Pagamentos/Despesas", icon: <CreditCard className="h-4 w-4 text-emerald-400" /> },
        { id: "fees", label: "Taxas e Recebimentos", icon: <Percent className="h-4 w-4" /> },
      ];

  // 3. Gestão & Sistema (Relatórios de gestão removidos conforme solicitado)
  const managementNav: NavItem[] = isFranchisee
    ? [
        { id: "employees", label: "Funcionários", icon: <Users className="h-4 w-4" /> },
        { id: "users", label: "Acessos e Logins", icon: <KeyRound className="h-4 w-4" /> },
      ]
    : [
        { id: "configuracao", label: "Configurações", icon: <Settings className="h-4 w-4" /> },
        { id: "employees", label: "Funcionários", icon: <Users className="h-4 w-4" /> },
        { id: "users", label: "Acessos e Logins", icon: <KeyRound className="h-4 w-4" /> },
      ];

  // Todas as áreas continuam visíveis para o dono/equipe mesmo quando o banco está vazio.
  const networkNav: NavItem[] = [
    { id: "network", label: "Rede e Unidades", icon: <Building2 className="h-4 w-4" /> },
    { id: "map", label: "Mapa das Unidades", icon: <MapPin className="h-4 w-4" /> },
    { id: "reports", label: "Relatórios", icon: <FileBarChart className="h-4 w-4" /> },
    { id: "permissoes", label: "Permissões e Royalties", icon: <KeyRound className="h-4 w-4" /> },
    { id: "tenants", label: "Cadastro de Franqueados", icon: <Store className="h-4 w-4" /> },
  ];

  const operationsNav: NavItem[] = [
    { id: "dreparams", label: "Parâmetros do DRE", icon: <SlidersHorizontal className="h-4 w-4" /> },
    { id: "lancamentos", label: "Lançamentos Manuais", icon: <FilePenLine className="h-4 w-4" /> },
    { id: "conciliation", label: "Conciliação Bancária", icon: <ArrowLeftRight className="h-4 w-4" /> },
    { id: "vt", label: "Vale-Transporte", icon: <FileSpreadsheet className="h-4 w-4" /> },
    { id: "rp", label: "Rotinas / RP", icon: <ArrowLeftRight className="h-4 w-4" /> },
    { id: "produtos", label: "Produtos Homologados", icon: <PackageCheck className="h-4 w-4" /> },
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
                    : isSpecialConfig
                    ? "text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                    : "text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                }`}
              >
                <span
                  className={`flex-shrink-0 ${
                    isActive
                      ? "text-white"
                      : isSpecialConfig
                      ? "text-[#64748b] group-hover:text-[#2563eb]"
                      : "text-[#64748b] group-hover:text-[#2563eb]"
                  }`}
                >
                  {item.icon}
                </span>
                {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
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
              Operação da rede
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

      {/* Seletores de rede e unidade, sem o antigo cartão Contexto Atual */}
      {!isCollapsed ? (
        <div className="my-4 border-b border-[#e2e8f0] pb-4">

          {/* Seletor de Rede/Negócio para Administrador/Dono */}
          {!isFranchisee && (
            <div className="mt-2.5">
              <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#8ea1be] mb-1">
                Rede
              </label>
              <select
                id="select-business-context"
                disabled={isAdmin}
                value={currentBusinessId}
                onChange={(e) => onSelectBusiness(e.target.value)}
                className="w-full rounded-lg bg-white border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-[#2563eb] disabled:opacity-75 truncate"
              >
                {isOwner && (
                  <option value="all">Todas as redes</option>
                )}
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seletor da unidade */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[9px] font-extrabold uppercase tracking-wider text-[#8ea1be]">
                Unidade
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
                  <span className="truncate">{activeFranchise?.name || "Minha Unidade"}</span>
                </div>
                  <span className="text-[9px] font-mono font-bold bg-[#eff6ff] text-[#2563eb] px-1.5 py-0.5 rounded border border-[#bfdbfe]">
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
                  <option value="dono">Todas as unidades</option>
                )}
                {businesses
                  .filter((b) => currentBusinessId === "all" || b.id === currentBusinessId)
                  .map((b) => (
                    <option key={`matriz_${b.id}`} value={b.id}>
                      Matriz {b?.brand || b?.name || b?.id}
                    </option>
                  ))}
                {availableFranchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f?.name || f?.code} ({f?.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      ) : (
        <div className="my-2 flex flex-col items-center gap-1.5 py-2 border-b border-[#e2e8f0]">
          <button
            onClick={() => onSelectScreen("home")}
            title={getGestaoTitle()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1b2d4b] text-[#3c63da] border border-[#3c63da]/30 hover:bg-[#273b60]"
          >
            <Store className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Acesso principal de importação: fica separado dos demais itens para não desaparecer no menu */}
      {canAccessScreen("import_base") && (
        <button
          id="sidebar-upload-base"
          onClick={() => handleNavClick("import_base")}
          title={isCollapsed ? "Importar base" : undefined}
          className={`mb-4 flex w-full items-center rounded-xl border border-[#bfdbfe] bg-[#eff6ff] text-left text-[#1d4ed8] transition-colors hover:bg-[#dbeafe] ${isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-3"}`}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white shadow-sm">
            <UploadCloud className="h-4 w-4" />
          </span>
          {!isCollapsed && (
            <span className="min-w-0">
              <span className="block text-xs font-extrabold">Importar base</span>
              <span className="mt-0.5 block truncate text-[10px] font-medium text-[#4f6fae]">Excel, PDF, CSV ou OFX</span>
            </span>
          )}
        </button>
      )}

      {/* Nav Groups */}
      <div className="flex-1 space-y-1 mt-1">
        {renderNavGroup("Principal", principalNav)}
        {renderNavGroup("Financeiro", financialNav)}
        {renderNavGroup("Rede", networkNav)}
        {renderNavGroup("Operação", operationsNav)}
        {renderNavGroup("Gestão & Sistema", managementNav)}
      </div>

      <div className="mt-auto" aria-hidden="true" />
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
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-[#f8fafc]">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
