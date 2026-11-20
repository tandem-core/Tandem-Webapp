import ActionItemsList from "@/components/action-items-list";
import { demoVisits } from "@/lib/demo-visits";
import { demoTodos } from "@/lib/demo-todos";

export default function VisitTodos({ allVisits = false }: { allVisits?: boolean }) {
  return <ActionItemsList allVisits={allVisits} tasks={demoTodos} latest={demoVisits[0]} />;
}
