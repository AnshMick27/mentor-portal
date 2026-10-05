"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import { createPasteGuard, type PasteCounts } from "@/lib/submissions/pasteGuard";

/**
 * Wires `createPasteGuard` (SPEC.md §8.9) to a controlled textarea: spread `boxProps` on it and show a note while
 * `blocked` is true. The native `beforeinput` listener is needed because React's `onBeforeInput` has no `inputType`.
 */
export function usePasteGuard(value: string, setValue: (value: string) => void) {
  const guard = useRef(createPasteGuard());
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

  return { boxProps, blocked, counts: (): PasteCounts => guard.current.counts() };
}
