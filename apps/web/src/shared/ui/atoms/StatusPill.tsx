import { cn } from '../../../lib/utils';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface StatusPillProps {
  label: string;
  tone?: 'neutral' | 'pending' | 'info' | 'success' | 'danger';
  className?: string;
}

const TONE_CLASSNAME: Record<NonNullable<StatusPillProps['tone']>, string> = {
  neutral: 'bg-bg text-secondary border-border',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
};

const TONE_ICON: Record<NonNullable<StatusPillProps['tone']>, React.ReactNode> = {
  neutral: null,
  pending: <AlertTriangle size={10} className="mr-1" />,
  info: <Info size={10} className="mr-1" />,
  success: <CheckCircle size={10} className="mr-1" />,
  danger: <XCircle size={10} className="mr-1" />,
};

export default function StatusPill({ label, tone = 'neutral', className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        TONE_CLASSNAME[tone],
        className,
      )}
    >
      {TONE_ICON[tone]}
      {label}
    </span>
  );
}
