// One structured-output call to Claude (with OpenAI fallback). Callers pass a JSON schema
// and get back the parsed object; refusals and truncation become errors instead of bad JSON.
import Anthropic from "@anthropic-ai/sdk";

// Haiku is the cheapest current model and is enough for prototype testing.
// Set TANDEM_MODEL=claude-opus-5-5 to compare quality.
export const MODEL = process.env.TANDEM_MODEL ?? "claude-haiku-5-5";

// Server-side refusal fallback exists for these models only; Haiku has none.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export class ClaudeCallError extends Error {
  constructor(message, { stopReason, details } = {}) {
    super(message);
    this.name = "ClaudeCallError";
    this.stopReason = stopReason;
    this.details = details;
  }
}

let defaultClient;
function getClient() {
  // Resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile.
  defaultClient ??= new Anthropic();
  return defaultClient;
}

async function callOpenAIStructured({
  system,
  user,
  schema,
  model = process.env.OPENAI_STRUCTURED_MODEL ?? "gpt-4o-mini",
  url = "https://api.openai.com/v1/chat/completions",
  auth = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  reasoningEffort,
}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_output",
          strict: true,
          schema,
        },
      },
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new ClaudeCallError(`OpenAI call failed (${res.status}): ${errorText.slice(0, 500)}`);
  }
  const json = await res.json();
  const choice = json.choices?.[0];
  if (choice?.finish_reason === "refusal") {
    throw new ClaudeCallError("OpenAI declined the request", { stopReason: "refusal" });
  }
  if (choice?.finish_reason === "length") {
    throw new ClaudeCallError("Response hit max_tokens before the JSON was complete", { stopReason: "max_tokens" });
  }
  const content = choice?.message?.content;
  try {
    return { data: JSON.parse(content), usage: json.usage, model: json.model };
  } catch {
    throw new ClaudeCallError("Response was not valid JSON", { stopReason: choice?.finish_reason, details: content?.slice(0, 500) });
  }
}

/**
 * @param {object} args
 * @param {string} args.system
 * @param {string} args.user
 * @param {object} args.schema  JSON schema; every object needs additionalProperties:false
 * @param {"low"|"medium"|"high"|"xhigh"|"max"} [args.effort]
 * @param {object} [args.client]  injectable for tests
 * @returns {Promise<{ data: object, usage: object, model: string }>}
 */
export async function callStructured({ system, user, schema, effort = "medium", client, model = MODEL }) {
  // Testing track only: Azure OpenAI, used when all three variables are set (and no
  // test client is injected). Its v1 endpoint takes the same body as OpenAI; the
  // model is the deployment name. Thorough calls (effort "high": recaps and
  // medication reviews) can use a stronger AZURE_OPENAI_SUMMARY_DEPLOYMENT; the
  // rest (questions) run with no reasoning, for speed. With these unset, nothing
  // below changes.
  const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_SUMMARY_DEPLOYMENT } = process.env;
  if (!client && AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY && AZURE_OPENAI_DEPLOYMENT) {
    const thorough = effort === "high";
    return callOpenAIStructured({
      system,
      user,
      schema,
      model: (thorough && AZURE_OPENAI_SUMMARY_DEPLOYMENT) || AZURE_OPENAI_DEPLOYMENT,
      url: `${new URL(AZURE_OPENAI_ENDPOINT).origin}/openai/v1/chat/completions`,
      auth: { "api-key": AZURE_OPENAI_API_KEY },
      reasoningEffort: thorough ? "high" : "none",
    });
  }

  // If Anthropic is not configured but OpenAI is, route to OpenAI's structured outputs
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && process.env.OPENAI_API_KEY) {
    return callOpenAIStructured({ system, user, schema });
  }

  const anthropicClient = client ?? getClient();
  const params = {
    model,
    max_tokens: 16000,
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  };
  // A medical transcript can trip a safety classifier; where the model supports
  // it, let the API retry on its recommended fallback instead of failing.
  const response = FALLBACK_MODELS.has(model)
    ? await anthropicClient.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
    : await anthropicClient.messages.create(params);

  if (response.stop_reason === "refusal") {
    throw new ClaudeCallError("Claude declined the request", {
      stopReason: "refusal",
      details: response.stop_details,
    });
  }
  if (response.stop_reason === "max_tokens") {
    throw new ClaudeCallError("Response hit max_tokens before the JSON was complete", { stopReason: "max_tokens" });
  }

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return { data: JSON.parse(text), usage: response.usage, model: response.model };
  } catch {
    throw new ClaudeCallError("Response was not valid JSON", { stopReason: response.stop_reason, details: text.slice(0, 500) });
  }
}

// JSON-schema helpers; the API requires additionalProperties:false on every object.
export const s = {
  str: (description) => ({ type: "string", ...(description && { description }) }),
  bool: (description) => ({ type: "boolean", ...(description && { description }) }),
  nullable: (schema) => ({ anyOf: [schema, { type: "null" }] }),
  enum: (values, description) => ({ type: "string", enum: values, ...(description && { description }) }),
  arr: (items, description) => ({ type: "array", items, ...(description && { description }) }),
  obj: (properties) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }),
  evidence: () => ({
    type: "array",
    items: { type: "integer" },
    description: "Indices of the transcript lines that support this item, e.g. [5, 6]. Never empty.",
  }),
};
