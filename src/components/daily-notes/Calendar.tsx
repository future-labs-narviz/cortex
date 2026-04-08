import { useState, useMemo, useCallback } from "react";
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

  const dailyDates = useMemo(() => {
    const flat = flattenFiles(files);
    const dates = new Set<string>();
    for (const file of flat) {
      const match = file.path.match(/^daily\/(\d{4}-\d{2}-\d{2})\.md$/);
      if (match) dates.add(match[1]);
    }
    return dates;
  }, [files]);

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfWeek(viewYear, viewMonth);
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const handlePrev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  const handleNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const handleDayClick = async (day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    const relativePath = `daily/${dateStr}.md`;
    try {
      if (dateStr === todayStr) {
        const path = await invoke<string>("create_daily_note");
        setActiveFile(path);
        openTab(path, "");
      } else if (dailyDates.has(dateStr)) {
        setActiveFile(relativePath);
        openTab(relativePath, "");
      }
    } catch (err) {
      console.warn("[Cortex] Calendar day click failed:", err);
    }
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const [prevHover, setPrevHover] = useState(false);
  const [nextHover, setNextHover] = useState(false);

  const navBtn = useCallback((hovered: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 'var(--radius-md)',
    background: hovered ? 'var(--muted-hover)' : 'transparent',
    border: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'background 150ms',
  }), []);

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={handlePrev}
          onMouseEnter={() => setPrevHover(true)}
          onMouseLeave={() => setPrevHover(false)}
          style={navBtn(prevHover)}
          aria-label="Previous month"
        >
          <ChevronLeft style={{ width: 16, height: 16 }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {monthLabel}
        </span>
        <button
          onClick={handleNext}
          onMouseEnter={() => setNextHover(true)}
          onMouseLeave={() => setNextHover(false)}
          style={navBtn(nextHover)}
          aria-label="Next month"
        >
          <ChevronRight style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0', fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace' }}>
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} style={{ aspectRatio: '1' }} />;
          }

          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
          const isToday = dateStr === todayStr;
          const hasNote = dailyDates.has(dateStr);
          const isClickable = isToday || hasNote;

          const cellStyle: React.CSSProperties = {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', aspectRatio: '1',
            fontSize: 12, fontWeight: isToday ? 700 : hasNote ? 500 : 400,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: isClickable ? 'pointer' : 'default',
            transition: 'all 150ms',
            ...(isToday
              ? { background: 'var(--accent)', color: '#fff' }
              : hasNote
                ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                : { background: 'transparent', color: 'var(--text-muted)' }
            ),
          };

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              disabled={!isClickable}
              style={cellStyle}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
