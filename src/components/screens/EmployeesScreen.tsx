import React, { useState } from "react";
import { Employee, ScreenType, FranchiseUnit } from "../../types";
import { formatBrl2 } from "../../utils/calculations";
import { Users2, Plus, Search, Trash2, Mail, Phone, Building } from "lucide-react";

interface EmployeesScreenProps {
  currentTenantId: string;
  franchises: FranchiseUnit[];
  onNavigate: (screen: ScreenType) => void;
}

export const EmployeesScreen: React.FC<EmployeesScreenProps> = ({
  currentTenantId,
  franchises,
  onNavigate,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([
    { id: "e1", nome: "Renata Souza", cargo: "Gerente Geral", unidade: "f001", matricula: "0012", email: "renata@jardins.com", phone: "(11) 98765-4321", salary: 5500, vt: true, active: true },
    { id: "e2", nome: "Carlos Eduardo", cargo: "Atendente Sênior", unidade: "f001", matricula: "0018", email: "carlos@jardins.com", phone: "(11) 98765-4322", salary: 2800, vt: true, active: true },
    { id: "e3", nome: "Mariana Costa", cargo: "Caixa / Operações", unidade: "f002", matricula: "0021", email: "mariana@moema.com", phone: "(11) 98765-4323", salary: 2600, vt: true, active: true },
    { id: "e4", nome: "Felipe Andrade", cargo: "Supervisor Regional", unidade: "dono", matricula: "0001", email: "felipe@sofiacfo.com", phone: "(11) 99999-8888", salary: 8200, vt: false, active: true },
  ]);

  const [search, setSearch] = useState("");

  const getUnitName = (unidadeId: string) => {
    if (unidadeId === "dono") return "Rede Consolidada (Matriz)";
    const found = franchises.find((f) => f.id === unidadeId);
    return found ? found.name : unidadeId;
  };

  const filtered = employees.filter(
    (e) =>
      e.nome.toLowerCase().includes(search.toLowerCase()) ||
      e.cargo.toLowerCase().includes(search.toLowerCase()) ||
      getUnitName(e.unidade).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Quadro de Pessoal
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <Users2 className="h-6 w-6 text-[#3c63da]" />
            Colaboradores & Funcionários ({employees.length})
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Quadro de funcionários por loja, cargos, salários e controle de admissões.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#69778c]" />
        <input
          type="text"
          placeholder="Buscar colaborador por nome, cargo ou unidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[#e5eaf1] bg-white pl-9 pr-3 py-2 text-xs font-medium text-[#152238] focus:border-[#3c63da] focus:outline-none shadow-xs"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                <th className="p-3">Colaborador</th>
                <th className="p-3">Cargo / Função</th>
                <th className="p-3">Unidade Vinculada</th>
                <th className="p-3">Contato</th>
                <th className="p-3 text-right">Salário Base</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5eaf1]">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#f8faff]">
                  <td className="p-3">
                    <b className="text-[#152238] block">{emp.nome}</b>
                    <span className="text-[10px] text-[#69778c]">{emp.email}</span>
                  </td>
                  <td className="p-3 font-semibold text-[#152238]">{emp.cargo}</td>
                  <td className="p-3 text-[#69778c]">{getUnitName(emp.unidade)}</td>
                  <td className="p-3 text-[#69778c]">{emp.phone || "—"}</td>
                  <td className="p-3 text-right font-mono font-bold text-[#152238]">
                    {formatBrl2(emp.salary || 0)}
                  </td>
                  <td className="p-3 text-right">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold rounded-full">
                      Ativo
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
