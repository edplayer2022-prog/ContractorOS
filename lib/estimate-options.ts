import type { EstimateStatus } from "@/lib/database.types";

export const ESTIMATE_UNITS = [
  ["each", "Each"],
  ["linear_foot", "Linear Foot"],
  ["square_foot", "Square Foot"],
  ["square_yard", "Square Yard"],
  ["cubic_yard", "Cubic Yard"],
  ["hour", "Hour"],
  ["day", "Day"],
  ["lot", "Lot"],
] as const;

export const ESTIMATE_STATUSES: { value: EstimateStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

export const STATUS_TONES = {
  draft: "slate", sent: "blue", viewed: "orange", approved: "green", rejected: "red", expired: "slate",
} as const;

export const unitLabel = (value: string) => ESTIMATE_UNITS.find(([key]) => key === value)?.[1] ?? value;
