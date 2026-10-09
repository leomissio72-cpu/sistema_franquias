import React, { useEffect, useRef, useState } from "react";
import {
  ScreenType,
  Business,
  FranchiseUnit,
  UserSession
} from "../types";
import { X, UploadCloud, ChevronDown, ChevronRight, Moon, Sun, LogOut } from "lucide-react";

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
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onLogout?: () => void;
}

interface NavItem {
  id: ScreenType;
  /** nome completo, usado no menu do celular e nas dicas */
  label: string;
  /** nome curto, usado na barra superior */
  short: string;
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
  isDarkMode = false,
  onToggleTheme,
  onLogout,
}) => {
  const [isGestaoOpen, setIsGestaoOpen] = useState(false);
  const gestaoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isGestaoOpen) return;
    const close = (event: MouseEvent) => {
      if (gestaoRef.current && !gestaoRef.current.contains(event.target as Node)) setIsGestaoOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setIsGestaoOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [isGestaoOpen]);

  const userProfile = userSession?.profile || "franqueado";
  const userPerms = permissions[userProfile] || {};

  const isOwner = userProfile === "dono" || userProfile === "equipe";
  const isAdmin = userProfile === "admin";
  const isFranchisee = userProfile === "franqueado" || userProfile === "operador";

  const canAccessScreen = (screen: ScreenType): boolean => {
    // Unidades franqueadas têm acesso estritamente a Início, Analítico, Lançamentos e Taxas (consulta)
    if (isFranchisee) {
      return ["home", "dashboard", "fees", "pagamentos_despesas", "lancamentos", "import_base", "network", "produtos", "employees", "users"].includes(screen);
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

  const mainNav: NavItem[] = [
    { id: "home", label: "Início", short: "Início" },
    { id: "dashboard", label: "Analítico", short: "Analítico" },
    { id: "pagamentos_despesas", label: "Pagamentos e Despesas", short: "Pagamentos" },
    { id: "fees", label: "Taxas e Recebimentos", short: "Taxas" },
    { id: "network", label: "Rede e Unidades", short: "Rede" },
    { id: "produtos", label: "Fornecedores e Produtos", short: "Fornecedores" },
  ];

  const managementNav: NavItem[] = [
    ...(isFranchisee ? [] : [{ id: "configuracao" as ScreenType, label: "Configurações", short: "Configurações" }]),
    { id: "employees", label: "Funcionários", short: "Funcionários" },
    { id: "users", label: "Acessos e Logins", short: "Acessos e logins" },
  ];

  const isItemActive = (id: ScreenType) =>
    currentScreen === id ||
    (id === "pagamentos_despesas" &&
      ["pagamentos_despesas", "lancamentos", "conciliation", "vt", "rp", "dre"].includes(currentScreen));

  const visibleMain = mainNav.filter((item) => canAccessScreen(item.id));
  const visibleManagement = managementNav.filter((item) => canAccessScreen(item.id));
  const isManagementActive = visibleManagement.some((item) => isItemActive(item.id));

  const go = (screen: ScreenType) => {
    onSelectScreen(screen);
    setIsGestaoOpen(false);
    if (isOpenMobile) onCloseMobile();
  };

  const initials = (() => {
    const name = userSession?.name || "";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name.slice(0, 2) || "GF").toUpperCase();
  })();

  const roleLabel: Record<string, string> = {
    dono: "Dono",
    equipe: "Equipe da matriz",
    admin: "Admin da rede",
    franqueado: "Franqueado",
    operador: "Operador",
  };

  /* Item da barra superior: o marcador ocre na base indica onde você está. */
  const topItemClass = (active: boolean) =>
    `relative flex h-14 items-center px-3 text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
      active
        ? "font-bold text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-sm after:bg-ocre"
        : "font-medium text-white/65 hover:text-white"
    }`;

  return (
    <>
      {/* Barra superior (desktop): marca, navegação e ações da sessão */}
      <aside
        aria-label="Navegação principal"
        className="hidden lg:flex fixed inset-x-0 top-0 z-40 h-14 items-stretch bg-petrol-800 text-white pl-5 pr-4"
      >
        <button
          onClick={() => go("home")}
          className="mr-5 flex items-center gap-2.5 cursor-pointer"
          title="Ir para o Início"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ocre text-[11px] font-black text-petrol-950">GF</span>
          <span className="hidden xl:block text-sm font-extrabold text-white" style={{ fontStretch: "112%" }}>Gestão de Franquias</span>
        </button>

        <nav className="flex items-stretch">
          {visibleMain.map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => go(item.id)}
              title={item.label}
              aria-current={isItemActive(item.id) ? "page" : undefined}
              className={topItemClass(isItemActive(item.id))}
            >
              {item.short}
            </button>
          ))}

          {visibleManagement.length > 0 && (
            <div ref={gestaoRef} className="relative flex">
              <button
                onClick={() => setIsGestaoOpen((open) => !open)}
                aria-expanded={isGestaoOpen}
                aria-haspopup="menu"
                className={`${topItemClass(isManagementActive)} gap-1`}
              >
                Gestão
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isGestaoOpen ? "rotate-180" : ""}`} />
              </button>
              {isGestaoOpen && (
                <div role="menu" className="absolute left-0 top-[52px] z-50 w-52 overflow-hidden rounded-lg border border-[#dfe4df] bg-white py-1 shadow-lg">
                  {visibleManagement.map((item) => (
                    <button
                      key={item.id}
                      id={`nav-${item.id}`}
                      role="menuitem"
                      onClick={() => go(item.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] cursor-pointer ${
                        isItemActive(item.id)
                          ? "bg-petrol-100 font-bold text-petrol-800"
                          : "font-medium text-[#3a4743] hover:bg-[#f0f3f0] hover:text-[#17211f]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {canAccessScreen("import_base") && (
            <button
              id="sidebar-upload-base"
              onClick={() => go("import_base")}
              title="Importar base: Excel, PDF, CSV ou OFX"
              className={`flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-bold transition-colors cursor-pointer ${
                currentScreen === "import_base"
                  ? "bg-ocre text-petrol-950"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>Importar base</span>
            </button>
          )}
          {onToggleTheme && (
            <button
              id="btn-theme-toggle"
              onClick={onToggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
              aria-label={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
          <div id="user-profile-summary" className="ml-1 flex items-center gap-2 border-l border-white/15 pl-3">
            <span id="avatar-user" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-[11px] font-extrabold text-white" title={userSession?.name || "Usuário"}>
              {initials}
            </span>
            <span className="hidden xl:block max-w-[140px] leading-tight">
              <span className="block truncate text-xs font-bold text-white">{userSession?.name || "Usuário"}</span>
              <span className="block truncate text-[11px] text-white/60">{roleLabel[userProfile] || "Usuário"}</span>
            </span>
          </div>
          {onLogout && (
            <button
              id="btn-logout"
              onClick={onLogout}
              title="Encerrar sessão"
              className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </aside>

      {/* Menu do celular */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/55" onClick={onCloseMobile} />
          <div className="relative flex w-full max-w-xs flex-1 flex-col overflow-y-auto bg-white">
            <div className="flex items-center justify-between bg-petrol-800 px-4 py-3.5 text-white">
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ocre text-[11px] font-black text-petrol-950">GF</span>
                <span className="text-sm font-extrabold">Gestão de Franquias</span>
              </span>
              <button onClick={onCloseMobile} aria-label="Fechar menu" className="flex h-9 w-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-[#dfe4df] bg-[#f7f9f7] px-4 py-4">
              <ScopeSelectors
                layout="stacked"
                businesses={businesses}
                franchises={franchises}
                currentBusinessId={currentBusinessId}
                currentTenantId={currentTenantId}
                onSelectBusiness={onSelectBusiness}
                onSelectTenant={onSelectTenant}
                userSession={userSession}
              />
            </div>

            <nav className="flex flex-col px-2 py-3">
              {[...visibleMain, ...visibleManagement].map((item) => (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  aria-current={isItemActive(item.id) ? "page" : undefined}
                  className={`flex items-center justify-between rounded-md px-3 py-3 text-left text-sm cursor-pointer ${
                    isItemActive(item.id)
                      ? "bg-petrol-100 font-bold text-petrol-800"
                      : "font-medium text-[#3a4743] hover:bg-[#f0f3f0]"
                  }`}
                >
                  {item.label}
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </button>
              ))}
            </nav>

            {canAccessScreen("import_base") && (
              <div className="mt-auto border-t border-[#dfe4df] p-4">
                <button
                  onClick={() => go("import_base")}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-petrol-700 px-4 py-3 text-sm font-bold text-white hover:bg-petrol-800 cursor-pointer"
                >
                  <UploadCloud className="h-4 w-4" />
                  Importar base
                </button>
                <p className="mt-2 text-center text-[11px] text-[#5e6b67]">Excel, PDF, CSV ou OFX</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

interface ScopeSelectorsProps {
  businesses: Business[];
  franchises: FranchiseUnit[];
  currentBusinessId: string;
  currentTenantId: string;
  onSelectBusiness: (bizId: string) => void;
  onSelectTenant: (tenantId: string) => void;
  userSession: UserSession | null;
  /** "inline": lado a lado na faixa de contexto; "stacked": empilhado no menu do celular */
  layout?: "inline" | "stacked";
}

/** Escolha da rede e da unidade que estão sendo analisadas. */
export const ScopeSelectors: React.FC<ScopeSelectorsProps> = ({
  businesses,
  franchises,
  currentBusinessId,
  currentTenantId,
  onSelectBusiness,
  onSelectTenant,
  userSession,
  layout = "inline",
}) => {
  const userProfile = userSession?.profile || "franqueado";
  const isOwner = userProfile === "dono" || userProfile === "equipe";
  const isAdmin = userProfile === "admin";
  const isFranchisee = userProfile === "franqueado" || userProfile === "operador";

  // Filtered franchise list according to business context and user permissions
  // Uma unidade não pode ver outra, a menos que pertença comprovadamente ao mesmo dono
  const availableFranchises = franchises.filter((f) => {
    if (f.active === false) return false;
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
  const stacked = layout === "stacked";
  const selectClass = `rounded-md border border-[#c9d1cb] bg-white text-[13px] font-semibold text-[#17211f] focus:outline-none focus:border-petrol-600 truncate ${
    stacked ? "w-full px-3 py-2.5" : "h-8 max-w-[280px] pl-2.5 pr-7 cursor-pointer"
  }`;
  const labelClass = stacked
    ? "mb-1 block text-xs font-semibold text-[#5e6b67]"
    : "text-xs font-medium text-[#5e6b67] whitespace-nowrap";

  return (
    <div className={stacked ? "space-y-3" : "flex items-center gap-2"}>
      {!isFranchisee && (
        <div className={stacked ? "" : "flex items-center gap-1.5"}>
          <label htmlFor={`select-business-context${stacked ? "-m" : ""}`} className={labelClass}>Franquia</label>
          <select
            id={`select-business-context${stacked ? "-m" : ""}`}
            disabled={isAdmin}
            value={currentBusinessId}
            onChange={(e) => onSelectBusiness(e.target.value)}
            className={`${selectClass} disabled:opacity-75`}
          >
            {isOwner && <option value="all">Todas as franquias (Rede)</option>}
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {!stacked && !isFranchisee && <ChevronRight className="h-3.5 w-3.5 text-[#93a09b]" aria-hidden="true" />}

      <div className={stacked ? "" : "flex items-center gap-1.5"}>
        <label htmlFor={`select-tenant-context${stacked ? "-m" : ""}`} className={labelClass}>
          {isFranchisee && availableFranchises.length > 1 ? `Unidade (${availableFranchises.length} lojas)` : "Unidade"}
        </label>
        {isFranchisee && availableFranchises.length <= 1 ? (
          <span className={`${selectClass} inline-flex items-center gap-2 ${stacked ? "" : "pr-2.5"}`}>
            <span className="truncate">{activeFranchise?.name || "Minha unidade"}</span>
            <span className="rounded-sm bg-petrol-100 px-1.5 py-0.5 text-[10px] font-bold text-petrol-800">{activeFranchise?.code || "Unidade"}</span>
          </span>
        ) : (
          <select
            id={`select-tenant-context${stacked ? "-m" : ""}`}
            value={currentTenantId}
            onChange={(e) => onSelectTenant(e.target.value)}
            className={selectClass}
          >
            {isOwner && currentBusinessId === "all" && <option value="dono">Todas as unidades (Consolidado)</option>}
            {isOwner && currentBusinessId !== "all" && (
              <option value={currentBusinessId}>
                Todas as unidades ({businesses.find((b) => b.id === currentBusinessId)?.name || "Franquia"})
              </option>
            )}
            {availableFranchises.map((f) => (
              <option key={f.id} value={f.id}>{f?.name || f?.code} ({f?.code})</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};
