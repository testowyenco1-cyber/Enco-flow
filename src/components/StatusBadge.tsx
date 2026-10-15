import React from 'react';
import { ItemStatus, OrderStatus, STATUS_META, ORDER_STATUS_META } from '../types/enco';
import { CheckCircle2, Clock, AlertTriangle, Circle, Activity, Truck, Ban } from 'lucide-react';

interface ItemStatusBadgeProps {
  status: ItemStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ItemStatusBadge: React.FC<ItemStatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  const meta = STATUS_META[status] || STATUS_META.NOT_ORDERED;

  const iconMap = {
    NOT_ORDERED: <Circle className={size === 'sm' ? 'w-3 h-3 text-slate-400' : 'w-3.5 h-3.5 text-slate-400'} />,
    ORDERED: <Clock className={size === 'sm' ? 'w-3 h-3 text-blue-600' : 'w-3.5 h-3.5 text-blue-600'} />,
    IN_PROGRESS: <Activity className={size === 'sm' ? 'w-3 h-3 text-amber-500' : 'w-3.5 h-3.5 text-amber-500'} />,
    TRANSPORT: <Truck className={size === 'sm' ? 'w-3 h-3 text-purple-400' : 'w-3.5 h-3.5 text-purple-400'} />,
    READY: <CheckCircle2 className={size === 'sm' ? 'w-3 h-3 text-emerald-600' : 'w-3.5 h-3.5 text-emerald-600'} />,
    PROBLEM: <AlertTriangle className={size === 'sm' ? 'w-3 h-3 text-rose-600 animate-pulse' : 'w-3.5 h-3.5 text-rose-600 animate-pulse'} />,
    NOT_APPLICABLE: <Ban className={size === 'sm' ? 'w-3 h-3 text-slate-500' : 'w-3.5 h-3.5 text-slate-500'} />, 
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5 font-semibold',
    md: 'text-xs font-bold px-2.5 py-1 gap-1.5 shadow-2xs',
    lg: 'text-sm font-bold px-3 py-1.5 gap-2 shadow-xs',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border ${meta.bgBadge} ${meta.textBadge} ${meta.borderBadge} ${sizeClasses[size]} select-none whitespace-nowrap tracking-wide`}
    >
      <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, size = 'md' }) => {
  const meta = ORDER_STATUS_META[status] || ORDER_STATUS_META.NOT_STARTED;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5 font-semibold',
    md: 'text-xs font-bold px-2.5 py-1 gap-1.5 shadow-2xs',
    lg: 'text-sm font-extrabold px-3 py-1.5 gap-2 shadow-xs',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border ${meta.bgBadge} ${meta.textBadge} ${meta.borderBadge} ${sizeClasses[size]} select-none whitespace-nowrap tracking-wide`}
    >
      <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
      <span>{meta.label}</span>
    </span>
  );
};
