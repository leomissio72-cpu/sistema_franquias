import React, { useMemo, useState } from "react";
import { Building2, Edit3, Plus, Save, Trash2, Truck, X } from "lucide-react";
import { Business, FranchiseUnit, RegisteredSupplier, UserSession } from "../types";

interface SupplierManagerProps {
  suppliers: RegisteredSupplier[];
  businesses: Business[];
  franchises: FranchiseUnit[];
  userSession?: UserSession | null;
  currentBusinessId?: string;
  currentTenantId?: string;
  onSaveSuppliers: (suppliers: RegisteredSupplier[]) => Promise<void>;
  compact?: boolean;
}

type SupplierForm = {
  name: string;
  tradeName: string;
  document: string;
  contact: string;
  city: string;
  categories: string;
  status: RegisteredSupplier["status"];
  businessId: string;
  tenantId: string;
};

const blankForm: SupplierForm = {
  name: "",
  tradeName: "",
  document: "",
  contact: "",
  city: "",
  categories: "",
  status: "ativo",
  businessId: "",
  tenantId: "",
};

export const SupplierManager: React.FC<SupplierManagerProps> = ({
  suppliers,
  businesses,
  franchises,
  userSession,
  currentBusinessId = "all",
  currentTenantId = "dono",
  onSaveSuppliers,
  compact = false,
}) => {
  const [form, setForm] = useState<SupplierForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const profile = userSession?.profile || userSession?.login || "";
  const canEdit = ["dono", "admin", "equipe"].includes(profile);

  const visibleFranchises = useMemo(() => {
    if (!form.businessId) return franchises;
    return franchises.filter((franchise) => franchise.businessId === form.businessId);
  }, [form.businessId, franchises]);

  const scopedSuppliers = useMemo(() => suppliers.filter((supplier) => {
    const isUnscoped = !supplier.businessId && !supplier.tenantId;
    if (currentTenantId && currentTenantId !== "dono" && !currentTenantId.startsWith("biz")) {
      const unit = franchises.find((franchise) => franchise.id === currentTenantId);
      return supplier.tenantId === currentTenantId || supplier.businessId === unit?.businessId || isUnscoped;
    }
    if (currentBusinessId && currentBusinessId !== "all") {
      return supplier.businessId === currentBusinessId || isUnscoped;
    }
    return true;
  }), [currentBusinessId, currentTenantId, franchises, suppliers]);

  const openNew = () => {
    const scopedBusiness = currentBusinessId !== "all"
      ? currentBusinessId
      : currentTenantId.startsWith("biz")
        ? currentTenantId
        : franchises.find((franchise) => franchise.id === currentTenantId)?.businessId || "";
    const scopedTenant = currentTenantId !== "dono" && !currentTenantId.startsWith("biz") ? currentTenantId : "";
    setEditingId(null);
    setForm({ ...blankForm, businessId: scopedBusiness, tenantId: scopedTenant });
    setMessage("");
    setError("");
    setIsOpen(true);
  };

  const openEdit = (supplier: RegisteredSupplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      tradeName: supplier.tradeName || "",
      document: supplier.document || "",
      contact: supplier.contact || "",
      city: supplier.city || "",
      categories: supplier.categories?.join(", ") || "",
      status: supplier.status,
      businessId: supplier.businessId || "",
      tenantId: supplier.tenantId || "",
    });
    setMessage("");
    setError("");
    setIsOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit) {
      setError("Apenas Administrador ou Dono da Rede pode cadastrar fornecedores.");
      return;
    }
    if (!form.name.trim()) {
      setError("Informe o nome do fornecedor.");
      return;
    }
    if (form.tenantId && form.businessId) {
      const unit = franchises.find((franchise) => franchise.id === form.tenantId);
      if (unit && unit.businessId !== form.businessId) {
        setError("A franquia selecionada não pertence ao negócio escolhido.");
        return;
      }
    }

    const supplier: RegisteredSupplier = {
      id: editingId || `supplier_${Date.now()}`,
      name: form.name.trim(),
      tradeName: form.tradeName.trim() || undefined,
      document: form.document.trim() || undefined,
      contact: form.contact.trim() || undefined,
      city: form.city.trim() || undefined,
      categories: form.categories.split(",").map((item) => item.trim()).filter(Boolean),
      status: form.status,
      businessId: form.businessId || undefined,
      tenantId: form.tenantId || undefined,
    };
    const next = editingId
      ? suppliers.map((item) => item.id === editingId ? supplier : item)
      : [...suppliers, supplier];

    setSaving(true);
    setError("");
    try {
      await onSaveSuppliers(next);
      setIsOpen(false);
      setMessage(editingId ? "Fornecedor atualizado e salvo." : "Fornecedor cadastrado e salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o fornecedor.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (supplier: RegisteredSupplier) => {
    if (!canEdit || !window.confirm(`Excluir o fornecedor ${supplier.name}?`)) return;
    setSaving(true);
    setError("");
    try {
      await onSaveSuppliers(suppliers.filter((item) => item.id !== supplier.id));
      setMessage("Fornecedor excluído e removido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o fornecedor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={compact ? "space-y-4" : "rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs space-y-5"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#17211f]"><Truck className="h-4 w-4 text-[#0f4c5c]" />Fornecedores por negócio e franquia</h3>
          <p className="mt-1 text-xs text-[#5e6b67]">Cadastre, edite ou exclua fornecedores. O vínculo selecionado limita onde eles aparecem.</p>
        </div>
        {canEdit && <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0f4c5c] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0b3b48]"><Plus className="h-4 w-4" />Novo fornecedor</button>}
      </div>
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{error}</div>}

      {isOpen && <form onSubmit={save} className="rounded-xl border border-[#bcd1ff] bg-[#f6f9ff] p-4 space-y-3">
        <div className="flex items-center justify-between"><h4 className="text-xs font-extrabold text-[#0b3b48]">{editingId ? "Editar fornecedor" : "Cadastrar fornecedor"}</h4><button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-1 text-[#5e6b67] hover:bg-white"><X className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Razão social / nome *" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
          <Field label="Nome fantasia" value={form.tradeName} onChange={(value) => setForm({ ...form, tradeName: value })} />
          <Field label="CNPJ / documento" value={form.document} onChange={(value) => setForm({ ...form, document: value })} />
          <Field label="Contato / telefone / e-mail" value={form.contact} onChange={(value) => setForm({ ...form, contact: value })} />
          <Field label="Cidade" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
          <Field label="Categorias (separe por vírgula)" value={form.categories} onChange={(value) => setForm({ ...form, categories: value })} />
          <label className="space-y-1 text-[11px] font-bold text-[#4a5753]">Negócio / marca<select value={form.businessId} onChange={(event) => setForm({ ...form, businessId: event.target.value, tenantId: "" })} className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-3 py-2 text-xs font-semibold text-[#17211f]"><option value="">Todos os negócios / geral</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
          <label className="space-y-1 text-[11px] font-bold text-[#4a5753]">Franquia / unidade<select value={form.tenantId} onChange={(event) => setForm({ ...form, tenantId: event.target.value })} className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-3 py-2 text-xs font-semibold text-[#17211f]"><option value="">Todas as franquias do negócio</option>{visibleFranchises.map((franchise) => <option key={franchise.id} value={franchise.id}>{franchise.name} ({franchise.code})</option>)}</select></label>
          <label className="space-y-1 text-[11px] font-bold text-[#4a5753]">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-3 py-2 text-xs font-semibold text-[#17211f]"><option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="pendente">Pendente</option></select></label>
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsOpen(false)} className="rounded-xl border border-[#dfe4df] bg-white px-3 py-2 text-xs font-bold text-[#4a5753]">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f4c5c] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"><Save className="h-3.5 w-3.5" />{saving ? "Salvando..." : "Salvar fornecedor"}</button></div>
      </form>}

      {scopedSuppliers.length === 0 ? <div className="rounded-xl border border-dashed border-[#c9d1cb] bg-[#f7f9f7] p-8 text-center text-xs text-[#5e6b67]">Nenhum fornecedor cadastrado neste escopo.</div> : <div className="overflow-x-auto rounded-xl border border-[#dfe4df]"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-[#f7f9f7] text-[10px] text-[#5e6b67]"><tr><th className="px-3 py-3">Fornecedor</th><th className="px-3 py-3">Documento</th><th className="px-3 py-3">Contato</th><th className="px-3 py-3">Vínculo</th><th className="px-3 py-3">Categorias</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Ações</th></tr></thead><tbody className="divide-y divide-[#f0f3f0]">{scopedSuppliers.map((supplier) => { const unit = franchises.find((franchise) => franchise.id === supplier.tenantId); const business = businesses.find((item) => item.id === supplier.businessId); return <tr key={supplier.id} className="hover:bg-[#f7f9f7]"><td className="px-3 py-3"><div className="font-extrabold text-[#17211f]">{supplier.name}</div><div className="text-[10px] text-[#5e6b67]">{supplier.tradeName || "Sem nome fantasia"}</div></td><td className="px-3 py-3 font-mono text-[11px] text-[#5e6b67]">{supplier.document || "—"}</td><td className="px-3 py-3 text-[#3a4743]">{supplier.contact || "—"}<div className="text-[10px] text-[#5e6b67]">{supplier.city || "Cidade não informada"}</div></td><td className="px-3 py-3 text-[#3a4743]"><div>{unit ? unit.name : business ? business.name : "Rede geral"}</div>{unit && <div className="text-[10px] text-[#5e6b67]">{business?.name || "Negócio"}</div>}</td><td className="px-3 py-3 text-[#3a4743]">{supplier.categories?.join(", ") || "—"}</td><td className="px-3 py-3"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{supplier.status}</span></td><td className="px-3 py-3"><div className="flex gap-1"><button type="button" disabled={!canEdit} onClick={() => openEdit(supplier)} className="rounded-lg p-2 text-[#0f4c5c] hover:bg-[#e3eff1] disabled:opacity-40" aria-label={`Editar ${supplier.name}`}><Edit3 className="h-3.5 w-3.5" /></button><button type="button" disabled={!canEdit || saving} onClick={() => void remove(supplier)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40" aria-label={`Excluir ${supplier.name}`}><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>; })}</tbody></table></div>}
    </section>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; required?: boolean }> = ({ label, value, onChange, required }) => <label className="space-y-1 text-[11px] font-bold text-[#4a5753]">{label}<input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-3 py-2 text-xs font-semibold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none" /></label>;

export default SupplierManager;
