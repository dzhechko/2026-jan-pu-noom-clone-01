"use client";

import { useRouter } from "next/navigation";
import clsx from "clsx";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
}

function ArrowLeftIcon(): React.JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function PageHeader({
  title,
  showBack = false,
}: PageHeaderProps): React.JSX.Element {
  const router = useRouter();

  return (
    <header
      className={clsx(
        "sticky top-0 z-40",
        "bg-tg-bg border-b border-tg-hint/20",
        "flex items-center h-14 px-4",
      )}
    >
      {showBack && (
        <button
          type="button"
          onClick={() => router.back()}
          className={clsx(
            "flex items-center justify-center",
            "w-10 h-10 -ml-2 mr-1 rounded-full",
            "text-tg-button",
            "transition-colors duration-150",
            "hover:bg-tg-secondary-bg active:bg-tg-hint/20",
          )}
          aria-label="Go back"
        >
          <ArrowLeftIcon />
        </button>
      )}
      <h1 className="text-lg font-semibold text-tg-text truncate">
        {title}
      </h1>
    </header>
  );
}
