export const getTaxYear = (isoDate: string) => {
  const [y, m] = isoDate.split("-").map(Number);
  const startYear = m >= 7 ? y : y - 1;
  return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
};
