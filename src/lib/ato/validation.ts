import { getTaxYear } from "./helpers";
import type { ProfileKey } from "./rules";

export type DeductionEntryInput = {
  profileKey: ProfileKey;
  date: string;
  categoryKey: string;
  amount: number;
  workUsePercent: number;
  method?: string;
  km?: number;
  receipt?: boolean;
};

type ValidationContext = {
  existingDeductions: DeductionEntryInput[];
};

export function validateDeduction(input: DeductionEntryInput, ctx: ValidationContext): string | null {
  if (!input.date) return "Date is required.";
  if (input.amount <= 0) return "Amount must be greater than 0.";
  if (input.workUsePercent < 0 || input.workUsePercent > 100) return "Work use must be between 0 and 100%.";
  const taxYear = getTaxYear(input.date);

  if (input.profileKey === "it") {
    if (input.categoryKey === "phone_internet") {
      const hasFixedRate = ctx.existingDeductions.some(
        (d) => d.profileKey === "it" && getTaxYear(d.date) === taxYear && d.categoryKey === "wfh_fixed_rate"
      );
      if (hasFixedRate) return "Phone/Internet blocked: fixed-rate WFH already claimed this tax year.";
    }
  }

  if (input.profileKey === "uber") {
    if (input.categoryKey === "car_expenses") {
      if (input.method === "cents_per_km") {
        if (!input.km || input.km <= 0) return "Kilometres required for cents-per-km.";
        const kmThisYear = ctx.existingDeductions
          .filter(
            (d) =>
              d.profileKey === "uber" &&
              d.categoryKey === "car_expenses" &&
              d.method === "cents_per_km" &&
              getTaxYear(d.date) === taxYear
          )
          .reduce((s, d) => s + (d.km ?? 0), 0);
        if (kmThisYear + input.km > 5000) return "Cents-per-km cap of 5000km per tax year exceeded.";
      } else if (!input.method) {
        return "Select a car expense method.";
      }
    }
  }

  return null;
}
