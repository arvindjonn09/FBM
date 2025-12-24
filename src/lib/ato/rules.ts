import type { EntryType } from "../types";

export type ProfileKey = "it" | "uber";

export type DeductionCategory = {
  key: string;
  label: string;
  description: string;
  type?: EntryType;
  methods?: string[];
};

export const rules: Record<
  ProfileKey,
  {
    name: string;
    categories: DeductionCategory[];
    gstEnabled: boolean;
  }
> = {
  it: {
    name: "IT professional",
    gstEnabled: false,
    categories: [
      { key: "wfh_fixed_rate", label: "WFH fixed rate", description: "ATO fixed-rate method; requires hours log." },
      {
        key: "phone_internet",
        label: "Phone & Internet",
        description: "Work-related portion unless using fixed-rate method for the year."
      },
      { key: "tools_equipment", label: "Tools & Equipment", description: "Depreciating assets, peripherals, etc." },
      { key: "training", label: "Training", description: "Self-education directly related to your job." },
      { key: "work_travel", label: "Work travel", description: "Non-commute travel costs; document purpose." }
    ]
  },
  uber: {
    name: "Uber / rideshare",
    gstEnabled: true,
    categories: [
      {
        key: "car_expenses",
        label: "Car expenses",
        description: "Fuel, maintenance; choose cents/km or logbook.",
        methods: ["cents_per_km", "logbook"]
      },
      { key: "platform_fees", label: "Platform fees", description: "Uber service fees and commissions." },
      { key: "phone_data", label: "Phone & data", description: "Work portion of mobile/data costs." },
      { key: "cleaning_tolls_parking", label: "Cleaning/tolls/parking", description: "Car washes, tolls, parking." },
      { key: "accounting", label: "Accounting & software", description: "Bookkeeping, tax software." }
    ]
  }
};
