import { Info } from 'lucide-react';
import type { UnitConversion } from '@gustopos/shared';

interface ConversionHintProps {
  /** Array of unit conversions for this ingredient */
  conversions: UnitConversion[];
  /** The canonical unit of the BoM component, used in the tooltip label */
  canonicalUnit: string;
}

/**
 * Small Info icon with a hover tooltip showing unit conversion rates.
 * Only renders if conversions array is non-empty.
 */
export default function ConversionHint({ conversions, canonicalUnit }: ConversionHintProps) {
  if (!conversions || conversions.length === 0) return null;

  return (
    <div className="relative group/conversion tabular-nums">
      <Info size={9} className="text-text-muted/50 cursor-help" />
      <div className="absolute bottom-full right-0 mb-1 w-max max-w-[160px] px-2 py-1 rounded bg-gray-900 text-white text-[8px] shadow-lg opacity-0 group-hover/conversion:opacity-100 transition-opacity pointer-events-none z-10">
        {conversions.map((c) => (
          <p key={c.id} className="whitespace-nowrap">
            1 {c.fromUnit} = {c.factor} {canonicalUnit}
          </p>
        ))}
      </div>
    </div>
  );
}
