import { useState, useCallback } from "react";

export function useResizableColumns(initalWidths: number[]) {
  const [widths, setWidths] = useState(initalWidths);

  const startResize = useCallback(
    (index: number, startX: number) => {
      const startWidth = widths[index];

      function onMouseMove(e: MouseEvent) {
        const newWidth = Math.max(40, startWidth + (e.clientX - startX));
        setWidths(prev => {
          const next = [...prev];
          next[index] = newWidth;
          return next;
        });
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }, [widths]
  );

  return {widths, startResize};
}