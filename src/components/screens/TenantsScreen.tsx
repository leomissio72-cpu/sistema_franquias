import React, { useState } from "react";
import { FranchiseUnit, Business, ScreenType } from "../../types";
import { formatBrl } from "../../utils/calculations";
import { Store, Plus, Search, ExternalLink, MapPin, Phone, Mail, Building2 } from "lucide-react";

interface TenantsScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  onSelectTenant: (tenantId: string) => void;
  onNavigate: (screen: ScreenType) => void;
}

export const TenantsScreen: React.FC<TenantsScreenProps> = ({
  franchises,
  businesses,
  onSelectTenant,
  onNavigate,
}) => {
  const [search, setSearch] = useState("");
  const [bizFilter, setBizFilter] = useState("all");

  const filtered = franchises.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase()) ||
      f.resp.toLowerCase().includes(search.toLowerCase()) ||
      f.city.toLowerCase().includes(search.toLowerCase());
    const matchesBiz = bizFilter === "all" || f.businessId === bizFilter;
    return matchesSearch && matchesBiz;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Cadastro de Unidades & Lojas
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <Store className="h-6 w-6 text-[#3c63da]" />
            Franqueados e Unidades ({franchises.length})
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Gestão completa das lojas físicas, quiosques e unidades da rede de franquias.
          </p>
        </div>

        <button
          onClick={() => onNavigate("network")}
          className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer"
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Ver na Visão Geral da Rede</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#69778c]" />
          <input
            type="text"
            placeholder="Buscar por nome, código, responsável ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#e5eaf1] bg-white pl-9 pr-3 py-2 text-xs font-medium text-[#152238] focus:border-[#3c63da] focus:outline-none shadow-xs"
          />
        </div>

        <select
          value={bizFilter}
          onChange={(e) => setBizFilter(e.target.value)}
          className="rounded-xl border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none shadow-xs"
        >
          <option value="all">Todos os Modelos de Negócio</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid of Units */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((f) => {
          const biz = businesses.find((b) => b.id === f.businessId);
          return (
            <div
              key={f.id}
              className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs hover:border-[#3c63da] hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-extrabold text-[#3c63da] bg-[#edf2ff] px-2 py-0.5 rounded-md">
                    {f.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      f.status === "green"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {f.status === "green" ? "Ativa & Regular" : "Requer Atenção"}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-[#152238]">{f.name}</h3>
                <span className="text-xs text-[#69778c] block mt-0.5">{biz?.name}</span>

                <div className="mt-3 space-y-1.5 text-xs text-[#69778c]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#3c63da]" />
                    <span>{f.city}{f.state ? `, ${f.state}` : ` (${f.region})`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-[#69778c]" />
                    <span>{f.email || `contato@${f.code.toLowerCase()}.com`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[#69778c]" />
                    <span>{f.phone || "(11) 3456-7890"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#e5eaf1] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#69778c] block uppercase font-extrabold">
                    Faturamento
                  </span>
                  <b className="text-sm font-extrabold text-[#152238] font-mono">
                    {formatBrl(f.faturamento)}
                  </b>
                </div>

                <button
                  onClick={() => {
                    onSelectTenant(f.id);
                    onNavigate("dre");
                  }}
                  className="flex items-center gap-1 rounded-lg border border-[#e5eaf1] bg-[#f8faff] px-3 py-1.5 text-xs font-bold text-[#3c63da] hover:bg-[#edf2ff] transition-all cursor-pointer"
                >
                  <span>Abrir Loja</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
