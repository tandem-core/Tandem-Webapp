"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "@/app/demo/settings/settings.module.css";

export default function FamilyMembers() {
  const [members, setMembers] = useState([
    { id: "lisa", name: "Lisa Doe", relationship: "Daughter", email: "lisa.doe@gmail.com" },
  ]);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);

  function closeForm() {
    setAdding(false);
    addButton.current?.focus();
  }

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const relationship = String(data.get("relationship") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    if (!name || !relationship || !email) {
      setMessage("Please enter a name, relationship, and email.");
      return;
    }
    if (members.some((member) => member.email.toLowerCase() === email.toLowerCase())) {
      setMessage("A family member with this email is already listed.");
      return;
    }
    setMembers((current) => [...current, { id: crypto.randomUUID(), name, relationship, email }]);
    setMessage(`${name} added to your family members.`);
    closeForm();
  }

  return (
    <section className={styles.card} aria-labelledby="family-heading">
      <h2 id="family-heading">Family members</h2>
      {members.length === 0 && <p className={styles.description}>No family members yet. Add someone to get started.</p>}
      <ul className={styles.list}>
        {members.map((member) => (
          <li className={styles.member} key={member.id}>
            <span className={styles.avatar} aria-hidden="true">{member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
            <div className={styles.memberDetails}>
              <div className={styles.memberHeading}>
                <h3>{member.name}</h3>
                <span className={styles.relationship}>{member.relationship}</span>
              </div>
              <p className={styles.email}>{member.email}</p>
            </div>
            <button type="button" className={styles.removeButton} aria-label={`Remove ${member.name}`} onClick={() => {
              setMembers((current) => current.filter(({ id }) => id !== member.id));
              setMessage(`${member.name} removed from your family members.`);
              addButton.current?.focus();
            }}>Remove</button>
          </li>
        ))}
      </ul>
      <button ref={addButton} type="button" className={styles.addButton} aria-expanded={adding} aria-controls="add-family-form" onClick={() => {
        setAdding((current) => !current);
        setMessage("");
      }}>Add family member</button>
      {adding && <form id="add-family-form" className={styles.form} onSubmit={addMember}>
        <label htmlFor="family-name">Name</label>
        <input id="family-name" name="name" autoComplete="name" required maxLength={100} autoFocus />
        <label htmlFor="family-relationship">Relationship</label>
        <input id="family-relationship" name="relationship" placeholder="e.g. Son" required maxLength={60} />
        <label htmlFor="family-email">Email</label>
        <input id="family-email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <div className={styles.formActions}>
          <button className={styles.saveButton} type="submit">Add member</button>
          <button className={styles.cancelButton} type="button" onClick={() => { closeForm(); setMessage(""); }}>Cancel</button>
        </div>
      </form>}
      <p className={styles.description} role="status">{message}</p>
    </section>
  );
}
