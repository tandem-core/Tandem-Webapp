import { getFamilyData } from "@/lib/family-demo";
import { prescriptionEntries } from "@/lib/prescription-entries";
import PrescriptionsList from "@/components/prescriptions-list";

export default async function SharedPrescriptions() {
  const { sharedVisits } = await getFamilyData();
  return <PrescriptionsList entries={prescriptionEntries(sharedVisits)} visitBase="/family-demo/visits" family />;
}
