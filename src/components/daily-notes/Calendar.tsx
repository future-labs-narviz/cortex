import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore, flattenFiles } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function Calendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const files = useVaultStore((s) => s.files);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const openTab = useEditorStore((s) => s.openTab);

  // Build a set of dates (YYYY-MM-DD) that have daily notes.
  const dailyDates = useMemo(() => {
    const flat = flattenFiles(files);
    const dates = new Set<string>();
    for (const file of flat) {
      const match = file.path.match(/^daily\/(\d{4}-\d{2}-\d{2})\.md$/);
      if (match) {
        dates.add(match[1]);
      }
    }
    return dates;
  }, [files]);

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfWeek(viewYear, viewMonth);

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const handlePrev = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNext = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = async (day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    const relativePath = `daily/${dateStr}.md`;

    try {
      // Use create_daily_note for today, otherwise just open the file.
      if (dateStr === todayStr) {
        const path = await invoke<string>("create_daily_note");
        setActiveFile(path);
        openTab(path, "");
      } else if (dailyDates.has(dateStr)) {
        setActiveFile(relativePath);
        openTab(relativePath, "");
      }
      // If the date has no note and isn't today, do nothing.
    } catch (err) {
      console.warn("[Cortex] Calendar day click failed:", err);
    }
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(d);
  }

  return (
    <div className="select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={handlePrev}
          className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">
          {monthLabel}
        </span>
        <button
          onClick={handleNext}
          className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0 mb-0.5">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-[9px] text-center font-medium text-[var(--text-muted)] py-0.5"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="w-full aspect-square" />;
          }

          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
          const isToday = dateStr === todayStr;
          const hasNote = dailyDates.has(dateStr);
          const isClickable = isToday || hasNote;

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              disabled={!isClickable}
              className={`w-full aspect-square flex items-center justify-center text-[10px] rounded-sm transition-colors ${
                isToday
                  ? "bg-[var(--accent)] text-white font-bold"
                  : hasNote
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium cursor-pointer hover:bg-[var(--accent)] hover:text-white"
                    : "text-[var(--text-muted)]"
              } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
