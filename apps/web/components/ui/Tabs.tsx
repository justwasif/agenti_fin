"use client";

import { useState } from "react";

export interface Tab {
  id: string;
  label: React.ReactNode;
}

export function Tabs({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-xl bg-ink/5 p-1 ${className}`}
      role="tablist"
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
