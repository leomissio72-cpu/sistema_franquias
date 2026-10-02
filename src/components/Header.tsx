import React from "react";
import { UserSession, ScreenType } from "../types";
import { Menu, LogOut, PanelLeftClose, PanelLeftOpen, Moon, Sun, BookOpen } from "lucide-react";

interface HeaderProps {
  userSession: UserSession | null;
  currentScreen: ScreenType;
  tenantName: string;
  isCloudConnected?: boolean;
  lastSyncTime?: string;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
  onForceSync: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  onOpenImport?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onNavigate?: (screen: ScreenType) => void;
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
  import_base: "Upload de bases",
  vt: "Vale Transporte",
  rp: "Rotinas / RP",
  pagamentos_despesas: "Pagamentos / Despesas",
  reports: "Relatórios Exportáveis",
  permissoes: "Permissões e Royalties",
  tenants: "Cadastro de Franqueados",
  employees: "Cadastro de Funcionários",
  users: "Acessos e Logins",
  configuracao: "Configurações",
  settings: "Preferências do Usuário",
  produtos: "Produtos Homologados",
  instrucoes: "Instruções & Ajuda",
};

export const Header: React.FC<HeaderProps> = ({
  userSession,
  currentScreen,
  tenantName,
  onOpenMobileMenu,
  onLogout,
  onForceSync,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
  onOpenImport,
  isDarkMode = false,
  onToggleTheme,
  onNavigate,
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



        {/* Brand Title: Exactly "Gestão de Franquias" as requested */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <h1 className="text-sm sm:text-base font-extrabold text-[#152238] tracking-tight whitespace-nowrap">
            Gestão de Franquias
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {onNavigate && (
          <button
            id="btn-help-instructions"
            onClick={() => onNavigate("instrucoes")}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs font-bold transition-all cursor-pointer ${
              currentScreen === "instrucoes"
                ? "border-[#3c63da] bg-[#edf2ff] text-[#3c63da]"
                : "border-[#e5eaf1] bg-white text-[#526078] hover:bg-[#f4f7fb] hover:text-[#152238]"
            }`}
            title="Instruções de uso e documentação da ferramenta"
          >
            <BookOpen className="h-4 w-4 text-amber-500" />
            <span className="hidden sm:inline">Instruções</span>
          </button>
        )}
        {onToggleTheme && (
          <button
            id="btn-theme-toggle"
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5eaf1] bg-white text-[#526078] hover:bg-[#f4f7fb] hover:text-[#315bc5] transition-colors cursor-pointer"
            title={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
            aria-label={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
        {/* Perfil do usuário: identificação humana, sem indicadores técnicos */}
        <div id="user-profile-summary" className="hidden items-center gap-2 rounded-xl border border-[#e5eaf1] bg-[#f8fafc] px-2.5 py-1.5 sm:flex">
          <div
            id="avatar-user"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8efff] font-extrabold text-[#315bc5] text-xs border border-[#cbdafc]"
            title={userSession?.name || "Usuário"}
          >
            {getAvatarInitials()}
          </div>
          <div className="max-w-[150px] leading-tight">
            <p className="truncate text-xs font-extrabold text-[#152238]">{userSession?.name || "Usuário"}</p>
            <p className="truncate text-[10px] font-medium text-[#69778c]">{getRoleLabel()}</p>
          </div>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8efff] font-extrabold text-[#315bc5] text-xs border border-[#cbdafc] sm:hidden"
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
