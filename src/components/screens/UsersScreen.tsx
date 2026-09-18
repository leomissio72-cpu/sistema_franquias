import React, { useState } from "react";
import { User, ScreenType } from "../../types";
import { defaultUsers } from "../../data/initialData";
import { UserCheck, Key, Shield, Plus, Lock, CheckCircle2 } from "lucide-react";

interface UsersScreenProps {
  onNavigate: (screen: ScreenType) => void;
}

export const UsersScreen: React.FC<UsersScreenProps> = ({ onNavigate }) => {
  const [users, setUsers] = useState<User[]>(defaultUsers);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Segurança & Autenticação
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <UserCheck className="h-6 w-6 text-[#3c63da]" />
            Usuários e Acessos ({users.length})
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Controle de credenciais de login, senhas criptografadas e permissões do sistema.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3">
          Credenciais Cadastradas
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                <th className="p-3">Nome / Usuário</th>
                <th className="p-3">Login de Acesso</th>
                <th className="p-3">Papel / Nível</th>
                <th className="p-3">Unidade Vinculada</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5eaf1]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#f8faff]">
                  <td className="p-3">
                    <b className="text-[#152238] block">{u.name}</b>
                  </td>
                  <td className="p-3 font-mono font-bold text-[#3c63da]">{u.username}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        u.role === "admin"
                          ? "bg-purple-50 text-purple-700"
                          : u.role === "team"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {u.role === "admin"
                        ? "Administrador (Dono)"
                        : u.role === "team"
                        ? "Equipe Matriz"
                        : "Franqueado"}
                    </span>
                  </td>
                  <td className="p-3 text-[#69778c]">{u.unitName || "Todas as Unidades (Rede)"}</td>
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
