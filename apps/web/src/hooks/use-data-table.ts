import { useMemo, useState } from "react";
import type { SortState } from "@/components/ui/sortable-table-head";

export interface UseDataTableOptions<T> {
  getId: (item: T) => string;
  pageSize?: number;
  /** Maps a sortable column key to the value used to compare rows for that column. */
  sortAccessors?: Record<string, (item: T) => string | number>;
}

/**
 * Client-side sort + paginate + row-selection state for an already-fetched array.
 * Shared across the clients/expenses/income/invoices/wealth tables so pagination,
 * sorting and bulk-select behave identically everywhere.
 */
export function useDataTable<T>(items: T[], opts: UseDataTableOptions<T>) {
  const { getId, pageSize = 10, sortAccessors } = opts;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const accessor = sort && sortAccessors?.[sort.key];
    if (!accessor) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort!.direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [items, sort, sortAccessors]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize]
  );

  function toggleSort(key: string) {
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  const pageIds = paged.map(getId);
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelectedOnPage = pageIds.some((id) => selected.has(id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  return {
    page: currentPage,
    setPage,
    totalPages,
    paged,
    total: sorted.length,
    sort,
    toggleSort,
    selected,
    toggleSelect,
    toggleSelectAll,
    allSelectedOnPage,
    someSelectedOnPage,
    clearSelection,
  };
}
