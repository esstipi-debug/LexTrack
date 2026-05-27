import { useEffect, useState } from "react";

/**
 * Debounces a fast-changing value so dependent effects (e.g. React Query
 * fetches) only react after the value has been stable for `delayMs`.
 *
 * Typical usage: keep an `<input>` controlled by the raw `search` state for
 * immediate visual feedback, but pass `useDebounce(search, 300)` to the
 * network query so the API isn't hit on every keystroke.
 *
 * @template T value type — preserved exactly through debouncing.
 * @param value the latest value (updates synchronously with the input).
 * @param delayMs how long the value must remain stable before being emitted.
 *                Defaults to 300ms.
 * @returns the most recent value that has remained stable for `delayMs`.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
