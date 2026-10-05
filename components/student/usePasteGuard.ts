"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import { createAwayTracker } from "@/lib/submissions/awayTracker";
import { createPasteGuard } from "@/lib/submissions/pasteGuard";
import type { IntegrityCounts } from "@/lib/validation/submission";

/**
 * Wires `createPasteGuard` (SPEC.md §8.9) to a controlled textarea: spread `boxProps` on it and show a note while
 * `blocked` is true. The native `beforeinput` listener is needed because React's `onBeforeInput` has no `inputType`.
 * While the form is open it also counts time away from the page; `counts()` is what the submit request carries.
 */
export function usePasteGuard(value: string, setValue: (value: string) => void) {
  const guard = useRef(createPasteGuard());
  const away = useRef(createAwayTracker());
  const ref = useRef<HTMLTextAreaElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const onBeforeInput = (event: InputEvent) => {
      const text = event.data ?? event.dataTransfer?.getData("text/plain") ?? null;
      const info = { inputType: event.inputType, text, trusted: event.isTrusted, cancelable: event.cancelable };
      if (guard.current.beforeInput(info, box.value)) {
        event.preventDefault();
        setBlocked(true);
      }
    };
    box.addEventListener("beforeinput", onBeforeInput);
    return () => box.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  useEffect(() => {
    const tracker = away.current;
    const onVisibility = () => (document.visibilityState === "hidden" ? tracker.away() : tracker.back());
    const onBlur = () => tracker.away();
    const onFocus = () => tracker.back();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  function transfer(event: ClipboardEvent<HTMLTextAreaElement> | DragEvent<HTMLTextAreaElement>, data: DataTransfer | null, kind: "paste" | "drop") {
    const text = data?.getData("text/plain") ?? "";
    if (!guard.current[kind](text, event.nativeEvent.isTrusted, event.currentTarget.value)) {
      event.preventDefault();
      setBlocked(true);
    }
  }

  function remember(event: ClipboardEvent<HTMLTextAreaElement>) {
    const box = event.currentTarget;
    guard.current.copied(box.value.slice(box.selectionStart, box.selectionEnd));
  }

  const boxProps = {
    ref,
    onChange(event: ChangeEvent<HTMLTextAreaElement>) {
      const next = event.target.value;
      // Not calling setValue makes React put the controlled value back, which undoes the change.
      if (guard.current.change(value, next, event.nativeEvent.isTrusted)) {
        setValue(next);
        setBlocked(false);
      } else {
        setBlocked(true);
      }
    },
    onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => transfer(event, event.clipboardData, "paste"),
    onDrop: (event: DragEvent<HTMLTextAreaElement>) => transfer(event, event.dataTransfer, "drop"),
    onCopy: remember,
    onCut: remember,
  };

  return {
    boxProps,
    blocked,
    addTyped: (length: number) => guard.current.addTyped(length),
    counts: (): IntegrityCounts => ({ ...guard.current.counts(), ...away.current.counts() }),
  };
}
