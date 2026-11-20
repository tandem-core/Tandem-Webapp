import ActionItemsList from "@/components/action-items-list";
import { getFamilyData } from "@/lib/family-demo";

export default async function SharedActionItems() {
  const { sharedVisits, sharedActionItems } = await getFamilyData();
  return <main className="home-content" id="main-content"><h1>Action items</h1>
    <ActionItemsList allVisits tasks={sharedActionItems} latest={sharedVisits[0]} family />
  </main>;
}
