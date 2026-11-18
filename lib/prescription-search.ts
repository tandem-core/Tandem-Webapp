type SearchableMedicine = {
  heardAs: string;
  rxnorm: { name: string } | null;
  suggestion: { name: string } | null;
  doseStatements: { text: string }[];
};

export function matchesPrescription(medicine: SearchableMedicine, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const fields = [medicine.heardAs, medicine.rxnorm?.name, medicine.suggestion?.name,
    ...medicine.doseStatements.map((dose) => dose.text)].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());
  return terms.every((term) => fields.some((field) => field.includes(term)));
}
