import React from "react";
import { Boxes, X } from "lucide-react";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
        <Boxes size={21} />
      </span>
      <span className="text-xl font-semibold tracking-tight">
        Honor
        {!small && (
          <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-[.2em] opacity-50">
            Inventory, in order
          </span>
        )}
      </span>
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
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="honor-dialog m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border-0 p-0 text-zinc-900 backdrop:bg-zinc-950/40"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 p-6">
        <h2 id={labelId} className="text-lg font-semibold">
          {title}
        </h2>
        <button
          aria-label="Close"
          onClick={onClose}
          className="rounded-lg p-2 hover:bg-zinc-100"
        >
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
    </dialog>
  );
}
