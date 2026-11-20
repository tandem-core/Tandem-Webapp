import { demoVisits } from "@/lib/demo-visits";
import { prescriptionEntries } from "@/lib/prescription-entries";
import PrescriptionsList from "@/components/prescriptions-list";

export default function Prescriptions() {
  return <PrescriptionsList entries={prescriptionEntries(demoVisits)} />;
}
