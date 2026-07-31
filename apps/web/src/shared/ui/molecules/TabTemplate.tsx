import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import SectionHeader from './SectionHeader';
import SegmentedChips from '../atoms/SegmentedChips';

interface ChipGroup<T extends string> {
  options: Array<{ value: T; label: string; badge?: number }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

interface TabTemplateProps<T extends string = string> {
  /** SectionHeader title */
  title: string;
  /** SectionHeader actions (buttons, etc.) */
  headerActions?: ReactNode;
  /** Optional content rendered between header and search (e.g. low-stock banner) */
  beforeSearch?: ReactNode;
  /** If provided, renders the search bar */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** If provided, renders SegmentedChips row */
  chips?: ChipGroup<T>;
  /** The main content area. Gets rendered after header + search + chips. */
  children: ReactNode;
  /** Remove the outer container wrapper. Default: false — useful when the consumer already has its own wrapper. */
  noContainer?: boolean;
  /** Remove flex-1 overflow-auto scroll area. Default: false — useful for tabs with naturally flowing content. */
  noScroll?: boolean;
}

/**
 * Standardised tab layout used across inventory tabs.
 *
 * Renders:
 *   <outer-container>
 *     <SectionHeader title={title} actions={headerActions} />
 *     {beforeSearch}
 *     {searchValue !== undefined && <search-bar />}
 *     {chips && <SegmentedChips />}
 *     <scrollable-content>{children}</scrollable-content>
 *   </outer-container>
 */
export default function TabTemplate<T extends string = string>({
  title,
  headerActions,
  beforeSearch,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Cerca...',
  chips,
  children,
  noContainer = false,
  noScroll = false,
}: TabTemplateProps<T>) {
  const inner = (
    <>
      <SectionHeader title={title} actions={headerActions} />
      {beforeSearch}

      {searchValue !== undefined && onSearchChange && (
        <div className="px-4 py-2 border-b border-border bg-bg/20">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-2 rounded border border-border text-sm"
            />
          </div>
        </div>
      )}

      {chips && chips.options.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-bg/20">
          <SegmentedChips
            ariaLabel={chips.ariaLabel}
            value={chips.value}
            onChange={chips.onChange}
            options={chips.options}
            size="sm"
          />
        </div>
      )}

      {noScroll ? children : <div className="overflow-auto flex-1">{children}</div>}
    </>
  );

  if (noContainer) return inner;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      {inner}
    </div>
  );
}
