import { cn } from '../../../lib/utils';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface StatusPillProps {
  label: string;
  tone?: 'neutral' | 'pending' | 'info' | 'success' | 'danger';
  className?: string;
}

const TONE_CLASSNAME: Record<NonNullable<StatusPillProps['tone']>, string> = {
  neutral: 'bg-bg text-secondary border-border',
  pending: 'bg-warning-100 text-warning-800 border-warning-200',
  info: 'bg-info-100 text-info-800 border-info-200',
  success: 'bg-success-100 text-success-800 border-success-200',
  danger: 'bg-danger-100 text-danger-800 border-danger-200',
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
