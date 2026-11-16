import Icon from "@/components/demo-icon";

export default function Prescriptions() {
  return (
    <main className="home-content" id="main-content">
      <h1>Prescriptions</h1>
      <div className="empty-state">
        <Icon name="prescription" />
        <h2>No prescriptions yet</h2>
        <p>Your prescriptions will appear here.</p>
      </div>
    </main>
  );
}
