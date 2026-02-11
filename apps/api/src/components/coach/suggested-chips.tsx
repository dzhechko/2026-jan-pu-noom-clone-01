"use client";

import clsx from "clsx";

interface SuggestedChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function SuggestedChips({
  suggestions,
  onSelect,
}: SuggestedChipsProps): JSX.Element {
  if (suggestions.length === 0) {
    return <div />;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className={clsx(
            "shrink-0 rounded-full border border-tg-button/30 bg-tg-button/10 px-3.5 py-2 text-xs font-medium text-tg-button",
            "transition-all duration-150",
            "hover:border-tg-button/50 hover:bg-tg-button/20",
            "active:scale-95 active:bg-tg-button/30",
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
