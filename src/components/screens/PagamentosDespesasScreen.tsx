import React, { useState, useEffect } from "react";
import {
  ScreenType,
  FranchiseUnit,
  ManualEntry,
  VTConfig,
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
  franchises: FranchiseUnit[];
  manualEntries: ManualEntry[];
  onCreateEntry: (entry: Partial<ManualEntry>) => Promise<void>;
  onCreateEntriesBulk: (entries: Array<Partial<ManualEntry>>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  vtConfigs: Record<string, VTConfig>;
  onSaveVtConfig: (tenantId: string, config: VTConfig) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
  initialTab?: PagamentoSubTab;
}

export const PagamentosDespesasScreen: React.FC<PagamentosDespesasScreenProps> = ({
  currentTenantId,
  franchises,
  manualEntries,
  onCreateEntry,
  onCreateEntriesBulk,
  onDeleteEntry,
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
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner & Module Header */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da] flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Módulo Central de Pagamentos & Despesas</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
              Pagamentos / Despesas
            </h2>
            <p className="text-xs text-[#69778c] mt-1">
              Controle unificado de despesas operacionais da franquia. Alterne facilmente entre as telas abaixo:
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <span className="text-xs text-[#69778c] flex items-center gap-1.5 bg-[#f8faff] border border-[#e5eaf1] px-3 py-1.5 rounded-xl font-medium">
              <Building2 className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Unidade: <strong>{currentTenantId}</strong></span>
            </span>
          </div>
        </div>

        {/* Screen Switcher Buttons */}
        <div className="mt-5 pt-4 border-t border-[#e5eaf1]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] mb-2.5 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>Selecione a tela desejada:</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex flex-col items-start p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#edf2ff] border-[#3c63da] text-[#3c63da] shadow-xs ring-2 ring-[#3c63da]/15"
                      : "bg-[#f8faff] border-[#e5eaf1] text-[#152238] hover:bg-white hover:border-[#3c63da]/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        isActive
                          ? "bg-[#3c63da] text-white"
                          : "bg-white text-[#69778c] border border-[#e5eaf1] group-hover:text-[#3c63da]"
                      }`}
                    >
                      {tab.icon}
                    </div>
                    {isActive && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider bg-[#3c63da] text-white px-2 py-0.5 rounded-full">
                        Ativa
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-extrabold text-xs tracking-tight">
                    {tab.label}
                  </div>
                  <div className="text-[10px] text-[#69778c] line-clamp-1 mt-0.5">
                    {tab.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Screen Container */}
      <div className="transition-all duration-150">
        {activeTab === "rp" && (
          <RpScreen
            currentTenantId={currentTenantId}
            onNavigate={onNavigate}
          />
        )}

        {activeTab === "conciliation" && (
          <ConciliationScreen
            currentTenantId={currentTenantId}
            onNavigate={onNavigate}
            onImportEntries={onCreateEntriesBulk}
          />
        )}

        {activeTab === "lancamentos" && (
          <LancamentosScreen
            currentTenantId={currentTenantId}
            franchises={franchises}
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
          />
        )}
      </div>
    </div>
  );
};
