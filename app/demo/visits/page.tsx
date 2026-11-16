import Icon from "@/components/demo-icon";

export default function Visits() {
  return (
    <main className="home-content" id="main-content">
      <h1>Visits</h1>
      <div className="empty-state">
        <Icon name="visit" />
        <h2>No visits yet</h2>
        <p>Your visits will appear here.</p>
      </div>
    </main>
  );
}
