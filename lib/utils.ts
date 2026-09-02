import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function currency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value ?? 0);
}

export function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export function initials(name?: string | null) {
  return (name || "CO").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
