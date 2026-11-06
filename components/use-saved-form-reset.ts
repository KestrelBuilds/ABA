"use client";
import { useRef, type FormEvent } from "react";

// React resets uncontrolled fields after a resolved action, including a Result
// that reports failure. Business drafts may reset only after a confirmed save.
export function useSavedFormReset() {
  const formRef = useRef<HTMLFormElement>(null);
  const allowed = useRef(false);
  return {
    formRef,
    onReset(event: FormEvent<HTMLFormElement>) {
      if (!allowed.current) event.preventDefault();
    },
    resetAfterSave() {
      allowed.current = true;
      try {
        formRef.current?.reset();
      } finally {
        allowed.current = false;
      }
    },
  };
}
