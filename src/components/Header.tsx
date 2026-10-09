import React from "react";
import { UserSession, ScreenType } from "../types";
import { Menu, LogOut, Moon, Sun, BookOpen } from "lucide-react";

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
  /** seletores de franquia e unidade, exibidos na faixa de contexto (desktop) */
  scope?: React.ReactNode;
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
  permissoes: "Permissões e Royalties",
  tenants: "Cadastro de Franqueados",
  employees: "Cadastro de Funcionários",
  users: "Acessos e Logins",
  configuracao: "Configurações",
  settings: "Preferências do Usuário",
  produtos: "Fornecedores e Produtos Homologados",
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
  isCloudConnected = false,
  lastSyncTime = "",
  scope,
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
        return "Dono";
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

  const syncTitle = isCloudConnected
    ? `Dados sincronizados em nuvem${lastSyncTime ? `, última sincronização ${lastSyncTime}` : ""}`
    : "Sincronização em nuvem não confirmada. Verifique a configuração do armazenamento.";

  return (
    <header
      id="main-topbar"
      className="sticky top-0 lg:top-14 z-30 flex h-14 lg:h-12 w-full items-center justify-between gap-3 border-b border-[#dfe4df] bg-white px-3 sm:px-6 lg:px-6"
    >
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Menu do celular */}
        <button
          id="btn-mobile-menu-toggle"
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe4df] text-[#17211f] hover:bg-[#f0f3f0] lg:hidden flex-shrink-0 cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="text-sm sm:text-[15px] font-extrabold text-[#17211f] whitespace-nowrap lg:sr-only">
          {screenTitles[currentScreen] || "Gestão de Franquias"}
        </h1>

        {scope && (
          <div className="hidden lg:flex items-center gap-3 min-w-0">
            {scope}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-[#5e6b67]" title={syncTitle}>
          <span className={`h-2 w-2 rounded-full ${isCloudConnected ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden="true" />
          <span>{isCloudConnected ? "Nuvem sincronizada" : "Sincronização pendente"}</span>
        </div>
        {onNavigate && (
          <button
            id="btn-help-instructions"
            onClick={() => onNavigate("instrucoes")}
            className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              currentScreen === "instrucoes"
                ? "border-petrol-700 bg-petrol-100 text-petrol-800"
                : "border-[#dfe4df] bg-white text-[#4a5753] hover:bg-[#f0f3f0] hover:text-[#17211f]"
            }`}
            title="Instruções de uso da ferramenta"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Instruções</span>
          </button>
        )}

        {/* No celular a barra superior não aparece, então tema, usuário e saída ficam aqui */}
        <div className="flex items-center gap-2 lg:hidden">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe4df] bg-white text-[#4a5753] hover:bg-[#f0f3f0] cursor-pointer"
              title={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
              aria-label={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-petrol-100 text-[11px] font-extrabold text-petrol-800"
            title={`${userSession?.name || "Usuário"} (${getRoleLabel()})`}
          >
            {getAvatarInitials()}
          </span>
          <button
            onClick={onLogout}
            className="flex h-9 items-center gap-1 rounded-md border border-[#dfe4df] bg-white px-2.5 text-xs font-semibold text-[#17211f] hover:bg-[#fff0f0] hover:text-[#b93a48] cursor-pointer"
            title="Encerrar sessão"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
};
