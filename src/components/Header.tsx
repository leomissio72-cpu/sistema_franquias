import React from "react";
import { UserSession, ScreenType } from "../types";
import { Menu, Cloud, LogOut, ShieldCheck, Store, Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface HeaderProps {
  userSession: UserSession | null;
  currentScreen: ScreenType;
  tenantName: string;
  isCloudConnected: boolean;
  lastSyncTime: string;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
  onForceSync: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}

const screenTitles: Record<ScreenType, string> = {
  home: "Início",
  network: "Rede e Unidades",
  map: "Mapa das Unidades",
  dashboard: "Analítico",
  dre: "DRE e Resultados",
  fees: "Taxas e Recebimentos",
  dreparams: "Parâmetros do DRE",
  lancamentos: "Lançamentos Manuais",
  conciliation: "Conciliação Bancária",
  vt: "Vale Transporte",
  rp: "Rotinas / RP",
  pagamentos_despesas: "Pagamentos / Despesas",
  reports: "Relatórios Exportáveis",
  permissoes: "Permissões e Royalties",
  tenants: "Cadastro de Franqueados",
  employees: "Cadastro de Funcionários",
  users: "Acessos e Logins",
  configuracao: "Painel de Configurações da Nuvem",
  settings: "Preferências do Usuário",
};

export const Header: React.FC<HeaderProps> = ({
  userSession,
  currentScreen,
  tenantName,
  isCloudConnected,
  lastSyncTime,
  onOpenMobileMenu,
  onLogout,
  onForceSync,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
}) => {
  const getAvatarInitials = () => {
    if (!userSession?.name) return "SF";
    const parts = userSession.name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return userSession.name.slice(0, 2).toUpperCase();
  };

  const getRoleLabel = () => {
    switch (userSession?.profile) {
      case "dono":
        return "Dono · Acesso Total";
      case "equipe":
        return "Equipe Matriz";
      case "admin":
        return "Admin da Rede";
      case "franqueado":
        return "Franqueado";
      case "operador":
        return "Operador";
      default:
        return "Usuário";
    }
  };

  // Generate the clean "Gestão: [Nome]" text
  const gestaoLabel = tenantName.startsWith("Gestão:")
    ? tenantName
    : `Gestão: ${tenantName}`;

  const isFranchisee = userSession?.profile === "franqueado" || userSession?.profile === "operador";

  return (
    <header
      id="main-topbar"
      className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#e5eaf1] bg-white px-3 sm:px-6 lg:px-8 shadow-xs"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          id="btn-mobile-menu-toggle"
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5eaf1] text-[#152238] hover:bg-[#f4f7fb] lg:hidden flex-shrink-0 cursor-pointer"
          aria-label="Abrir Menu Mobile"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop sidebar collapse toggle */}
        {onToggleSidebarCollapse && (
          <button
            id="btn-desktop-sidebar-toggle"
            onClick={onToggleSidebarCollapse}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5eaf1] text-[#152238] hover:bg-[#f4f7fb] hover:text-[#3c63da] transition-colors flex-shrink-0 cursor-pointer"
            title={isSidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            aria-label={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Brand Title: Exactly "Gestão de Franquias" as requested */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <h1 className="text-sm sm:text-base font-extrabold text-[#152238] tracking-tight whitespace-nowrap">
            Gestão de Franquias
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Cloud Sync Status - Calm static indicator, no blinking/pinging */}
        <button
          id="btn-cloud-sync-status"
          onClick={onForceSync}
          title={`Nuvem conectada. Última sincronização: ${lastSyncTime}. Clique para sincronizar agora.`}
          className="flex items-center gap-1.5 rounded-full bg-[#f8faff] border border-[#e5eaf1] px-2.5 py-1 text-[11px] font-bold text-[#152238] hover:bg-[#edf2ff] transition-colors cursor-pointer shadow-2xs"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isCloudConnected ? "bg-emerald-600" : "bg-rose-600"
            }`}
          />
          <Cloud className="h-3.5 w-3.5 text-[#3c63da] hidden sm:inline" />
          <span className="hidden md:inline">Nuvem Conectada</span>
        </button>

        {/* User Role Badge */}
        <span
          id="badge-user-role"
          className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#edf2ff] px-2.5 py-1 text-xs font-bold text-[#3c63da]"
        >
          <ShieldCheck className="h-3 w-3" />
          {getRoleLabel()}
        </span>

        {/* Avatar */}
        <div
          id="avatar-user"
          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#edf2ff] font-extrabold text-[#3c63da] text-xs shadow-xs border border-[#3c63da]/20"
          title={userSession?.name || "Usuário"}
        >
          {getAvatarInitials()}
        </div>

        {/* Logout */}
        <button
          id="btn-logout"
          onClick={onLogout}
          className="flex items-center gap-1 rounded-lg border border-[#e5eaf1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#152238] hover:bg-[#fff0f0] hover:text-[#b44b4b] hover:border-[#f0d0d0] transition-colors cursor-pointer"
          title="Encerrar sessão"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
};
