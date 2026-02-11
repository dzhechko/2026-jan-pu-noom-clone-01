"use client";

import { type ReactNode } from "react";
import clsx from "clsx";
import { PageHeader } from "./page-header";
import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  title?: string;
  showBack?: boolean;
  showNav?: boolean;
  children: ReactNode;
}

export function AppShell({
  title,
  showBack = false,
  showNav = true,
  children,
}: AppShellProps): React.JSX.Element {
  return (
    <div className="flex flex-col min-h-screen bg-tg-bg">
      {title && <PageHeader title={title} showBack={showBack} />}

      <main
        className={clsx(
          "flex-1",
          showNav && "pb-safe",
        )}
      >
        {children}
      </main>

      {showNav && <BottomNav />}
    </div>
  );
}
