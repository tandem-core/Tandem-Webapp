// Display helpers. Dates are calendar dates (YYYY-MM-DD), formatted in UTC so a
// due date never shifts by a day with the viewer's timezone.

export function shortDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function longDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export function clock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** How the owner sees a help request's state. */
export function requestStatusText(req) {
  const name = req.helperName;
  switch (req.status) {
    case "requested":
      return `Waiting for ${name} to reply`;
    case "accepted":
      return `${name} is taking care of it`;
    case "done":
      return req.helperNote ? `Done. ${name}: “${req.helperNote}”` : `${name} finished this`;
    case "declined":
      return req.helperNote ? `${name} can't do this: “${req.helperNote}”` : `${name} can't do this one`;
    default:
      return req.status;
  }
}

export function visitTitle(conversation) {
  return conversation.title || "Recorded conversation";
}
