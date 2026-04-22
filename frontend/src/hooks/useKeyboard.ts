"use client";

import { useEffect } from "react";

export interface KeyboardActions {
  onSubmit?: () => void;     // ⌘/Ctrl + Enter
  onCancel?: () => void;     // Esc
  onTab?: (i: number) => void; // 1..N
}

/**
 * Global keyboard shortcuts. Ignores events originating from editable fields
 * so users can still type in textareas / inputs.
 */
export function useKeyboard(actions: KeyboardActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // ⌘/Ctrl + Enter — submit, allowed even in textareas
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (actions.onSubmit) {
          e.preventDefault();
          actions.onSubmit();
        }
        return;
      }

      // Esc — cancel, allowed anywhere
      if (e.key === "Escape" && actions.onCancel) {
        actions.onCancel();
        return;
      }

      // Number tabs — only when not editing text
      if (!isEditable && actions.onTab && /^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10) - 1;
        actions.onTab(n);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
