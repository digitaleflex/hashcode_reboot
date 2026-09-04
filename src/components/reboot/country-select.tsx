"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COUNTRIES, countryFlag, countryName } from "@/lib/profiling/countries";
import { ChevronDown, Search } from "lucide-react";

export function CountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full h-12 rounded-md border bg-card px-4 flex items-center justify-between gap-3 transition-colors duration-180 focus-lime",
            value ? "border-lime" : "border-border hover:border-lime/50",
          )}
        >
          <span className="flex items-center gap-2.5">
            {value ? (
              <>
                <span className="text-xl leading-none">{countryFlag(value)}</span>
                <span className="text-foreground font-medium">
                  {countryName(value)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                Sélectionne ton pays
              </span>
            )}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0 bg-popover border-border"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un pays…"
            className="flex-1 h-11 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto scroll-slim py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              Aucun pays trouvé.
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                onChange(c.code);
                setOpen(false);
                setQ("");
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                value === c.code
                  ? "bg-lime/10 text-lime"
                  : "text-foreground hover:bg-secondary",
              )}
            >
              <span className="text-lg leading-none">{c.flag}</span>
              <span className="flex-1">{c.name}</span>
              {value === c.code && (
                <span className="mono-label text-lime">✓</span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
