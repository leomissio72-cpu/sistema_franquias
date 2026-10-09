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
  /** Meses que têm lançamentos, no formato "AAAA-MM". Quando informado, eles ganham destaque. */
  activeMonths?: string[];
}

/** Lista os meses ("AAAA-MM") em que existe ao menos um lançamento. */
export function monthsWithEntries(entries: Array<{ date?: string }> | undefined): string[] {
  const found = new Set<string>();
  for (const entry of entries || []) {
    const ym = (entry.date || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) found.add(ym);
  }
  return [...found];
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
  activeMonths,
}) => {
  const [openDropdown, setOpenDropdown] = useState<"year" | "month" | "day" | null>(null);
  // "Somar": com ele ligado, cada clique acrescenta ou retira um mês/ano em vez de trocar.
  const [isAdding, setIsAdding] = useState(
    () => (selection.months.length > 1 && selection.months.length < 12) || selection.years.length > 1,
  );

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

  const years = [...AVAILABLE_YEARS].sort((x, y) => x - y);
  const activeSet = new Set(activeMonths || []);
  const monthHasData = (month: number) =>
    selection.years.some((year) => activeSet.has(`${year}-${String(month).padStart(2, "0")}`));

  const pickYear = (year: number, additive: boolean) => {
    if (additive) toggleYear(year);
    else onChange({ ...selection, years: [year] });
  };
  const pickMonth = (month: number, additive: boolean) => {
    if (additive) toggleMonth(month);
    else onChange({ ...selection, months: [month] });
  };

  const periodSummary = (() => {
    const yearText = selection.years.length === 1 ? String(selection.years[0]) : [...selection.years].sort((x, y) => x - y).join(", ");
    let monthText: string;
    if (isAllMonthsSelected) monthText = "Ano todo";
    else if (selection.months.length === 1) monthText = AVAILABLE_MONTHS.find((m) => m.value === selection.months[0])?.label || "";
    else if (selection.months.length <= 4) monthText = selection.months.map((mv) => AVAILABLE_MONTHS.find((m) => m.value === mv)?.short).join(", ");
    else monthText = `${selection.months.length} meses`;
    const dayText = isAllDaysSelected ? "" : `, ${getDayLabel().toLowerCase()}`;
    return isAllMonthsSelected ? `Ano de ${yearText}, todos os meses${dayText}` : `${monthText} de ${yearText}${dayText}`;
  })();

  const chipBase = "h-9 rounded-lg border text-xs font-bold transition-colors cursor-pointer select-none";
  const chipOn = "border-[#3c63da] bg-[#3c63da] text-white shadow-2xs";
  const chipOff = "border-[#e5eaf1] bg-white text-[#526078] hover:border-[#3c63da] hover:text-[#3c63da]";
  const chipData = "border-[#cbdafc] bg-[#edf2ff] text-[#3c63da] hover:border-[#3c63da]";
  const linkBase = "rounded-md px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        {/* Ano */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Ano">
          <Calendar className="h-4 w-4 text-[#3c63da] flex-shrink-0" aria-hidden="true" />
          {years.map((year) => {
            const on = selection.years.includes(year);
            return (
              <button
                key={year}
                type="button"
                aria-pressed={on}
                onClick={(event) => pickYear(year, isAdding || event.ctrlKey || event.metaKey || event.shiftKey)}
                className={`${chipBase} px-3 ${on ? chipOn : chipOff}`}
              >
                {year}
              </button>
            );
          })}
        </div>

        <span className="hidden lg:block h-6 w-px bg-[#e5eaf1]" aria-hidden="true" />

        {/* Meses: sempre à vista */}
        <div className="min-w-0 flex-1" role="group" aria-label="Mês">
          <div className="grid grid-cols-6 lg:grid-cols-12 gap-1.5">
            {AVAILABLE_MONTHS.map((month) => {
              const on = selection.months.includes(month.value);
              const hasData = monthHasData(month.value);
              return (
                <button
                  key={month.value}
                  type="button"
                  aria-pressed={on}
                  title={`${month.label}${hasData ? " (tem lançamentos)" : ""}`}
                  onClick={(event) => pickMonth(month.value, isAdding || event.ctrlKey || event.metaKey || event.shiftKey)}
                  className={`${chipBase} ${on ? chipOn : hasData ? chipData : chipOff}`}
                >
                  {month.short}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Linha de apoio: resumo do período e ajustes */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="text-[11px] text-[#69778c]">
          <span className="font-bold text-[#152238]">{periodSummary}</span>
          {activeMonths && activeMonths.length > 0 && <span className="ml-2">Em azul claro, os meses com lançamentos.</span>}
        </p>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={selectCurrentMonth}
            className={`${linkBase} text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]`}
          >
            Mês atual
          </button>
          <button
            type="button"
            aria-pressed={isAllMonthsSelected}
            onClick={selectAllMonths}
            className={`${linkBase} ${isAllMonthsSelected ? "bg-[#edf2ff] text-[#3c63da]" : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"}`}
          >
            Ano todo
          </button>
          <button
            type="button"
            aria-pressed={isAdding}
            onClick={() => setIsAdding((value) => !value)}
            title="Ligado: cada clique acrescenta ou retira um mês ou ano. Desligado: cada clique troca o período."
            className={`${linkBase} ${isAdding ? "bg-[#edf2ff] text-[#3c63da]" : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"}`}
          >
            {isAdding ? "Somando meses" : "Somar meses"}
          </button>

          {/* Dias */}
          <div className="relative">
            <button
              type="button"
              id="btn-filter-day"
              aria-expanded={openDropdown === "day"}
              onClick={() => setOpenDropdown(openDropdown === "day" ? null : "day")}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                isAllDaysSelected
                  ? "border-[#e5eaf1] bg-white text-[#526078] hover:border-[#3c63da] hover:text-[#3c63da]"
                  : "border-[#cbdafc] bg-[#edf2ff] text-[#3c63da]"
              }`}
            >
              <span>{isAllDaysSelected ? "Dias: todos" : getDayLabel()}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDropdown === "day" ? "rotate-180" : ""}`} />
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
    </div>
  );
};
