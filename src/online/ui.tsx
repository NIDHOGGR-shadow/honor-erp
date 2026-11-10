import React from "react";
import { Boxes, X } from "lucide-react";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className="honor-business-wordmark inline-flex flex-col items-start">
      <span className="text-[23px] font-extrabold tracking-[.09em] text-zinc-900">HONOR</span>
      {!small && <span className="mt-1 text-[10px] font-normal tracking-[.05em] text-zinc-500">Business workspace</span>}
    </span>
  );
}
export function Badge({
  children,
  warning = false,
}: {
  children: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${warning ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
    >
      {children}
    </span>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="py-16 px-6 text-center">
      <Boxes className="mx-auto mb-4 text-zinc-300" size={32} />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-500">{text}</p>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-xs font-medium text-zinc-600">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const labelId = React.useId();
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({preventScroll: true});
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className="honor-dialog m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border-0 p-0 text-zinc-900 backdrop:bg-zinc-950/40"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-6">
        <h2 id={labelId} className="text-lg font-semibold">
          {title}
        </h2>
        <button
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-zinc-100"
        >
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
    </dialog>
  );
}
