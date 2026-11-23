// Medication reconciliation: finds medications in a transcript, checks the names
// against RxNorm, and decides which ones the owner must check by listening.
//
// Principles (see docs/mvp-plan.md, "Source-verified recall"):
// - The transcript is never rewritten. A likely correct name is a suggestion
//   until the owner confirms it after hearing the audio.
// - A suggestion needs support from the conversation. A spelling-only RxNorm
//   match is not enough ("Zitramycin" spells like Vibramycin but the
//   conversation is about azithromycin), so with no context it's "unidentified".
// - Doses and frequencies are quoted as transcribed, never filled in from what's
//   typical. Conflicting amounts are flagged and resolved only by the care team.
// - Owner confirmation resolves "what was said", not "what is correct". The
//   app words it as "you identified it as ...".
import { callStructured, s } from "./claude.mjs";
import { transcriptText } from "./conversation.mjs";
import { exactMatch, approximateMatches, ingredients, flushRxNormCache } from "./rxnorm.mjs";

const SYSTEM = `You find medications in a transcript of a health conversation (doctor visit, pharmacy counseling, or similar) for Tandem, an app that helps older adults remember what was said. The transcript comes from automatic speech recognition, which often misspells drug names ("Lenzaprazole" for lansoprazole).

List each distinct medication once, merging the different spellings the transcript uses for the same drug. For each:
- kind: "specific" for a particular drug (lansoprazole, Tylenol); "family" for a drug family or general product type rather than one drug (penicillin as an allergy, "flu jab", "antacids", "statins").
- spellings: every spelling the transcript uses for it, exactly as written, most frequent first. Include partial or garbled ones you're confident refer to it.
- contextGuess: if the spellings look garbled or aren't a real drug name, the drug the conversation most likely refers to, based on what the conversation says about it (what it treats, its drug class, dose discussed). Null if the spelling already looks like a correct drug name, or if the conversation doesn't give you enough to guess.
- contextReason: what in the conversation supports contextGuess, in a short phrase. Null when contextGuess is null.
- role: what happened to it in this conversation. existing = already taking, no change; changed = dose or schedule changed; started = newly prescribed or chosen; proposed = suggested but not settled; not_chosen = considered and rejected; stopped = told to stop; avoid = told not to take; discussed = mentioned only; unclear = can't tell.
- roleDetail: one plain sentence on what was said about it.
- doseStatements: each statement of amount, strength, or frequency for this drug, copied word for word from the transcript (no normalising, no units added), with its line numbers. Empty if none. Set unclear to true only when the transcription itself looks wrong: garbled words ("100 my grams"), a cut-off number, or a unit that can't be right. Speech recognition often drops the first word of a number, so treat these as unclear too: a unit with no number before it ("okay, micrograms"), and a bare "hundred" or "thousand" with nothing in front ("Hundred milligrams", which may have been "four hundred"). A speaker being vague ("two or three times") is not unclear; listening again wouldn't change it.
- doseConflict: true if the transcript gives different amounts or frequencies for the same plan for this drug and the conversation doesn't clearly settle which is right. A deliberate change (from 30 mg to 15 mg) is not a conflict.
- doseConflictNote: what conflicts, quoting both, or null.
- doseCorrected: true if a speaker said one amount or frequency for this drug and then corrected it ("five hundred milligram. Three hundred. Oh, three hundred milligram"). Report it even when the correction seems clear: a misspoken dose is worth the owner hearing for themselves. A planned change discussed as a change (reduce from 30 mg to 15 mg) is not a correction.
- doseCorrectionNote: what was said first and what it was corrected to, quoting both, or null.
- evidence: line numbers where it's mentioned.

Only include drugs (prescription or over-the-counter medicines, vaccines, supplements taken as medicine). Skip drug classes mentioned generically ("antibiotics", "blood thinners"). When a class word stands in for an unnamed drug the patient takes ("the anticoagulant", "your blood thinner"), include it with kind "family": there is no drug name to check, and the owner may need to ask which drug it was. Never invent a dose, frequency, or drug that isn't in the transcript.`;

const ROLES = ["existing", "changed", "started", "proposed", "not_chosen", "stopped", "avoid", "discussed", "unclear"];

export const MEDICATION_SCHEMA = s.obj({
  medications: s.arr(
    s.obj({
      kind: s.enum(["specific", "family"]),
      spellings: s.arr(s.str()),
      contextGuess: s.nullable(s.str()),
      contextReason: s.nullable(s.str()),
      role: s.enum(ROLES),
      roleDetail: s.str(),
      doseStatements: s.arr(s.obj({ text: s.str(), unclear: s.bool(), evidence: s.evidence() })),
      doseConflict: s.bool(),
      doseConflictNote: s.nullable(s.str()),
      doseCorrected: s.bool(),
      doseCorrectionNote: s.nullable(s.str()),
      evidence: s.evidence(),
    }),
  ),
});

const norm = (x) => String(x ?? "").trim().toLowerCase();

/**
 * Runs extraction plus RxNorm reconciliation.
 * @param {object} conversation
 * @param {object} [opts]  { client, rx } - injectable Claude client and RxNorm functions
 * @returns {Promise<object>} medication review, see reconcile()
 */
export async function reviewMedications(conversation, { client, rx, effort = "high" } = {}) {
  const user = `Transcript (each line starts with its line number in brackets):\n${transcriptText(conversation)}`;
  const { data } = await callStructured({ system: SYSTEM, user, schema: MEDICATION_SCHEMA, effort, client });
  const review = await reconcile(conversation, data.medications ?? [], rx);
  if (!rx) await flushRxNormCache();
  return review;
}

/**
 * nameState:
 *   clear        a spelling in the transcript is an RxNorm drug and no other drug is suspected
 *   suggested    no clean spelling, but the conversation points to a drug that exists in RxNorm
 *   unidentified no supported suggestion; the owner should listen and ask the care team
 *   general      a drug family or product type (penicillin allergy, flu jab); no name check
 * suggestion.basis: "spelling_and_context" when RxNorm's spelling match agrees with the
 *   conversation's guess, "context_only" when it doesn't.
 */
export async function reconcile(conversation, extracted, rx = { exactMatch, approximateMatches, ingredients }) {
  const maxIdx = conversation.segments.length - 1;
  const cleanIdx = (ev) => [...new Set((ev ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i <= maxIdx))].sort((a, b) => a - b);

  const medications = [];
  for (const [i, m] of extracted.entries()) {
    const spellings = [...new Set((m.spellings ?? []).map((x) => String(x).trim()).filter(Boolean))];
    if (!spellings.length) continue;

    const matches = [];
    for (const sp of spellings) {
      const hit = await rx.exactMatch(sp);
      if (hit) matches.push({ spelling: sp, ...hit });
    }
    const guess = m.contextGuess ? await rx.exactMatch(m.contextGuess) : null;
    let guessDiffers = guess && !matches.some((x) => norm(x.name) === norm(guess.name) || norm(x.spelling) === norm(m.contextGuess));
    // A brand and its generic (Risperdal / risperidone) are the same drug.
    if (guessDiffers && matches.length && rx.ingredients) {
      const guessIn = new Set(await rx.ingredients(guess.rxcui).catch(() => []));
      for (const x of matches) {
        if ((await rx.ingredients(x.rxcui).catch(() => [])).some((id) => guessIn.has(id))) guessDiffers = false;
      }
    }

    let nameState;
    let suggestion = null;
    let lexical = [];
    if (m.kind === "family") {
      nameState = "general";
    } else if (matches.length && !guessDiffers) {
      nameState = "clear";
    } else {
      lexical = (await Promise.all(spellings.slice(0, 3).map((sp) => rx.approximateMatches(sp, { max: 3 })))).flat();
      if (guess) {
        const agrees = lexical.some((l) => norm(l.name).includes(norm(guess.name)) || norm(guess.name).includes(norm(l.name)) || l.rxcui === guess.rxcui);
        nameState = "suggested";
        suggestion = { name: guess.name, rxcui: guess.rxcui, basis: agrees ? "spelling_and_context" : "context_only", reason: m.contextReason ?? null };
      } else {
        nameState = "unidentified";
      }
    }

    const doseStatements = (m.doseStatements ?? [])
      .map((d) => {
        const text = String(d.text ?? "").trim();
        return { text, unclear: Boolean(d.unclear), evidence: completeEvidence(conversation, text, cleanIdx(d.evidence)) };
      })
      .filter((d) => d.text);
    medications.push({
      id: `med-${i + 1}`,
      heardAs: spellings[0],
      spellings,
      rxnorm: matches[0] ? { rxcui: matches[0].rxcui, name: matches[0].name, tty: matches[0].tty } : null,
      lexicalMatches: lexical.map(({ rxcui, name, score }) => ({ rxcui, name, score })),
      kind: m.kind === "family" ? "family" : "specific",
      nameState,
      suggestion,
      role: ROLES.includes(m.role) ? m.role : "unclear",
      roleDetail: m.roleDetail ?? "",
      doseStatements,
      doseConflict: Boolean(m.doseConflict),
      doseConflictNote: m.doseConflictNote ?? null,
      doseCorrected: Boolean(m.doseCorrected),
      doseCorrectionNote: m.doseCorrectionNote ?? null,
      evidence: cleanIdx(m.evidence),
      ownerAnswer: null, // { answer: "yes" | "no" | "unsure", at }
      careTeamNote: null, // { text, at } - what the owner was told when they checked
    });
  }
  return { conversationId: conversation.id, generatedAt: new Date().toISOString(), medications };
}

const squash = (x) => String(x ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Speech-to-text line breaks often fall mid-phrase ("…prescribed the higher" /
 * "dose."). When a quoted amount isn't inside its cited lines but is once a
 * neighbouring line is added, cite that line too, so the clip plays the whole
 * phrase.
 */
export function completeEvidence(conversation, text, evidence) {
  const want = squash(text);
  if (!want || !evidence.length) return evidence;
  const joined = (idx) => squash(idx.map((i) => conversation.segments[i]?.text ?? "").join(" "));
  if (joined(evidence).includes(want)) return evidence;
  const first = evidence[0];
  const last = evidence.at(-1);
  for (const extra of [[last + 1], [first - 1], [first - 1, last + 1]]) {
    const idx = [...new Set([...evidence, ...extra])].filter((i) => i >= 0 && i < conversation.segments.length).sort((a, b) => a - b);
    if (joined(idx).includes(want)) return idx;
  }
  return evidence;
}

// ---- State helpers shared by the UI, recap, Ask and sharing ----

export function nameResolved(med) {
  return med.nameState === "clear" || med.nameState === "general" || med.ownerAnswer?.answer === "yes";
}

/**
 * Amounts that conflict, were corrected mid-sentence, or look mis-transcribed
 * need the care team's answer; listening alone doesn't settle a dose.
 */
export function doseNeedsCheck(med) {
  return med.doseConflict || med.doseCorrected || med.doseStatements.some((d) => d.unclear);
}

/** Which kind of amount check, for wording: "conflict" | "corrected" | "unclear" | null. */
export function doseCheckKind(med) {
  if (med.doseConflict) return "conflict";
  if (med.doseCorrected) return "corrected";
  if (med.doseStatements.some((d) => d.unclear)) return "unclear";
  return null;
}

export function doseResolved(med) {
  return !doseNeedsCheck(med) || Boolean(med.careTeamNote);
}

export function needsReview(med) {
  return !nameResolved(med) || !doseResolved(med);
}

/** How the app names a medication, without claiming more certainty than it has. */
export function displayName(med) {
  if (med.nameState === "clear" || med.nameState === "general") return med.heardAs;
  if (med.ownerAnswer?.answer === "yes" && med.suggestion) return med.suggestion.name;
  return `“${med.heardAs}” (name unclear)`;
}

/** Medication lines in an item's evidence that still need review. */
export function unresolvedMedsFor(review, indices) {
  if (!review) return [];
  const set = new Set(indices ?? []);
  return review.medications.filter(
    (m) => needsReview(m) && [...m.evidence, ...m.doseStatements.flatMap((d) => d.evidence)].some((i) => set.has(i)),
  );
}

/**
 * Text for the recap and Ask prompts: what Tandem may and may not say about
 * each medication. Empty string when there's nothing to say.
 */
export function medicationGuidance(review) {
  if (!review?.medications?.length) return "";
  const lines = review.medications.map((m) => {
    const spelled = m.spellings.map((x) => `"${x}"`).join(", ");
    let name;
    if (m.nameState === "clear") name = `name is clear (${m.heardAs}).`;
    else if (m.nameState === "general") name = `general term or drug family (${m.heardAs}), not a specific prescription.`;
    else if (m.ownerAnswer?.answer === "yes") name = `the owner listened to the recording and identified it as ${m.suggestion.name}. Say "you identified it as ${m.suggestion.name}"; don't present it as verified.`;
    else name = `NAME UNCONFIRMED. The recording may not have been transcribed correctly. Don't name it as a specific drug and don't use a corrected spelling; call it "the medication that sounded like '${m.heardAs}'" and tell the owner to listen to that part of the recording and confirm the name with their care team.`;
    const unclearDoses = m.doseStatements.filter((d) => d.unclear).map((d) => `"${d.text}"`);
    let dose = "";
    if (doseNeedsCheck(m) && m.careTeamNote) {
      dose = ` The amount was unclear in the recording; the owner checked with their care team and noted: "${m.careTeamNote.text}". Present that as what the owner noted.`;
    } else if (m.doseCorrected && !m.doseConflict) {
      dose = ` AMOUNT CORRECTED in the recording (${m.doseCorrectionNote ?? "an amount was said and then corrected"}). Say that the amount was corrected during the visit and quote what was said first and what it was corrected to. Don't present the corrected amount as confirmed; the owner should listen to that moment and confirm with their pharmacist or doctor.`;
    } else if (m.doseConflict) {
      dose = ` AMOUNTS CONFLICT in the recording (${m.doseConflictNote ?? "different amounts were said"}). Say which amounts were heard, as quoted (${m.doseStatements.map((d) => `"${d.text}"`).join(" and ")}), and that the recording doesn't settle which is right. Never present one as the answer; the owner should confirm with their pharmacist or doctor.`;
    } else if (unclearDoses.length) {
      dose = ` AMOUNT UNCLEAR: the transcript says ${unclearDoses.join(", ")}, which may be mis-transcribed. Quote it as written, don't interpret the unit or number, and tell the owner to listen to that part and confirm with their care team.`;
    }
    return `- ${spelled}: ${name}${dose}`;
  });
  return `Medication check (from Tandem's review of this recording; follow it over your own reading of the transcript):\n${lines.join("\n")}`;
}
