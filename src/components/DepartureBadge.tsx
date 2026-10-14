import React from 'react';
import { getDepartureDateUrgency } from '../types/enco';
import { Calendar, AlertCircle } from 'lucide-react';

interface DepartureBadgeProps {
  dateStr: string;
  isCompleted?: boolean;
  compact?: boolean;
}

export const DepartureBadge: React.FC<DepartureBadgeProps> = ({
  dateStr,
  isCompleted = false,
  compact = false,
}) => {
  const urgency = getDepartureDateUrgency(dateStr, isCompleted);

  // Format date display (e.g. 2026-10-22 -> 22.10.2026)
  const formattedDate = dateStr
    ? dateStr.split('-').reverse().join('.')
    : 'Nie ustalono';

  if (compact) {
    let colorClass = 'text-slate-600';
    let dotClass = 'bg-slate-400';

    if (isCompleted) {
      colorClass = 'text-emerald-700';
      dotClass = 'bg-emerald-500';
    } else if (urgency.status === 'overdue') {
      colorClass = 'text-rose-700 font-semibold';
      dotClass = 'bg-rose-500 animate-pulse';
    } else if (urgency.status === 'urgent') {
      colorClass = 'text-amber-700 font-semibold';
      dotClass = 'bg-amber-500';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 text-xs ${colorClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <span className="font-mono tabular-nums">{formattedDate}</span>
        {!isCompleted && urgency.status !== 'invalid' && (
          <span className="text-[11px] opacity-80">({urgency.label})</span>
        )}
      </span>
    );
  }

  // Full view
  let containerBg = 'bg-slate-50 border-slate-200 text-slate-700';
  let badgeStyle = 'text-slate-600';

  if (isCompleted) {
    containerBg = 'bg-emerald-50/70 border-emerald-200 text-emerald-900';
    badgeStyle = 'text-emerald-700 font-medium';
  } else if (urgency.status === 'overdue') {
    containerBg = 'bg-rose-50 border-rose-200 text-rose-900';
    badgeStyle = 'text-rose-700 font-bold';
  } else if (urgency.status === 'urgent') {
    containerBg = 'bg-amber-50 border-amber-200 text-amber-900';
    badgeStyle = 'text-amber-700 font-semibold';
  }

  return (
    <div className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs ${containerBg}`}>
      <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-800">Wyjazd:</span>
        <span className="font-mono tabular-nums font-bold text-slate-900">{formattedDate}</span>
      </div>
      <span className="text-slate-300">|</span>
      <span className={`flex items-center gap-1 text-[11px] ${badgeStyle}`}>
        {urgency.status === 'overdue' && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
        {urgency.label}
      </span>
    </div>
  );
};
