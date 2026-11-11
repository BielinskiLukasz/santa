"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useState } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "red" | "ghost";
  small?: boolean;
};

export function Button({
  variant = "primary",
  small = false,
  className = "",
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "red"
        ? "btn-red"
        : "btn-ghost";
  return (
    <button
      {...props}
      className={`btn ${variantClass} ${small ? "btn-small" : ""} ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card p-5 sm:p-7 ${className}`}>{children}</section>;
}

export function Badge({
  children,
  tone = "grey",
}: {
  children: ReactNode;
  tone?: "green" | "red" | "gold" | "grey";
}) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b2938]">
          {eyebrow}
        </p>
      )}
      <h2 className="display-font mt-1 text-2xl sm:text-3xl font-bold text-[var(--pine-dark)]">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-[#4a655b]">{description}</p>
      )}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-[#e7b0b7] bg-[#fdf0f1] text-[#8e2432]"
      : tone === "success"
        ? "border-[#a9d7bd] bg-[#eef8f1] text-[#12613f]"
        : "border-[#e2d7b6] bg-[#fdf8e9] text-[#6b551c]";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[#436156]" role="status">
      <span className="spinner" aria-hidden="true" />
      {label ?? "Ładowanie…"}
    </div>
  );
}

export function CopyButton({
  value,
  label = "Kopiuj link",
  small = true,
}: {
  value: string;
  label?: string;
  small?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Button variant="ghost" small={small} onClick={() => void copy()} type="button">
      {copied ? "✓ Skopiowano" : label}
    </Button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[rgba(18,68,51,0.14)] bg-white/70 p-3.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[#124433]"
      />
      <span>
        <span className="block text-sm font-semibold text-[var(--pine-dark)]">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-[#5a7268]">{hint}</span>}
      </span>
    </label>
  );
}

export function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-white/70 px-4 py-3 text-center">
      <div className="display-font text-2xl font-bold text-[var(--pine-dark)]">{value}</div>
      <div className="text-xs text-[#5a7268]">{label}</div>
    </div>
  );
}
