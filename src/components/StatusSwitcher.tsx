import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ItemStatus, STATUS_META } from '../types/enco';
import { Check, ChevronDown, Lock } from 'lucide-react';

interface StatusSwitcherProps {
  currentStatus: ItemStatus;
  onChange: (newStatus: ItemStatus) => void;
  size?: 'sm' | 'md';
  variant?: 'dropdown' | 'segmented' | 'compact-cycle';
  readOnly?: boolean;
  readOnlyNotice?: string;
  notApplicableLabel?: string;
}

export const StatusSwitcher: React.FC<StatusSwitcherProps> = ({
  currentStatus,
  onChange,
  size = 'md',
  variant = 'segmented',
  readOnly = false,
  readOnlyNotice,
  notApplicableLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          !menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render the menu outside cards and overflow containers, anchored to its button.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const rect = dropdownRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 192;
      const menuHeight = 260;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
      const openAbove = rect.bottom + menuHeight + 8 > window.innerHeight &&
        rect.top > menuHeight + 8;
      setMenuPosition({
        top: openAbove ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
        left,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const statuses: ItemStatus[] = ['NOT_ORDERED', 'ORDERED', 'IN_PROGRESS', 'READY', 'PROBLEM', 'NOT_APPLICABLE'];
  const baseCurrentMeta = (currentStatus && STATUS_META[currentStatus]) || STATUS_META.NOT_ORDERED;
  const currentMeta = currentStatus === 'NOT_APPLICABLE' && notApplicableLabel
    ? { ...baseCurrentMeta, label: notApplicableLabel, shortLabel: notApplicableLabel }
    : baseCurrentMeta;

  // READ-ONLY MODE
  if (readOnly) {
    const isDarkBadge = currentStatus !== 'NOT_ORDERED';
    const tooltip = readOnlyNotice || 'Brak uprawnień do zmiany statusu dla aktywnego profilu (tylko podgląd)';

    if (variant === 'segmented') {
      return (
        <div
          title={tooltip}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-700 text-xs font-semibold select-none cursor-not-allowed shadow-2xs"
        >
          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
          <span className={`w-2 h-2 rounded-full ${currentMeta.dotColor}`} />
          <span className="font-bold text-slate-800">{currentMeta.label}</span>
          <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">(tylko podgląd)</span>
        </div>
      );
    }

    return (
      <div
        title={tooltip}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-bold select-none cursor-not-allowed opacity-95 ${currentMeta.bgBadge} ${currentMeta.textBadge} ${currentMeta.borderBadge}`}
      >
        <Lock className="w-2.5 h-2.5 opacity-70 shrink-0" />
        <span className={`w-1.5 h-1.5 rounded-full ${currentMeta.dotColor}`} />
        <span>{currentMeta.label}</span>
      </div>
    );
  }

  if (variant === 'segmented') {
    return (
      <div className="inline-flex flex-wrap items-center p-1 bg-slate-200/80 rounded-lg border border-slate-300 shadow-2xs gap-0.5">
        {statuses.map((st) => {
          const baseMeta = STATUS_META[st];
          const meta = st === 'NOT_APPLICABLE' && notApplicableLabel
            ? { ...baseMeta, label: notApplicableLabel, shortLabel: notApplicableLabel }
            : baseMeta;
          const isActive = currentStatus === st;

          let activeClass = 'bg-slate-700 text-white shadow-xs font-bold';
          if (st === 'NOT_APPLICABLE') activeClass = 'bg-slate-500 text-white shadow-xs font-bold ring-1 ring-slate-400';
          else if (st === 'PROBLEM') activeClass = 'bg-rose-600 text-white shadow-xs font-black ring-1 ring-rose-500';
          else if (st === 'READY') activeClass = 'bg-emerald-600 text-white shadow-xs font-black ring-1 ring-emerald-500';
          else if (st === 'IN_PROGRESS') activeClass = 'bg-amber-500 text-slate-950 shadow-xs font-black ring-1 ring-amber-400';
          else if (st === 'ORDERED') activeClass = 'bg-blue-600 text-white shadow-xs font-black ring-1 ring-blue-500';

          let inactiveClass = 'text-slate-600 hover:bg-slate-300/60 font-semibold';
          if (st === 'NOT_APPLICABLE') inactiveClass = 'text-slate-600 hover:bg-slate-100 font-bold';
          else if (st === 'PROBLEM') inactiveClass = 'text-rose-800 hover:bg-rose-100 font-bold';
          else if (st === 'READY') inactiveClass = 'text-emerald-800 hover:bg-emerald-100 font-bold';
          else if (st === 'IN_PROGRESS') inactiveClass = 'text-amber-900 hover:bg-amber-100 font-bold';
          else if (st === 'ORDERED') inactiveClass = 'text-blue-800 hover:bg-blue-100 font-bold';

          return (
            <button
              key={st}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(st);
              }}
              title={`Ustaw status: ${meta.label}`}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-all whitespace-nowrap cursor-pointer ${
                isActive ? activeClass : inactiveClass
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isActive
                    ? st === 'IN_PROGRESS'
                      ? 'bg-slate-950 ring-1 ring-amber-300'
                      : 'bg-white ring-1 ring-white/50'
                    : st === 'READY'
                    ? 'bg-emerald-600'
                    : st === 'IN_PROGRESS'
                    ? 'bg-amber-500'
                    : st === 'ORDERED'
                    ? 'bg-blue-600'
                    : st === 'NOT_APPLICABLE'
                    ? 'bg-slate-300'
                    : st === 'PROBLEM'
                    ? 'bg-rose-600'
                    : 'bg-slate-400'
                }`}
              />
              <span>{meta.shortLabel}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Dropdown style
  const isDarkBadge = currentStatus !== 'NOT_ORDERED';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-xs font-bold cursor-pointer transition-all shadow-xs ${currentMeta.bgBadge} ${currentMeta.textBadge} ${currentMeta.borderBadge} hover:brightness-105`}
      >
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${currentMeta.dotColor}`} />
          <span>{currentMeta.label}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-1 ${isDarkBadge ? 'text-white/80' : 'text-slate-600'}`}
        />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed w-48 max-h-[min(70vh,320px)] overflow-y-auto rounded-lg bg-white border border-slate-300 shadow-xl z-[9999] py-1"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          role="menu"
        >
          {statuses.map((st) => {
            const meta = STATUS_META[st];
            const isSelected = currentStatus === st;

            let dotColor = 'bg-slate-400';
            let textColor = 'text-slate-800';
            if (st === 'READY') {
              dotColor = 'bg-emerald-600';
              textColor = 'text-emerald-800 font-bold';
            } else if (st === 'IN_PROGRESS') {
              dotColor = 'bg-amber-500';
              textColor = 'text-amber-900 font-bold';
            } else if (st === 'ORDERED') {
              dotColor = 'bg-blue-600';
              textColor = 'text-blue-800 font-bold';
            } else if (st === 'NOT_APPLICABLE') {
              dotColor = 'bg-slate-300';
              textColor = 'text-slate-600 font-bold';
            } else if (st === 'PROBLEM') {
              dotColor = 'bg-rose-600';
              textColor = 'text-rose-800 font-bold';
            }

            return (
              <button
                key={st}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(st);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                  isSelected ? 'bg-slate-100 font-bold text-slate-900' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                  <span className={textColor}>{meta.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-slate-900" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};
