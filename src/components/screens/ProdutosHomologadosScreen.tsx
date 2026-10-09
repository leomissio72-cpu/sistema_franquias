import React, { useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Filter,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { HomologatedProduct, RegisteredSupplier, UserSession } from "../../types";
import SupplierManager from "../SupplierManager";
import { Business, FranchiseUnit } from "../../types";

interface ProdutosHomologadosScreenProps {
  products?: HomologatedProduct[];
  suppliers?: RegisteredSupplier[];
  userSession?: UserSession | null;
  businesses?: Business[];
  franchises?: FranchiseUnit[];
  currentBusinessId?: string;
  currentTenantId?: string;
  onSaveSuppliers?: (suppliers: RegisteredSupplier[]) => Promise<void>;
}

type CatalogTab = "produtos" | "fornecedores";

export const ProdutosHomologadosScreen: React.FC<ProdutosHomologadosScreenProps> = ({
  products = [],
  suppliers = [],
  userSession,
  businesses = [],
  franchises = [],
  currentBusinessId = "all",
  currentTenantId = "dono",
  onSaveSuppliers,
}) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>("produtos");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");
  const [status, setStatus] = useState("todos");

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      const matchesSearch = !normalized || [product.name, product.sku, product.category, product.supplierName]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("pt-BR").includes(normalized));
      const matchesCategory = category === "todas" || product.category === category;
      const matchesStatus = status === "todos" || product.status === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [category, products, search, status]);

  const filteredSuppliers = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return suppliers.filter((supplier) => {
      const matchesSearch = !normalized || [supplier.name, supplier.document, supplier.city, supplier.contact]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("pt-BR").includes(normalized));
      const matchesStatus = status === "todos" || supplier.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [search, status, suppliers]);

  const clearFilters = () => {
    setSearch("");
    setCategory("todas");
    setStatus("todos");
  };

  const hasData = activeTab === "produtos" ? products.length > 0 : suppliers.length > 0;
  const hasFilteredData = activeTab === "produtos" ? filteredProducts.length > 0 : filteredSuppliers.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold text-[#0f4c5c]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compras e padronização da rede
          </div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#17211f]">
            <PackageCheck className="h-6 w-6 text-[#0f4c5c]" />
            Fornecedores e Produtos Homologados
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#5e6b67]">
            Consulte os produtos aprovados pela franqueadora e os fornecedores cadastrados para compras padronizadas.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e3eff1] bg-[#e3eff1] px-3 py-2 text-[11px] font-bold text-[#0b3b48]">
          <Building2 className="h-4 w-4" />
          {userSession?.profile === "franqueado" || userSession?.profile === "operador" ? "Consulta da unidade" : "Catálogo da rede"}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Produtos homologados" value={products.length} icon={<PackageCheck className="h-4 w-4" />} tone="blue" />
        <SummaryCard label="Fornecedores cadastrados" value={suppliers.length} icon={<Truck className="h-4 w-4" />} tone="violet" />
        <SummaryCard label="Produtos ativos" value={products.filter((product) => product.status === "ativo").length} icon={<BadgeCheck className="h-4 w-4" />} tone="green" />
      </section>

      <section className="rounded-2xl border border-[#dfe4df] bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-[#f7f9f7] p-1">
            <TabButton active={activeTab === "produtos"} onClick={() => { setActiveTab("produtos"); setSearch(""); setStatus("todos"); }} icon={<PackageCheck className="h-3.5 w-3.5" />}>
              Produtos
            </TabButton>
            <TabButton active={activeTab === "fornecedores"} onClick={() => { setActiveTab("fornecedores"); setSearch(""); setCategory("todas"); setStatus("todos"); }} icon={<Truck className="h-3.5 w-3.5" />}>
              Fornecedores
            </TabButton>
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93a09b]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={activeTab === "produtos" ? "Buscar produto, código ou fornecedor" : "Buscar fornecedor, CNPJ ou cidade"}
              className="w-full rounded-xl border border-[#dfe4df] bg-white py-2.5 pl-9 pr-3 text-xs font-semibold text-[#17211f] outline-none transition focus:border-[#0f4c5c] focus:ring-2 focus:ring-[#0f4c5c]/10"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#f0f3f0] pt-4">
          {activeTab === "produtos" && (
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-[#dfe4df] bg-white px-3 py-2 text-xs font-semibold text-[#3a4743] outline-none focus:border-[#0f4c5c]">
              <option value="todas">Todas as categorias</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          )}
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-[#dfe4df] bg-white px-3 py-2 text-xs font-semibold text-[#3a4743] outline-none focus:border-[#0f4c5c]">
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="pendente">Pendente</option>
          </select>
          {(search || category !== "todas" || status !== "todos") && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[#5e6b67] hover:bg-[#f0f3f0] hover:text-[#17211f]">
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
          <span className="ml-auto text-[11px] font-semibold text-[#93a09b]">
            {hasData ? `${activeTab === "produtos" ? filteredProducts.length : filteredSuppliers.length} resultado(s)` : "Catálogo sem registros"}
          </span>
        </div>

        {activeTab === "fornecedores" && onSaveSuppliers ? (
          <div className="mt-4">
            <SupplierManager suppliers={suppliers} businesses={businesses} franchises={franchises} currentBusinessId={currentBusinessId} currentTenantId={currentTenantId} userSession={userSession} onSaveSuppliers={onSaveSuppliers} compact />
          </div>
        ) : !hasData ? (
          <EmptyCatalog type={activeTab} />
        ) : !hasFilteredData ? (
          <div className="py-14 text-center">
            <Filter className="mx-auto h-8 w-8 text-[#93a09b]" />
            <h3 className="mt-3 text-sm font-extrabold text-[#17211f]">Nenhum resultado encontrado</h3>
            <p className="mt-1 text-xs text-[#5e6b67]">Altere os filtros ou limpe a busca para consultar o catálogo completo.</p>
          </div>
        ) : activeTab === "produtos" ? (
          <ProductsTable products={filteredProducts} />
        ) : (
          <SuppliersTable suppliers={filteredSuppliers} />
        )}
      </section>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; icon: React.ReactNode; tone: "blue" | "violet" | "green" }> = ({ label, value, icon, tone }) => {
  const colors = { blue: "bg-blue-50 text-blue-700", violet: "bg-violet-50 text-violet-700", green: "bg-emerald-50 text-emerald-700" };
  return <div className="rounded-2xl border border-[#dfe4df] bg-white p-4 shadow-xs"><div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${colors[tone]}`}>{icon}</div><div className="text-2xl font-extrabold text-[#17211f]">{value}</div><div className="mt-0.5 text-[11px] font-semibold text-[#5e6b67]">{label}</div></div>;
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }> = ({ active, onClick, icon, children }) => (
  <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition ${active ? "bg-[#0f4c5c] text-white shadow-sm" : "text-[#5e6b67] hover:bg-white hover:text-[#17211f]"}`}>
    {icon}{children}
  </button>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const styles = status === "ativo" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : status === "pendente" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold capitalize ${styles}`}>{status}</span>;
};

const ProductsTable: React.FC<{ products: HomologatedProduct[] }> = ({ products }) => (
  <div className="mt-4 overflow-x-auto rounded-xl border border-[#dfe4df]">
    <table className="w-full min-w-[760px] text-left text-xs">
      <thead className="bg-[#f7f9f7] text-[10px] text-[#5e6b67]"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Status</th></tr></thead>
      <tbody className="divide-y divide-[#f0f3f0]">{products.map((product) => <tr key={product.id} className="hover:bg-[#f7f9f7]"><td className="px-4 py-3"><div className="font-extrabold text-[#17211f]">{product.name}</div>{product.brand && <div className="mt-0.5 text-[10px] text-[#5e6b67]">{product.brand}</div>}</td><td className="px-4 py-3 text-[#3a4743]">{product.category}</td><td className="px-4 py-3 font-semibold text-[#3a4743]">{product.supplierName}</td><td className="px-4 py-3 font-mono text-[11px] text-[#5e6b67]">{product.sku || "—"}</td><td className="px-4 py-3 text-[#3a4743]">{product.unit || "—"}</td><td className="px-4 py-3"><StatusPill status={product.status} /></td></tr>)}</tbody>
    </table>
  </div>
);

const SuppliersTable: React.FC<{ suppliers: RegisteredSupplier[] }> = ({ suppliers }) => (
  <div className="mt-4 overflow-x-auto rounded-xl border border-[#dfe4df]">
    <table className="w-full min-w-[700px] text-left text-xs">
      <thead className="bg-[#f7f9f7] text-[10px] text-[#5e6b67]"><tr><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">CNPJ / documento</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Cidade</th><th className="px-4 py-3">Categorias</th><th className="px-4 py-3">Status</th></tr></thead>
      <tbody className="divide-y divide-[#f0f3f0]">{suppliers.map((supplier) => <tr key={supplier.id} className="hover:bg-[#f7f9f7]"><td className="px-4 py-3"><div className="font-extrabold text-[#17211f]">{supplier.name}</div>{supplier.tradeName && <div className="mt-0.5 text-[10px] text-[#5e6b67]">{supplier.tradeName}</div>}</td><td className="px-4 py-3 font-mono text-[11px] text-[#5e6b67]">{supplier.document || "—"}</td><td className="px-4 py-3 text-[#3a4743]">{supplier.contact || "—"}</td><td className="px-4 py-3 text-[#3a4743]">{supplier.city || "—"}</td><td className="px-4 py-3 text-[#3a4743]">{supplier.categories?.join(", ") || "—"}</td><td className="px-4 py-3"><StatusPill status={supplier.status} /></td></tr>)}</tbody>
    </table>
  </div>
);

const EmptyCatalog: React.FC<{ type: CatalogTab }> = ({ type }) => (
  <div className="my-5 rounded-2xl border border-dashed border-[#c9d1cb] bg-[#f7f9f7] px-5 py-14 text-center">
    {type === "produtos" ? <PackageCheck className="mx-auto h-9 w-9 text-[#93a09b]" /> : <Truck className="mx-auto h-9 w-9 text-[#93a09b]" />}
    <h3 className="mt-3 text-sm font-extrabold text-[#17211f]">Nenhum {type === "produtos" ? "produto homologado" : "fornecedor cadastrado"} disponível</h3>
    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#5e6b67]">O catálogo ainda não possui registros reais cadastrados. Esta tela está pronta para consultar os dados assim que a base for preenchida.</p>
  </div>
);

export default ProdutosHomologadosScreen;
