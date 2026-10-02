import React, { useState } from "react";
import { FranchiseUnit, Business, ScreenType } from "../../types";
import { formatBrl } from "../../utils/calculations";
import {
  Store,
  Plus,
  Search,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  Building2,
  X,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface TenantsScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  onSelectTenant: (tenantId: string) => void;
  onNavigate: (screen: ScreenType) => void;
  onSaveFranchises?: (franchises: FranchiseUnit[]) => Promise<void>;
  onSaveBusinesses?: (businesses: Business[]) => Promise<void>;
}

export const TenantsScreen: React.FC<TenantsScreenProps> = ({
  franchises,
  businesses,
  onSelectTenant,
  onNavigate,
  onSaveFranchises,
  onSaveBusinesses,
}) => {
  const [search, setSearch] = useState("");
  const [bizFilter, setBizFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick inline brand creation inside the modal
  const [isAddingBrandInline, setIsAddingBrandInline] = useState(false);
  const [inlineBrandName, setInlineBrandName] = useState("");
  const [inlineBrandRoyalty, setInlineBrandRoyalty] = useState("6.0");
  const [inlineBrandColor, setInlineBrandColor] = useState("#3c63da");

  // Form fields
  const [form, setForm] = useState({
    businessId: businesses[0]?.id || "",
    name: "",
    code: "",
    resp: "",
    city: "São Paulo - SP",
    address: "Av. Principal, 1000",
    faturamento: 50000,
    email: "",
    phone: "(11) 3456-7890",
  });

  const openAddModal = () => {
    const autoCode = `F${String(franchises.length + 1).padStart(3, "0")}`;
    setForm({
      businessId: businesses[0]?.id || "biz_padrao",
      name: "",
      code: autoCode,
      resp: "",
      city: "São Paulo - SP",
      address: "Av. Principal, 1000",
      faturamento: 50000,
      email: "",
      phone: "(11) 3456-7890",
    });
    setFormError("");
    setIsAddingBrandInline(false);
    setShowAddModal(true);
  };

  const handleCreateInlineBrand = async () => {
    if (!inlineBrandName.trim()) return;
    const cleanId = inlineBrandName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/^_+|_+$/g, "") || `biz_${Date.now()}`;

    const newBiz: Business = {
      id: cleanId,
      name: inlineBrandName.trim(),
      brand: inlineBrandName.trim(),
      color: inlineBrandColor || "#3c63da",
      royalty: (Number(inlineBrandRoyalty) || 6) / 100,
    };

    const nextBusinesses = [...businesses.filter((b) => b.id !== cleanId), newBiz];
    if (onSaveBusinesses) {
      onSaveBusinesses(nextBusinesses).catch((e) => console.error("Erro salvando marca:", e));
    }
    setForm((prev) => ({ ...prev, businessId: cleanId }));
    setIsAddingBrandInline(false);
    setInlineBrandName("");
  };

  const handleQuickAddFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = (form.name || "").trim();
    if (!cleanName) {
      setFormError("Por favor, digite o nome da nova franquia / franqueado.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    const autoCode = `F${String(franchises.length + 1).padStart(3, "0")}`;
    const cleanCode = (form.code || "").trim().toUpperCase() || autoCode;
    const effectiveBizId = form.businessId || businesses[0]?.id || "biz_padrao";

    const newUnit: FranchiseUnit = {
      id: `f_${Date.now()}`,
      businessId: effectiveBizId,
      name: cleanName,
      code: cleanCode,
      resp: (form.resp || "").trim() || cleanName,
      address: (form.address || "").trim() || "Endereço comercial",
      city: (form.city || "").trim() || "São Paulo - SP",
      region: "Sudeste",
      lat: -23.5505 + (Math.random() - 0.5) * 0.05,
      lng: -46.6333 + (Math.random() - 0.5) * 0.05,
      faturamento: Number(form.faturamento) > 0 ? Number(form.faturamento) : 50000,
      pendencias: 0,
      rpDone: 5,
      status: "green",
      email: (form.email || "").trim() || `contato@${cleanCode.toLowerCase()}.com`,
      phone: (form.phone || "").trim() || "(11) 3456-7890",
    };

    // 1. Optimistic instant addition - ZERO DELAY
    const updatedList = [...franchises, newUnit];
    setShowAddModal(false);
    setIsSubmitting(false);
    setSuccessMsg(`Novo franqueado "${newUnit.name}" (${newUnit.code}) cadastrado com sucesso!`);
    setTimeout(() => setSuccessMsg(""), 4500);

    // 2. Background cloud persistence
    if (onSaveFranchises) {
      try {
        await onSaveFranchises(updatedList);
      } catch (err: any) {
        console.error("Falha ao sincronizar franquia:", err);
      }
    }
  };

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
      {/* Top Banner */}
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Main Action: Cadastrar Novo Franqueado */}
          <button
            id="btn-cadastrar-novo-franqueado"
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] hover:bg-[#2f52c0] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar Novo Franqueado</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("network")}
            className="flex items-center gap-1.5 rounded-xl border border-[#e5eaf1] bg-white px-3.5 py-2.5 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] shadow-2xs transition-all cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>Visão da Rede</span>
          </button>
        </div>
      </div>

      {/* Success alert message */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

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
              {b.name || b.brand}
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
                <span className="text-xs text-[#69778c] block mt-0.5">{biz?.name || biz?.brand || "Franquia"}</span>

                <div className="mt-3 space-y-1.5 text-xs text-[#69778c]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#3c63da]" />
                    <span>{f.city}{f.state ? `, ${f.state}` : ` (${f.region || "Brasil"})`}</span>
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
                  type="button"
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

      {/* Modal: Cadastrar Novo Franqueado (Ultra-Fast, Instant UI) */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#152238]/50 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-[#dbe4ef] overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5eaf1] bg-[#f8faff]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#edf2ff] text-[#3c63da]">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#152238]">
                    Cadastrar Novo Franqueado
                  </h3>
                  <p className="text-[11px] text-[#69778c]">
                    Cadastro ágil com sincronização instantânea em toda a rede.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-[#69778c] hover:bg-white hover:text-[#152238] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddFranchise} className="p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Nome da Franquia */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#152238] mb-1">
                    Nome da Loja / Franqueado *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Café Bela Vista Paulista"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-[#dbe4ef] bg-[#f8faff] px-3.5 py-2.5 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                {/* Modelo / Marca */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#152238]">
                      Modelo / Marca Vinculada *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingBrandInline(!isAddingBrandInline)}
                      className="text-[11px] font-bold text-[#3c63da] hover:underline cursor-pointer"
                    >
                      {isAddingBrandInline ? "Cancelar Nova Marca" : "+ Nova Marca Rápida"}
                    </button>
                  </div>

                  {isAddingBrandInline ? (
                    <div className="p-3 rounded-xl border border-[#3c63da] bg-[#edf2ff]/30 space-y-2.5">
                      <div className="text-[11px] font-extrabold text-[#3c63da] uppercase">
                        Cadastrar Nova Marca / Modelo
                      </div>
                      <input
                        type="text"
                        placeholder="Nome da Marca (Ex: Quiosque Express)"
                        value={inlineBrandName}
                        onChange={(e) => setInlineBrandName(e.target.value)}
                        className="w-full rounded-lg border border-[#c4cdd9] bg-white px-3 py-1.5 text-xs font-bold"
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="Royalty % (Ex: 6.0)"
                            value={inlineBrandRoyalty}
                            onChange={(e) => setInlineBrandRoyalty(e.target.value)}
                            className="w-full rounded-lg border border-[#c4cdd9] bg-white px-3 py-1.5 text-xs font-bold"
                          />
                        </div>
                        <input
                          type="color"
                          value={inlineBrandColor}
                          onChange={(e) => setInlineBrandColor(e.target.value)}
                          className="h-8 w-10 rounded border border-[#c4cdd9] p-0.5 cursor-pointer bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleCreateInlineBrand}
                          className="px-3 py-1.5 rounded-lg bg-[#3c63da] text-white text-xs font-bold hover:bg-[#2f52c0] cursor-pointer"
                        >
                          Salvar Marca
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={form.businessId}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setIsAddingBrandInline(true);
                        } else {
                          setForm({ ...form, businessId: e.target.value });
                        }
                      }}
                      className="w-full rounded-xl border border-[#dbe4ef] bg-[#f8faff] px-3.5 py-2.5 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none transition-all"
                    >
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.brand}
                        </option>
                      ))}
                      <option value="__new__">+ Cadastrar Novo Modelo/Marca...</option>
                    </select>
                  )}
                </div>

                {/* Código */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#152238]">Código da Franquia</label>
                    <span className="text-[10px] text-[#69778c]">Auto</span>
                  </div>
                  <input
                    type="text"
                    placeholder={`Ex: F${String(franchises.length + 1).padStart(3, "0")}`}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-xl border border-[#dbe4ef] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Responsável */}
                <div>
                  <label className="block text-xs font-bold text-[#152238] mb-1">
                    Responsável (Nome do Franqueado)
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do franqueado"
                    value={form.resp}
                    onChange={(e) => setForm({ ...form, resp: e.target.value })}
                    className="w-full rounded-xl border border-[#dbe4ef] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Cidade - UF */}
                <div>
                  <label className="block text-xs font-bold text-[#152238] mb-1">Cidade - UF</label>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo - SP"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-xl border border-[#dbe4ef] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Faturamento */}
                <div>
                  <label className="block text-xs font-bold text-[#152238] mb-1">
                    Faturamento Mensal Estimado (R$)
                  </label>
                  <input
                    type="number"
                    value={form.faturamento}
                    onChange={(e) => setForm({ ...form, faturamento: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#dbe4ef] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-xs font-bold text-[#152238] mb-1">E-mail de Contato</label>
                  <input
                    type="email"
                    placeholder="contato@franquia.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-[#dbe4ef] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-xs font-bold text-[#152238] mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 98765-4321"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-xl border border-[#dbe4ef] bg-[#f8faff] px-3.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#e5eaf1]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-[#dbe4ef] px-4 py-2 text-xs font-bold text-[#69778c] hover:bg-[#f8faff] hover:text-[#152238] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-confirm-add-franqueado"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] hover:bg-[#2f52c0] px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isSubmitting ? "Cadastrando..." : "Cadastrar Novo Franqueado"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
