import { useEffect, useRef } from "react";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "default" | "destructive";
  emphasizeIrreversible?: boolean;
  allowOutsideClick?: boolean;
};

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  variant = "default",
  emphasizeIrreversible = false,
  allowOutsideClick = true,
}: Readonly<ConfirmModalProps>) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const isDestructive = variant === "destructive";
  const canCloseOnOutsideClick = allowOutsideClick && !isDestructive;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
        return;
      }
      if (event.key !== "Tab") return;

      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="animate-confirm-modal-backdrop absolute inset-0 z-0 bg-slate-900/70"
        aria-hidden="true"
      />
      {canCloseOnOutsideClick ? (
        <button
          type="button"
          aria-label="Close confirmation modal"
          className="absolute inset-0 z-10"
          onClick={onCancel}
        />
      ) : null}
      <dialog
        ref={dialogRef}
        open
        aria-labelledby="confirm-modal-title"
        className="animate-confirm-modal-dialog relative z-20 m-0 w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl backdrop:bg-transparent dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              isDestructive
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
            aria-hidden="true"
          >
            !
          </span>
          <h3
            id="confirm-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {title}
          </h3>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        {emphasizeIrreversible || isDestructive ? (
          <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
            This action may be irreversible.
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium text-white transition ${
              isDestructive
                ? "border-rose-300 bg-rose-600 hover:bg-rose-700 dark:border-rose-700"
                : "border-indigo-300 bg-indigo-600 hover:bg-indigo-700 dark:border-indigo-700"
            }`}
          >
            Confirm
          </button>
        </div>
      </dialog>
    </div>
  );
}

