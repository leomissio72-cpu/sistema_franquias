import React, { useEffect, useState, useCallback } from "react";
import {
  ScreenType,
  User,
  UserSession,
  FranchiseUnit,
  Business,
  DreParams,
  PaymentMethod,
  BusinessRule,
  VTConfig,
  ManualEntry,
  SystemSettings,
  ConfigItem,
  AuditLog,
  CloudState,
  UserAccount
  ,Employee
} from "./types";
import {
  fetchServerState,
  subscribeToEvents,
  updateSingleConfig,
  updateBulkConfig,
  fetchAuditLogs,
  saveDreParams,
  savePaymentRules,
  saveVtConfig,
  saveRoyalties,
  saveFranchises,
  createManualEntry,
  createManualEntriesBulk,
  deleteManualEntry,
  saveSystemSettings,
  resetDatabase,
  syncStateSection,
  logoutAPI,
} from "./api";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { LoginModal } from "./components/LoginModal";
import { HomeScreen } from "./components/screens/HomeScreen";
import { ConfiguracaoScreen } from "./components/screens/ConfiguracaoScreen";
import { NetworkScreen } from "./components/screens/NetworkScreen";
import { MapScreen } from "./components/screens/MapScreen";
import { DashboardScreen } from "./components/screens/DashboardScreen";
import { DreScreen } from "./components/screens/DreScreen";
import { DreParamsScreen } from "./components/screens/DreParamsScreen";
import { FeesScreen } from "./components/screens/FeesScreen";
import { LancamentosScreen } from "./components/screens/LancamentosScreen";
import { ConciliationScreen } from "./components/screens/ConciliationScreen";
import { VtScreen } from "./components/screens/VtScreen";
import { RpScreen } from "./components/screens/RpScreen";
import { ReportsScreen } from "./components/screens/ReportsScreen";
import { PermissoesScreen } from "./components/screens/PermissoesScreen";
import { TenantsScreen } from "./components/screens/TenantsScreen";
import { EmployeesScreen } from "./components/screens/EmployeesScreen";
import { UsersScreen } from "./components/screens/UsersScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { ProdutosHomologadosScreen } from "./components/screens/ProdutosHomologadosScreen";
import { PagamentosDespesasScreen, PagamentoSubTab } from "./components/screens/PagamentosDespesasScreen";
import { Cloud, Loader2 } from "lucide-react";

export const App: React.FC = () => {
  // Navigation & Routing
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash.replace("#", "");
    if (path === "/configuracao" || hash === "configuracao") return "configuracao";
    if (
      hash &&
      [
        "home",
        "configuracao",
        "network",
        "map",
        "dashboard",
        "dre",
        "dreparams",
        "fees",
        "pagamentos_despesas",
        "lancamentos",
        "conciliation",
        "vt",
        "rp",
        "reports",
        "permissoes",
        "tenants",
        "employees",
        "users",
        "settings",
        "produtos",
      ].includes(hash)
    ) {
      return hash as ScreenType;
    }
    return "home";
  });

  // User & Tenant State
  const [currentBusinessId, setCurrentBusinessId] = useState<string>("all");
  const [currentTenantId, setCurrentTenantId] = useState<string>("dono");
  // Sessão deliberadamente não persistida: cada abertura exige login novamente.
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("franquias-theme") === "dark");
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

  // Server State & Audit Logs
  const [serverState, setServerState] = useState<CloudState | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Keep URL hash synchronized
  useEffect(() => {
    window.location.hash = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", isDarkMode);
    localStorage.setItem("franquias-theme", isDarkMode ? "dark" : "light" );
  }, [isDarkMode]);

  useEffect(() => {
    if (!userSession) return;
    const expiresAt = userSession.expiresAt || Date.now() + 8 * 60 * 60 * 1000;
    const timer = window.setTimeout(() => { void logoutAPI().catch(() => undefined); setUserSession(null); setIsLoginOpen(true); }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [userSession]);

  // Load state and audit logs from cloud backend
  const loadState = useCallback(async () => {
    try {
      const state = await fetchServerState();
      setServerState(state);
      setLoadError("");
      setLastSyncTime(new Date(state.lastUpdated || Date.now()).toLocaleTimeString("pt-BR"));
      setIsCloudConnected(true);

      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) {
        setAuditLogs(logsRes.auditLogs);
      }
    } catch (err) {
      console.error("Failed to load initial server state:", err);
      setIsCloudConnected(false);
      setLoadError("Não foi possível carregar os dados desta conta na nuvem. Nenhum dado antigo foi exibido.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userSession) {
      setServerState(null);
      setLoadError("");
      setIsLoading(false);
      setAuditLogs([]);
      return;
    }

    setServerState(null);
    setLoadError("");
    setAuditLogs([]);
    setIsLoading(true);
    void loadState();

    // Subscribe only while the current authenticated account is active.
    const unsubscribe = subscribeToEvents((newState: CloudState) => {
      setServerState(newState);
      setLastSyncTime(new Date(newState.lastUpdated || Date.now()).toLocaleTimeString("pt-BR"));
      setIsCloudConnected(true);

      // refresh logs on state update
      fetchAuditLogs().then((res) => {
        if (res.auditLogs) setAuditLogs(res.auditLogs);
      }).catch(console.error);
    });

    return () => {
      unsubscribe();
    };
  }, [loadState, userSession]);

  // Action Handlers
  const handleUpdateConfig = async (key: string, value: any) => {
    setIsSavingConfig(true);
    try {
      const res = await updateSingleConfig(key, value, userSession?.name || "Administrador");
      if (res.state) setServerState(res.state);
      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleBulkUpdateConfig = async (updates: Array<{ key: string; value: any }>) => {
    setIsSavingConfig(true);
    try {
      const res = await updateBulkConfig(updates, userSession?.name || "Administrador");
      if (res.state) setServerState(res.state);
      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveDreParams = async (tenantId: string, params: DreParams) => {
    const updatedState = await saveDreParams(tenantId, params, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSavePaymentRules = async (methods: PaymentMethod[], rules: BusinessRule) => {
    const updatedState = await savePaymentRules(methods, rules, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveVtConfig = async (tenantId: string, config: VTConfig) => {
    const updatedState = await saveVtConfig(tenantId, config, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveRoyalties = async (rates: Record<string, number>) => {
    const updatedState = await saveRoyalties(rates, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveFranchises = async (newFranchises: FranchiseUnit[]) => {
    const updatedState = await saveFranchises(newFranchises, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleCreateManualEntry = async (entry: Partial<ManualEntry>) => {
    const updatedState = await createManualEntry(entry, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleDeleteManualEntry = async (id: string) => {
    const updatedState = await deleteManualEntry(id, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleUpdateManualEntry = async (id: string, patch: Partial<ManualEntry>) => {
    const currentEntries = serverState?.manualEntries || [];
    const updatedEntries = currentEntries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
    const updatedState = await syncStateSection("manualEntries", updatedEntries, userSession?.name || "Admin", userSession || undefined);
    setServerState(updatedState);
  };

  const handleSaveSettings = async (settings: SystemSettings) => {
    const updatedState = await saveSystemSettings({ ...settings, autoSync: true, syncInterval: settings.syncInterval || 30 }, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveUsers = async (users: UserAccount[], credential?: { userId: string; password: string }) => {
    const updatedState = await syncStateSection("users", users, userSession?.name || "Administrador", userSession || undefined, credential);
    setServerState(updatedState);
  };

  const handleSaveEmployees = async (employees: Employee[], credential?: { userId: string; password: string }) => {
    const currentUsers = serverState?.users || [];
    const generatedUsers = employees
      .filter((employee) => employee.login?.trim())
      .map((employee) => {
        const existing = currentUsers.find((user) => user.employeeId === employee.id || user.login.toLowerCase() === employee.login!.trim().toLowerCase());
        return {
          id: existing?.id || `user-${employee.id}`,
          nome: employee.nome,
          email: employee.email,
          login: employee.login!.trim(),
          perfil: employee.accessProfile || existing?.perfil || "operador",
          unidade: employee.unidade,
          status: employee.active === false ? "inativo" : "ativo",
          employeeId: employee.id,
        } as UserAccount;
      });
    const generatedIds = new Set(generatedUsers.map((user) => user.id));
    const preservedUsers = currentUsers.filter((user) => !user.employeeId || !employees.some((employee) => employee.id === user.employeeId));
    const updatedState = await syncStateSection("employees", employees, userSession?.name || "Administrador", userSession || undefined);
    const stateWithUsers = await syncStateSection("users", [...preservedUsers.filter((user) => !generatedIds.has(user.id)), ...generatedUsers], userSession?.name || "Administrador", userSession || undefined, credential);
    setServerState({ ...updatedState, ...stateWithUsers });
  };

  const handleResetDatabase = async () => {
    const updatedState = await resetDatabase();
    setServerState(updatedState);
    const logsRes = await fetchAuditLogs();
    if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
  };

  const isFranchisee = userSession?.profile === "franqueado" || userSession?.profile === "operador";

  // Verificação de posse/propriedade de unidade:
  // Uma unidade não tem acesso a outra, a não ser que pertença comprovadamente ao mesmo dono
  const isUnitOwnedByUser = useCallback(
    (tenantId: string): boolean => {
      if (!userSession) return false;
      const profile = userSession.profile;
      if (profile === "dono" || profile === "equipe") return true;
      if (profile === "admin") {
        if (userSession.tenant?.startsWith("biz")) {
          const unit = (serverState?.franchises || []).find((f) => f.id === tenantId);
          return unit?.businessId === userSession.tenant;
        }
        return true;
      }
      // Regra para franqueado/operador:
      const allowedTenants = (userSession.tenant || "").split(",").map((t) => t.trim().toLowerCase());
      return allowedTenants.includes(tenantId.toLowerCase());
    },
    [userSession, serverState]
  );

  const handleSelectTenant = (tenantId: string) => {
    if (isFranchisee) {
      if (!isUnitOwnedByUser(tenantId)) {
        console.warn("Acesso bloqueado: unidade não pertence ao mesmo proprietário.");
        return;
      }
    }
    setCurrentTenantId(tenantId);
  };

  // Restrição estrita de telas para unidades:
  // Unidades franqueadas têm acesso SOMENTE a lançamentos e relatórios (+ início)
  useEffect(() => {
    if (isFranchisee) {
      const allowedScreens: ScreenType[] = ["home", "dashboard", "fees", "pagamentos_despesas", "lancamentos", "import_base", "produtos", "employees", "users"];
      if (!allowedScreens.includes(currentScreen)) {
        setCurrentScreen("home");
      }
    }
  }, [isFranchisee, currentScreen]);

  const handleLoginSuccess = (session: UserSession) => {
    setUserSession({ ...session, expiresAt: session.expiresAt || Date.now() + 8 * 60 * 60 * 1000 });
    setIsLoginOpen(false);
    if (session.profile === "franqueado" || session.profile === "operador") {
      setCurrentTenantId(session.tenant);
      setCurrentScreen("home");
    } else {
      setCurrentTenantId("dono");
    }
  };

  const handleLogout = () => {
    void logoutAPI().catch(() => undefined);
    try {
      localStorage.removeItem("sofiacfo_user_session");
    } catch (e) {}
    setUserSession(null);
    setServerState(null);
    setLastSyncTime("");
    setAuditLogs([]);
    setCurrentTenantId("dono");
    setIsLoginOpen(true);
  };

  // Se não estiver logado, exibe apenas a tela de Login segura.
  if (!userSession) {
    return (
      <LoginModal
        isOpen={true}
        onSuccess={handleLoginSuccess}
      />
    );
  }

  if (isLoading || !serverState) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#10192c] text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3c63da] text-white shadow-lg">
            <Cloud className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Gestão de Franquias</h1>
            <p className="max-w-md text-xs text-[#8ea1be]">{loadError || "Conectando à base central na nuvem..."}</p>
            {loadError && <button type="button" onClick={() => void loadState()} className="mt-4 rounded-xl bg-[#3c63da] px-4 py-2 text-xs font-bold text-white">Tentar novamente</button>}
          </div>
        </div>
      </div>
    );
  }

  const {
    franchises,
    businesses,
    dreParams,
    paymentMethods,
    businessRules,
    vtConfigs,
    royalties,
    manualEntries,
    systemSettings,
    configs,
    permissions,
    products = [],
    suppliers = [],
  } = serverState;

  const getTenantDisplayName = () => {
    if (currentTenantId === "dono") return "Visão Consolidada (Rede)";
    if (currentTenantId.startsWith("biz")) {
      const b = businesses.find((biz) => biz.id === currentTenantId);
      return b ? `Matriz ${b.brand}` : currentTenantId;
    }
    const unit = franchises.find((f) => f.id === currentTenantId);
    return unit ? `${unit.name} (${unit.code})` : currentTenantId;
  };

  return (
    <div className={`app-shell flex min-h-screen bg-[#f4f7fb] text-[#152238] font-sans antialiased selection:bg-[#3c63da] selection:text-white ${isDarkMode ? "theme-dark" : ""}`}>
      {/* Sidebar Desktop & Mobile Drawer */}
      <Sidebar
        currentScreen={currentScreen}
        onSelectScreen={(screen) => {
          setCurrentScreen(screen);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        businesses={businesses}
        franchises={franchises}
        currentBusinessId={currentBusinessId}
        currentTenantId={currentTenantId}
        onSelectBusiness={setCurrentBusinessId}
        onSelectTenant={setCurrentTenantId}
        userSession={userSession}
        permissions={permissions || {}}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Container with responsive padding for collapsed sidebar */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        {/* Top Header */}
        <Header
          userSession={userSession}
          currentScreen={currentScreen}
          tenantName={getTenantDisplayName()}
          isCloudConnected={isCloudConnected}
          lastSyncTime={lastSyncTime}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onLogout={handleLogout}
          onForceSync={loadState}
          onOpenImport={() => setCurrentScreen("import_base")}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode((current) => !current)}
        />

        {/* Dynamic Screen View */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto pb-20 md:pb-8">
          {currentScreen === "home" && (
            <HomeScreen
              currentTenantId={currentTenantId}
              franchises={franchises}
              businesses={businesses}
              currentBusinessId={currentBusinessId}
              onSelectTenant={setCurrentTenantId}
              onSelectBusiness={setCurrentBusinessId}
              userSession={userSession}
              onNavigate={setCurrentScreen}
              dreParams={dreParams}
              royalties={royalties}
            />
          )}

          {currentScreen === "configuracao" && !isFranchisee && (
            <ConfiguracaoScreen
              configs={configs}
              auditLogs={auditLogs}
              userSession={userSession}
              businesses={businesses}
              franchises={franchises}
              royalties={royalties}
              permissions={permissions}
              settings={systemSettings}
              users={serverState.users}
              initialTab="configs"
              onUpdateConfig={handleUpdateConfig}
              onBulkUpdate={handleBulkUpdateConfig}
              onSaveRoyalties={handleSaveRoyalties}
              onSaveFranchises={handleSaveFranchises}
              onSaveSettings={handleSaveSettings}
              onSaveUsers={handleSaveUsers}
              onResetDatabase={handleResetDatabase}
              onRefresh={loadState}
              isSaving={isSavingConfig}
            />
          )}

          {currentScreen === "settings" && !isFranchisee && (
            <SettingsScreen
              settings={systemSettings}
              onSaveSettings={handleSaveSettings}
              onResetDatabase={handleResetDatabase}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === "network" && (
            <NetworkScreen
              franchises={franchises}
              businesses={businesses}
              currentTenantId={currentTenantId}
              onSelectTenant={handleSelectTenant}
              onNavigate={setCurrentScreen}
              dreParams={dreParams}
              royalties={royalties}
              onRefreshData={loadState}
            />
          )}

          {currentScreen === "map" && (
            <MapScreen
              franchises={franchises}
              businesses={businesses}
              currentTenantId={currentTenantId}
              onSelectTenant={handleSelectTenant}
              onNavigate={setCurrentScreen}
              dreParams={dreParams}
              royalties={royalties}
            />
          )}

          {currentScreen === "dashboard" && (
            <DashboardScreen
              franchises={franchises}
              businesses={businesses}
              currentTenantId={currentTenantId}
              onSelectTenant={handleSelectTenant}
              onNavigate={setCurrentScreen}
              dreParams={dreParams}
              royalties={royalties}
              initialTab="analytics"
              userSession={userSession}
            />
          )}

          {currentScreen === "dre" && (
            <DreScreen
              franchises={franchises}
              businesses={businesses}
              currentTenantId={currentTenantId}
              dreParams={dreParams}
              royalties={royalties}
              onNavigate={setCurrentScreen}
              onSelectTenant={handleSelectTenant}
              onSaveParams={handleSaveDreParams}
              userSession={userSession}
              currentBusinessId={currentBusinessId}
              onSelectBusiness={setCurrentBusinessId}
            />
          )}

          {currentScreen === "dreparams" && (
            <DreParamsScreen
              currentTenantId={currentTenantId}
              franchises={franchises}
              dreParams={dreParams}
              onSaveParams={handleSaveDreParams}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === "fees" && (
            <FeesScreen
              currentTenantId={currentTenantId}
              paymentMethods={paymentMethods as PaymentMethod[]}
              businessRules={businessRules as BusinessRule}
              onSavePaymentRules={handleSavePaymentRules}
              onNavigate={setCurrentScreen}
              userSession={userSession}
            />
          )}

          {currentScreen === "produtos" && (
            <ProdutosHomologadosScreen
              products={products}
              suppliers={suppliers}
              userSession={userSession}
            />
          )}

          {["pagamentos_despesas", "lancamentos", "conciliation", "import_base", "vt", "rp"].includes(currentScreen) && (
            <PagamentosDespesasScreen
              currentTenantId={currentTenantId}
              franchises={franchises}
              manualEntries={manualEntries}
              onCreateEntry={handleCreateManualEntry}
              onCreateEntriesBulk={async (entries) => {
                const updatedState = await createManualEntriesBulk(entries);
                setServerState(updatedState);
              }}
              onDeleteEntry={handleDeleteManualEntry}
              onUpdateEntry={handleUpdateManualEntry}
              vtConfigs={vtConfigs}
              onSaveVtConfig={handleSaveVtConfig}
              onNavigate={setCurrentScreen}
              initialTab={
                currentScreen === "lancamentos"
                  ? "lancamentos"
                  : currentScreen === "conciliation" || currentScreen === "import_base"
                  ? "conciliation"
                  : currentScreen === "vt"
                  ? "vt"
                  : currentScreen === "rp"
                  ? "rp"
                  : "rp"
              }
            />
          )}

          {currentScreen === "reports" && (
            <DashboardScreen
              franchises={franchises}
              businesses={businesses}
              currentTenantId={currentTenantId}
              onSelectTenant={handleSelectTenant}
              onNavigate={setCurrentScreen}
              dreParams={dreParams}
              royalties={royalties}
              initialTab="reports"
              userSession={userSession}
            />
          )}

          {currentScreen === "permissoes" && (
            <PermissoesScreen
              businesses={businesses}
              franchises={franchises}
              royalties={royalties}
              onSaveRoyalties={handleSaveRoyalties}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === "tenants" && (
            <TenantsScreen
              franchises={franchises}
              businesses={businesses}
              onSelectTenant={setCurrentTenantId}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === "employees" && (
            <EmployeesScreen
              currentTenantId={currentTenantId}
              franchises={franchises}
              employees={serverState.employees || []}
              onSaveEmployees={handleSaveEmployees}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === "users" && (
            <UsersScreen
              users={serverState.users || []}
              employees={serverState.employees || []}
              franchises={franchises}
              userSession={userSession}
              onSaveUsers={(users) => handleSaveUsers(users)}
              onNavigate={setCurrentScreen}
            />
          )}
        </main>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default App;
