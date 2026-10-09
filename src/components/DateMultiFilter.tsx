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
      return "Todos os anos";
    }
    if (selection.years.length === 1) {
      return String(selection.years[0]);
    }
    return [...selection.years].sort((x, y) => x - y).join(", ");
  };

  const getMonthLabel = () => {
    if (selection.months.length === AVAILABLE_MONTHS.length) {
      return "Todos os meses";
    }
    if (selection.months.length === 1) {
      const m = AVAILABLE_MONTHS.find((item) => item.value === selection.months[0]);
      return m ? m.label : "1 mês";
    }
    if (selection.months.length <= 3) {
      return selection.months
        .map((mv) => AVAILABLE_MONTHS.find((m) => m.value === mv)?.short)
        .filter(Boolean)
        .join(", ");
    }
    return `${selection.months.length} meses`;
  };

  const getDayLabel = () => {
    if (selection.days.length === AVAILABLE_DAYS.length) {
      return "Todos os dias";
    }
    if (selection.days.length === 1) {
      return `Dia ${selection.days[0].toString().padStart(2, "0")}`;
    }
    if (selection.days.length <= 4) {
      return `Dias ${selection.days.map((d) => d.toString().padStart(2, "0")).join(", ")}`;
    }
    return `${selection.days.length} dias`;
  };

  const isAllYearsSelected = selection.years.length === AVAILABLE_YEARS.length;
  const isAllMonthsSelected = selection.months.length === AVAILABLE_MONTHS.length;
  const isAllDaysSelected = selection.days.length === AVAILABLE_DAYS.length;

  const currentMonthLabel = AVAILABLE_MONTHS.find((m) => m.value === CURRENT_MONTH)?.label || "Mês atual";
  const toggle = (which: "year" | "month" | "day") => setOpenDropdown(openDropdown === which ? null : which);

  // Peças visuais compartilhadas pelos três menus
  const triggerClass = (open: boolean) =>
    `w-full flex items-center justify-between gap-2 rounded-xl border bg-white px-3.5 h-11 text-sm font-semibold text-[#152238] transition-colors cursor-pointer focus:outline-none ${
      open
        ? "border-[#3c63da] ring-4 ring-[#3c63da]/10"
        : "border-[#cbd5e1] hover:border-[#94a3b8] focus-visible:border-[#3c63da] focus-visible:ring-4 focus-visible:ring-[#3c63da]/10"
    }`;
  const labelClass = "mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#152238]";
  const panelClass =
    "absolute top-full z-50 mt-2 w-auto right-0 sm:right-auto sm:w-80 rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-[0_18px_40px_-12px_rgba(21,34,56,0.28)]";
  const shortcutClass = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
      active
        ? "border-[#3c63da] bg-[#edf2ff] text-[#3c63da]"
        : "border-[#e5eaf1] bg-white text-[#526078] hover:border-[#3c63da] hover:text-[#3c63da]"
    }`;
  const optionClass = (selected: boolean) =>
    `rounded-lg border text-xs font-bold transition-colors cursor-pointer select-none ${
      selected
        ? "border-[#3c63da] bg-[#3c63da] text-white"
        : "border-transparent bg-[#f4f7fb] text-[#475569] hover:bg-[#edf2ff] hover:text-[#3c63da]"
    }`;

  const sameSet = (a: number[], b: number[]) => a.length === b.length && b.every((value) => a.includes(value));
  const quarterMonths = (q: number) => [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
  const firstHalf = Array.from({ length: 15 }, (_, i) => i + 1);
  const secondHalf = Array.from({ length: 16 }, (_, i) => i + 16);

  const Footer = ({ text }: { text: string }) => (
    <div className="mt-4 flex items-center justify-between border-t border-[#eef2f7] pt-3">
      <span className="text-[11px] font-semibold text-[#69778c]">{text}</span>
      <button
        type="button"
        onClick={() => setOpenDropdown(null)}
        className="rounded-lg bg-[#3c63da] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2e52be] transition-colors cursor-pointer"
      >
        Concluir
      </button>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Ano */}
        <div className="sm:relative">
          <label htmlFor="btn-filter-year" className={labelClass}>
            <Calendar className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>Ano</span>
          </label>
          <button type="button" id="btn-filter-year" aria-expanded={openDropdown === "year"} onClick={() => toggle("year")} className={triggerClass(openDropdown === "year")}>
            <span className="truncate">{getYearLabel()}</span>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${openDropdown === "year" ? "rotate-180 text-[#3c63da]" : "text-[#69778c]"}`} />
          </button>

          {openDropdown === "year" && (
            <div className={`${panelClass} left-0`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={selectOnlyCurrentYear} className={shortcutClass(sameSet(selection.years, [CURRENT_YEAR]))}>
                  Este ano
                </button>
                <button type="button" onClick={selectAllYears} className={shortcutClass(isAllYearsSelected)}>
                  Todos os anos
                </button>
              </div>
              <div className="keep-cols mt-3 grid grid-cols-3 gap-1.5">
                {[...AVAILABLE_YEARS].sort((x, y) => x - y).map((yr) => (
                  <button key={yr} type="button" aria-pressed={selection.years.includes(yr)} onClick={() => toggleYear(yr)} className={`${optionClass(selection.years.includes(yr))} h-10`}>
                    {yr}
                  </button>
                ))}
              </div>
              <Footer text={selection.years.length === 1 ? "1 ano selecionado" : `${selection.years.length} anos selecionados`} />
            </div>
          )}
        </div>

        {/* Mês */}
        <div className="sm:relative">
          <label htmlFor="btn-filter-month" className={labelClass}>
            <Calendar className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>Mês</span>
          </label>
          <button type="button" id="btn-filter-month" aria-expanded={openDropdown === "month"} onClick={() => toggle("month")} className={triggerClass(openDropdown === "month")}>
            <span className="truncate">{getMonthLabel()}</span>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${openDropdown === "month" ? "rotate-180 text-[#3c63da]" : "text-[#69778c]"}`} />
          </button>

          {openDropdown === "month" && (
            <div className={`${panelClass} left-0`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={selectCurrentMonth} className={shortcutClass(sameSet(selection.months, [CURRENT_MONTH]))}>
                  {currentMonthLabel}
                </button>
                {[1, 2, 3, 4].map((q) => (
                  <button key={q} type="button" onClick={() => selectQuarter(q)} className={shortcutClass(sameSet(selection.months, quarterMonths(q)))}>
                    {q}º tri
                  </button>
                ))}
                <button type="button" onClick={selectAllMonths} className={shortcutClass(isAllMonthsSelected)}>
                  Ano todo
                </button>
              </div>
              <div className="keep-cols mt-3 grid grid-cols-3 gap-1.5">
                {AVAILABLE_MONTHS.map((m) => (
                  <button key={m.value} type="button" aria-pressed={selection.months.includes(m.value)} onClick={() => toggleMonth(m.value)} className={`${optionClass(selection.months.includes(m.value))} h-10`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <Footer text={selection.months.length === 1 ? "1 mês selecionado" : `${selection.months.length} meses selecionados`} />
            </div>
          )}
        </div>

        {/* Dia */}
        <div className="col-span-2 sm:col-span-1 sm:relative">
          <label htmlFor="btn-filter-day" className={labelClass}>
            <Calendar className="h-3.5 w-3.5 text-[#3c63da]" />
            <span>Dia</span>
          </label>
          <button type="button" id="btn-filter-day" aria-expanded={openDropdown === "day"} onClick={() => toggle("day")} className={triggerClass(openDropdown === "day")}>
            <span className="truncate">{getDayLabel()}</span>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${openDropdown === "day" ? "rotate-180 text-[#3c63da]" : "text-[#69778c]"}`} />
          </button>

          {openDropdown === "day" && (
            <div className={`${panelClass} left-0 sm:left-auto sm:!right-0`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={selectAllDays} className={shortcutClass(isAllDaysSelected)}>
                  Mês inteiro
                </button>
                <button type="button" onClick={() => selectQuinzena(1)} className={shortcutClass(sameSet(selection.days, firstHalf))}>
                  1ª quinzena
                </button>
                <button type="button" onClick={() => selectQuinzena(2)} className={shortcutClass(sameSet(selection.days, secondHalf))}>
                  2ª quinzena
                </button>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1">
                {AVAILABLE_DAYS.map((d) => {
                  const selected = selection.days.includes(d);
                  // Mês inteiro é o estado neutro: fica em tom suave, sem pintar a grade toda.
                  const className = isAllDaysSelected
                    ? "border-transparent bg-[#edf2ff] text-[#3c63da] hover:bg-[#dfe8fe]"
                    : selected
                    ? "border-[#3c63da] bg-[#3c63da] text-white"
                    : "border-transparent bg-[#f4f7fb] text-[#475569] hover:bg-[#edf2ff] hover:text-[#3c63da]";
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={selected}
                      title={`Dia ${d}`}
                      // Com o mês inteiro marcado, clicar em um dia passa a filtrar só por ele.
                      onClick={() => (isAllDaysSelected ? onChange({ ...selection, days: [d] }) : toggleDay(d))}
                      className={`h-9 rounded-lg border text-xs font-bold transition-colors cursor-pointer select-none ${className}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <Footer text={isAllDaysSelected ? "Mês inteiro" : selection.days.length === 1 ? "1 dia selecionado" : `${selection.days.length} dias selecionados`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
