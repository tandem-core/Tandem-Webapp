"use client";

import { createContext, useContext, useState } from "react";

const SearchContext = createContext<{ query: string; setQuery: (query: string) => void } | null>(null);

export function PrescriptionSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>;
}

export function usePrescriptionSearch() {
  const search = useContext(SearchContext);
  if (!search) throw new Error("PrescriptionSearchProvider is required.");
  return search;
}

export default function PrescriptionSearch() {
  const { query, setQuery } = usePrescriptionSearch();
  return <div className="sidebar-search">
    <label htmlFor="prescription-search">Search prescriptions</label>
    <input id="prescription-search" type="search" placeholder="Medicine name or dose…" value={query} onChange={(event) => setQuery(event.target.value)} />
  </div>;
}
