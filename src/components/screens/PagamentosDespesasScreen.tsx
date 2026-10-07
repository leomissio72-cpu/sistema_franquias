import React, { useState, useEffect } from "react";
import {
  ScreenType,
  FranchiseUnit,
  Business,
  ManualEntry,
  VTConfig,
  BillItem,
  UserSession,
  IntercompanyRule,
} from "../../types";
import { RpScreen } from "./RpScreen";
import { ConciliationScreen } from "./ConciliationScreen";
import { LancamentosScreen } from "./LancamentosScreen";
import { VtScreen } from "./VtScreen";
import {
  CreditCard,
  Cog,
  ArrowLeftRight,
  FilePenLine,
  FileSpreadsheet,
  CalendarDays,
  Layers,
  ChevronRight,
  Building2
} from "lucide-react";

export type PagamentoSubTab = "rp" | "conciliation" | "lancamentos" | "vt";

interface PagamentosDespesasScreenProps {
  currentTenantId: string;
  currentBusinessId?: string;
  userSession: UserSession;
  franchises: FranchiseUnit[];
  businesses: Business[];
  manualEntries: ManualEntry[];
  intercompanyRules?: IntercompanyRule[];
  bills: BillItem[];
  onCreateEntry: (entry: Partial<ManualEntry>) => Promise<void>;
  onCreateEntriesBulk: (entries: Array<Partial<ManualEntry>>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onUpdateEntry: (id: string, patch: Partial<ManualEntry>) => Promise<void>;
  onSaveBills: (bills: BillItem[]) => Promise<void>;
  vtConfigs: Record<string, VTConfig>;
  onSaveVtConfig: (tenantId: string, config: VTConfig) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
  initialTab?: PagamentoSubTab;
}

export const PagamentosDespesasScreen: React.FC<PagamentosDespesasScreenProps> = ({
  currentTenantId,
  currentBusinessId,
  userSession,
  franchises,
  businesses,
  manualEntries,
  intercompanyRules = [],
  bills,
  onCreateEntry,
  onCreateEntriesBulk,
  onDeleteEntry,
  onUpdateEntry,
  onSaveBills,
  vtConfigs,
  onSaveVtConfig,
  onNavigate,
  initialTab = "rp",
}) => {
  const [activeTab, setActiveTab] = useState<PagamentoSubTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const tabs: {
    id: PagamentoSubTab;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "rp",
      label: "Rotinas",
      subtitle: "Contas a pagar & vencimentos",
      icon: <Cog className="h-4 w-4" />,
    },
    {
      id: "conciliation",
      label: "Conciliação Bancária",
      subtitle: "Extrato OFX & conciliação",
      icon: <ArrowLeftRight className="h-4 w-4" />,
    },
    {
      id: "lancamentos",
      label: "Lançamentos",
      subtitle: "Entradas e despesas manuais",
      icon: <FilePenLine className="h-4 w-4" />,
    },
    {
      id: "vt",
      label: "VT",
      subtitle: "Vale Transporte & CLT 6%",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      {/* Top Banner & Module Header */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white px-4 py-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3c63da]/10 text-[#3c63da]">
                <CreditCard className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#152238]">
                Pagamentos / Despesas
              </h2>
            </div>

            {/* Inline Screen Switcher Buttons */}
            <div className="flex flex-wrap items-center gap-1 bg-[#f8faff] p-1 rounded-xl border border-[#e5eaf1]">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (onNavigate) onNavigate(tab.id);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#3c63da] text-white shadow-xs"
                        : "text-[#526078] hover:text-[#152238] hover:bg-white"
                    }`}
                    title={tab.subtitle}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <span className="text-xs text-[#69778c] flex items-center gap-1.5 bg-[#f8faff] border border-[#e5eaf1] px-3 py-1.5 rounded-xl font-medium">
              <Building2 className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Unidade: <strong className="uppercase">{currentTenantId}</strong></span>
            </span>
          </div>
        </div>
      </div>

      {/* Screen Container */}
      <div className="transition-all duration-150">
        {activeTab === "rp" && (
          <RpScreen
            currentTenantId={currentTenantId}
            bills={bills}
            onSaveBills={onSaveBills}
            onNavigate={onNavigate}
          />
        )}

        {activeTab === "conciliation" && (
          <ConciliationScreen
            currentTenantId={currentTenantId}
            currentBusinessId={currentBusinessId}
            manualEntries={manualEntries}
            intercompanyRules={intercompanyRules}
            userSession={userSession}
            onNavigate={onNavigate}
            onImportEntries={onCreateEntriesBulk}
            onUpdateEntry={onUpdateEntry}
            onDeleteEntry={onDeleteEntry}
            bills={bills}
            onSaveBills={onSaveBills}
            onCreateEntry={onCreateEntry}
          />
        )}

        {activeTab === "lancamentos" && (
          <LancamentosScreen
            currentTenantId={currentTenantId}
            franchises={franchises}
            businesses={businesses}
            manualEntries={manualEntries}
            onCreateEntry={onCreateEntry}
            onDeleteEntry={onDeleteEntry}
            onNavigate={onNavigate}
          />
        )}

        {activeTab === "vt" && (
          <VtScreen
            currentTenantId={currentTenantId}
            vtConfigs={vtConfigs}
            onSaveVtConfig={onSaveVtConfig}
            onNavigate={onNavigate}
            userSession={userSession}
            manualEntries={manualEntries}
            onCreateEntry={onCreateEntry}
          />
        )}
      </div>
    </div>
  );
};
