import React, { useState, useRef, useEffect } from "react";
import {
  Calendar,
  ChevronDown,
  Check,
  CheckSquare,
  Square,
  RotateCcw,
  Sparkles,
  Layers,
} from "lucide-react";

export interface DateFilterSelection {
  years: number[];
  months: number[];
  days: number[];
}

interface DateMultiFilterProps {
  selection: DateFilterSelection;
  onChange: (newSelection: DateFilterSelection) => void;
  className?: string;
}

export const CURRENT_YEAR = new Date().getFullYear();
export const CURRENT_MONTH = new Date().getMonth() + 1;
export const AVAILABLE_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export const AVAILABLE_MONTHS = [
  { value: 1, label: "Janeiro", short: "Jan" },
  { value: 2, label: "Fevereiro", short: "Fev" },
  { value: 3, label: "Março", short: "Mar" },
  { value: 4, label: "Abril", short: "Abr" },
  { value: 5, label: "Maio", short: "Mai" },
  { value: 6, label: "Junho", short: "Jun" },
  { value: 7, label: "Julho", short: "Jul" },
  { value: 8, label: "Agosto", short: "Ago" },
  { value: 9, label: "Setembro", short: "Set" },
  { value: 10, label: "Outubro", short: "Out" },
  { value: 11, label: "Novembro", short: "Nov" },
  { value: 12, label: "Dezembro", short: "Dez" },
];

export const AVAILABLE_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export const DateMultiFilter: React.FC<DateMultiFilterProps> = ({
  selection,
  onChange,
  className = "",
}) => {
  const [openDropdown, setOpenDropdown] = useState<"year" | "month" | "day" | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Year Handlers ---
  const toggleYear = (year: number) => {
    let nextYears: number[];
    if (selection.years.includes(year)) {
      if (selection.years.length === 1) return; // keep at least one
      nextYears = selection.years.filter((y) => y !== year);
    } else {
      nextYears = [...selection.years, year].sort((a, b) => b - a);
    }
    onChange({ ...selection, years: nextYears });
  };

  const selectAllYears = () => {
    onChange({ ...selection, years: [...AVAILABLE_YEARS] });
  };

  const selectOnlyCurrentYear = () => {
    onChange({ ...selection, years: [CURRENT_YEAR] });
  };

  // --- Month Handlers ---
  const toggleMonth = (monthVal: number) => {
    let nextMonths: number[];
    if (selection.months.includes(monthVal)) {
      if (selection.months.length === 1) return; // keep at least one
      nextMonths = selection.months.filter((m) => m !== monthVal);
    } else {
      nextMonths = [...selection.months, monthVal].sort((a, b) => a - b);
    }
    onChange({ ...selection, months: nextMonths });
  };

  const selectAllMonths = () => {
    onChange({
      ...selection,
      months: AVAILABLE_MONTHS.map((m) => m.value),
    });
  };

  const selectCurrentMonth = () => {
    onChange({ ...selection, months: [CURRENT_MONTH] });
  };

  const selectQuarter = (quarter: number) => {
    const start = (quarter - 1) * 3 + 1;
    onChange({
      ...selection,
      months: [start, start + 1, start + 2],
    });
  };

  // --- Day Handlers ---
  const toggleDay = (day: number) => {
    let nextDays: number[];
    if (selection.days.includes(day)) {
      if (selection.days.length === 1) return; // keep at least one
      nextDays = selection.days.filter((d) => d !== day);
    } else {
      nextDays = [...selection.days, day].sort((a, b) => a - b);
    }
    onChange({ ...selection, days: nextDays });
  };

  const selectAllDays = () => {
    onChange({ ...selection, days: [...AVAILABLE_DAYS] });
  };

  const selectWeekdaysOnly = () => {
    // Dias úteis simulados (1 a 22 dias)
    onChange({ ...selection, days: Array.from({ length: 22 }, (_, i) => i + 1) });
  };

  const selectQuinzena = (q: 1 | 2) => {
    if (q === 1) {
      onChange({ ...selection, days: Array.from({ length: 15 }, (_, i) => i + 1) });
    } else {
      onChange({ ...selection, days: Array.from({ length: 16 }, (_, i) => i + 16) });
    }
  };

  // --- Labels formatters ---
  const getYearLabel = () => {
    if (selection.years.length === AVAILABLE_YEARS.length) {
      return `Todos os Anos (${AVAILABLE_YEARS.length})`;
    }
    if (selection.years.length === 1) {
      return `Ano ${selection.years[0]}`;
    }
    return `${selection.years.join(", ")} (${selection.years.length} anos)`;
  };

  const getMonthLabel = () => {
    if (selection.months.length === AVAILABLE_MONTHS.length) {
      return `Todos os Meses (12)`;
    }
    if (selection.months.length === 1) {
      const m = AVAILABLE_MONTHS.find((item) => item.value === selection.months[0]);
      return m ? `${m.label} (${m.short})` : "1 mês";
    }
    if (selection.months.length <= 3) {
      return selection.months
        .map((mv) => AVAILABLE_MONTHS.find((m) => m.value === mv)?.short)
        .filter(Boolean)
        .join(", ");
    }
    return `${selection.months.length} meses selecionados`;
  };

  const getDayLabel = () => {
    if (selection.days.length === AVAILABLE_DAYS.length) {
      return `Todos os Dias (31 dias)`;
    }
    if (selection.days.length === 1) {
      return `Dia ${selection.days[0].toString().padStart(2, "0")}`;
    }
    if (selection.days.length <= 4) {
      return `Dias ${selection.days.map((d) => d.toString().padStart(2, "0")).join(", ")}`;
    }
    return `${selection.days.length} dias selecionados`;
  };

  const isAllYearsSelected = selection.years.length === AVAILABLE_YEARS.length;
  const isAllMonthsSelected = selection.months.length === AVAILABLE_MONTHS.length;
  const isAllDaysSelected = selection.days.length === AVAILABLE_DAYS.length;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* ============================================================ */}
        {/* 1. SELETOR DE ANO                                            */}
        {/* ============================================================ */}
        <div className="relative">
          <label
            htmlFor="btn-filter-year"
            className="flex items-center justify-between text-[11px] font-bold text-[#152238] mb-1.5"
          >
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Ano</span>
            </span>
            <span className="text-[10px] text-[#69778c] font-semibold">
              {selection.years.length} de {AVAILABLE_YEARS.length}
            </span>
          </label>

          <button
            type="button"
            id="btn-filter-year"
            onClick={() => setOpenDropdown(openDropdown === "year" ? null : "year")}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#152238] shadow-2xs hover:border-[#94a3b8] focus:border-[#3c63da] focus:ring-2 focus:ring-[#3c63da]/15 focus:outline-none transition-all cursor-pointer text-left"
          >
            <span className="truncate">{getYearLabel()}</span>
            <ChevronDown
              className={`h-4 w-4 text-[#69778c] flex-shrink-0 transition-transform ${
                openDropdown === "year" ? "rotate-180 text-[#3c63da]" : ""
              }`}
            />
          </button>

          {/* Popover Ano */}
          {openDropdown === "year" && (
            <div className="absolute top-full left-0 mt-1.5 w-72 rounded-xl border border-[#cbd5e1] bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-[#e5eaf1] mb-2">
                <span className="text-xs font-extrabold text-[#152238]">Filtrar por Ano</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={selectAllYears}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                      isAllYearsSelected
                        ? "bg-[#edf2ff] text-[#3c63da]"
                        : "text-[#69778c] hover:text-[#152238] hover:bg-[#f4f7fb]"
                    }`}
                  >
                    Selecionar tudo
                  </button>
                  <span className="text-[#cbd5e1]">|</span>
                  <button
                    type="button"
                    onClick={selectOnlyCurrentYear}
                    className="px-2 py-0.5 rounded text-[11px] font-bold text-[#69778c] hover:text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
                  >
                    2026 (Atual)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {AVAILABLE_YEARS.map((yr) => {
                  const isChecked = selection.years.includes(yr);
                  return (
                    <label
                      key={yr}
                      onClick={() => toggleYear(yr)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-[#edf2ff] text-[#3c63da]"
                          : "hover:bg-[#f8faff] text-[#152238]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                            isChecked
                              ? "border-[#3c63da] bg-[#3c63da] text-white"
                              : "border-[#cbd5e1] bg-white"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <span>Ano {yr}</span>
                      </div>
                      {yr === 2026 && (
                        <span className="text-[10px] uppercase font-bold text-[#3c63da] bg-white px-1.5 py-0.5 rounded border border-[#3c63da]/20">
                          Corrente
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 pt-2 border-t border-[#e5eaf1] flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(null)}
                  className="rounded-lg bg-[#3c63da] px-3 py-1 text-xs font-bold text-white hover:bg-[#2e52be] transition-colors cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 2. SELETOR DE MÊS                                            */}
        {/* ============================================================ */}
        <div className="relative">
          <label
            htmlFor="btn-filter-month"
            className="flex items-center justify-between text-[11px] font-bold text-[#152238] mb-1.5"
          >
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Mês</span>
            </span>
            <span className="text-[10px] text-[#69778c] font-semibold">
              {selection.months.length} de 12
            </span>
          </label>

          <button
            type="button"
            id="btn-filter-month"
            onClick={() => setOpenDropdown(openDropdown === "month" ? null : "month")}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#152238] shadow-2xs hover:border-[#94a3b8] focus:border-[#3c63da] focus:ring-2 focus:ring-[#3c63da]/15 focus:outline-none transition-all cursor-pointer text-left"
          >
            <span className="truncate">{getMonthLabel()}</span>
            <ChevronDown
              className={`h-4 w-4 text-[#69778c] flex-shrink-0 transition-transform ${
                openDropdown === "month" ? "rotate-180 text-[#3c63da]" : ""
              }`}
            />
          </button>

          {/* Popover Mês */}
          {openDropdown === "month" && (
            <div className="absolute top-full left-0 sm:-left-12 mt-1.5 w-80 rounded-xl border border-[#cbd5e1] bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-[#e5eaf1] mb-2">
                <span className="text-xs font-extrabold text-[#152238]">Filtrar por Mês</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={selectAllMonths}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                      isAllMonthsSelected
                        ? "bg-[#edf2ff] text-[#3c63da]"
                        : "text-[#69778c] hover:text-[#152238] hover:bg-[#f4f7fb]"
                    }`}
                  >
                    Selecionar tudo
                  </button>
                  <span className="text-[#cbd5e1]">|</span>
                  <button
                    type="button"
                    onClick={selectCurrentMonth}
                    className="px-2 py-0.5 rounded text-[11px] font-bold text-[#69778c] hover:text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
                  >
                    Setembro (Atual)
                  </button>
                </div>
              </div>

              {/* Atalhos rápidos por Trimestre */}
              <div className="grid grid-cols-4 gap-1 mb-2 pb-2 border-b border-[#f1f5f9]">
                {[1, 2, 3, 4].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => selectQuarter(q)}
                    className="px-1.5 py-1 text-[10px] font-bold text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] rounded border border-[#e2e8f0] transition-colors text-center cursor-pointer"
                  >
                    {q}º Trimestre
                  </button>
                ))}
              </div>

              {/* Grid de 12 Meses com Checkboxes */}
              <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto pr-1">
                {AVAILABLE_MONTHS.map((m) => {
                  const isChecked = selection.months.includes(m.value);
                  return (
                    <label
                      key={m.value}
                      onClick={() => toggleMonth(m.value)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-[#edf2ff] text-[#3c63da]"
                          : "hover:bg-[#f8faff] text-[#152238]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded border flex-shrink-0 transition-colors ${
                            isChecked
                              ? "border-[#3c63da] bg-[#3c63da] text-white"
                              : "border-[#cbd5e1] bg-white"
                          }`}
                        >
                          {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                        <span className="truncate">{m.label}</span>
                      </div>
                      <span className="text-[10px] text-[#69778c] font-mono">
                        {m.value.toString().padStart(2, "0")}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 pt-2 border-t border-[#e5eaf1] flex items-center justify-between">
                <span className="text-[11px] text-[#69778c] font-semibold">
                  {selection.months.length} selecionado(s)
                </span>
                <button
                  type="button"
                  onClick={() => setOpenDropdown(null)}
                  className="rounded-lg bg-[#3c63da] px-3 py-1 text-xs font-bold text-white hover:bg-[#2e52be] transition-colors cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 3. SELETOR DE DIA                                            */}
        {/* ============================================================ */}
        <div className="relative">
          <label
            htmlFor="btn-filter-day"
            className="flex items-center justify-between text-[11px] font-bold text-[#152238] mb-1.5"
          >
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#3c63da]" />
              <span>Dia</span>
            </span>
            <span className="text-[10px] text-[#69778c] font-semibold">
              {selection.days.length} de 31
            </span>
          </label>

          <button
            type="button"
            id="btn-filter-day"
            onClick={() => setOpenDropdown(openDropdown === "day" ? null : "day")}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#152238] shadow-2xs hover:border-[#94a3b8] focus:border-[#3c63da] focus:ring-2 focus:ring-[#3c63da]/15 focus:outline-none transition-all cursor-pointer text-left"
          >
            <span className="truncate">{getDayLabel()}</span>
            <ChevronDown
              className={`h-4 w-4 text-[#69778c] flex-shrink-0 transition-transform ${
                openDropdown === "day" ? "rotate-180 text-[#3c63da]" : ""
              }`}
            />
          </button>

          {/* Popover Dia */}
          {openDropdown === "day" && (
            <div className="absolute top-full right-0 sm:left-auto mt-1.5 w-84 rounded-xl border border-[#cbd5e1] bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-[#e5eaf1] mb-2">
                <span className="text-xs font-extrabold text-[#152238]">Filtrar por Dia</span>
                <button
                  type="button"
                  onClick={selectAllDays}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    isAllDaysSelected
                      ? "bg-[#edf2ff] text-[#3c63da]"
                      : "text-[#69778c] hover:text-[#152238] hover:bg-[#f4f7fb]"
                  }`}
                >
                  Selecionar tudo (31)
                </button>
              </div>

              {/* Atalhos Rápidos de Dias */}
              <div className="grid grid-cols-3 gap-1 mb-2 pb-2 border-b border-[#f1f5f9]">
                <button
                  type="button"
                  onClick={() => selectQuinzena(1)}
                  className="px-2 py-1 text-[10px] font-bold text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] rounded border border-[#e2e8f0] transition-colors text-center cursor-pointer"
                >
                  1ª Quinzena (1-15)
                </button>
                <button
                  type="button"
                  onClick={() => selectQuinzena(2)}
                  className="px-2 py-1 text-[10px] font-bold text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] rounded border border-[#e2e8f0] transition-colors text-center cursor-pointer"
                >
                  2ª Quinzena (16-31)
                </button>
                <button
                  type="button"
                  onClick={selectWeekdaysOnly}
                  className="px-2 py-1 text-[10px] font-bold text-[#69778c] hover:text-[#3c63da] hover:bg-[#edf2ff] rounded border border-[#e2e8f0] transition-colors text-center cursor-pointer"
                >
                  Dias Úteis (1-22)
                </button>
              </div>

              {/* Grid 7 colunas de Dias 1 a 31 */}
              <div className="grid grid-cols-7 gap-1">
                {AVAILABLE_DAYS.map((d) => {
                  const isChecked = selection.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      title={`Dia ${d}`}
                      className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                        isChecked
                          ? "bg-[#3c63da] text-white shadow-2xs font-extrabold"
                          : "bg-[#f8faff] text-[#69778c] hover:bg-[#edf2ff] hover:text-[#152238] border border-[#e5eaf1]"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-2 border-t border-[#e5eaf1] flex items-center justify-between">
                <span className="text-[11px] text-[#69778c] font-semibold">
                  {selection.days.length} dia(s) selecionado(s)
                </span>
                <button
                  type="button"
                  onClick={() => setOpenDropdown(null)}
                  className="rounded-lg bg-[#3c63da] px-3 py-1 text-xs font-bold text-white hover:bg-[#2e52be] transition-colors cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
