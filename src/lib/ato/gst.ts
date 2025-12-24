export type GstEntry = {
  amount: number;
  amountType: "inc" | "ex";
  gstTreatment: "taxable" | "gst_free" | "input_taxed";
};

export const computeGst = (entry: GstEntry) => {
  if (entry.gstTreatment !== "taxable") return 0;
  if (entry.amountType === "inc") return entry.amount / 11;
  return entry.amount * 0.1;
};
