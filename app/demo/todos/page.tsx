import VisitTodos from "@/components/visit-todos";

export default function Todos() {
  return (
    <main className="home-content" id="main-content">
      <h1>Action items</h1>
      <VisitTodos allVisits />
    </main>
  );
}
