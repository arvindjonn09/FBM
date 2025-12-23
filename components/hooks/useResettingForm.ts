import { useEffect, useRef } from "react";

export function useResettingForm(reset: () => void, deps: unknown[]) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
