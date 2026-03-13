/**
 * index.js
 *
 * POC: Test Amazon Bedrock Guardrails against collection name and description.
 *
 * Two-phase checks to minimise cost:
 *   Phase 1 — Word filter (free): runs always
 *   Phase 2 — Content filter (paid): only runs if Phase 1 passes
 *
 * Usage:
 *   node index.js --name "My Collection" --description "A great place to share content"
 */

import "dotenv/config";
import {
  BedrockRuntimeClient,
  ApplyGuardrailCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { parseArgs } from "node:util";

// ── Config ────────────────────────────────────────────────────────────────────

const GUARDRAIL_ID = process.env.GUARDRAIL_ID;
const CONTENT_GUARDRAIL_ID = process.env.CONTENT_GUARDRAIL_ID;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION || "DRAFT";
const AWS_REGION = process.env.AWS_REGION || "us-west-2";

const NAME_MAX_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 200;

// ── AWS client ────────────────────────────────────────────────────────────────

const client = new BedrockRuntimeClient({ region: AWS_REGION });

// ── Guardrail check ───────────────────────────────────────────────────────────

async function applyGuardrail(guardrailId, label, value) {
  const response = await client.send(
    new ApplyGuardrailCommand({
      guardrailIdentifier: guardrailId,
      guardrailVersion: GUARDRAIL_VERSION,
      source: "INPUT",
      content: [{ text: { text: value } }],
    }),
  );

  const passed = response.action === "NONE";
  const flaggedWords = [];
  const flaggedCategories = [];

  for (const assessment of response.assessments ?? []) {
    for (const w of assessment.wordPolicy?.customWords ?? []) {
      flaggedWords.push(w.match);
    }
    for (const w of assessment.wordPolicy?.managedWordLists ?? []) {
      flaggedWords.push(w.match);
    }
    for (const f of assessment.contentPolicy?.filters ?? []) {
      if (f.action === "BLOCKED") {
        flaggedCategories.push(`${f.type} (confidence: ${f.confidence})`);
      }
    }
  }

  return {
    label,
    value,
    passed,
    action: response.action,
    flaggedWords,
    flaggedCategories,
  };
}

// ── Validation helpers ────────────────────────────────────────────────────────

function validateLength(label, value, maxLength) {
  if (value.length > maxLength) {
    throw new Error(
      `"${label}" exceeds maximum length of ${maxLength} characters (got ${value.length}).`,
    );
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

function printResult(result) {
  const status = result.passed ? "✅ PASSED" : "🚫 BLOCKED";
  console.log(`\n  [${result.label.toUpperCase()}] ${status}`);
  if (result.flaggedWords.length > 0) {
    console.log(`    Flagged words      : ${result.flaggedWords.join(", ")}`);
  }
  if (result.flaggedCategories.length > 0) {
    console.log(
      `    Flagged categories : ${result.flaggedCategories.join(", ")}`,
    );
  }
  if (
    !result.passed &&
    result.flaggedWords.length === 0 &&
    result.flaggedCategories.length === 0
  ) {
    console.log(
      "    Flagged            : (policy triggered — details not disclosed by AWS)",
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!GUARDRAIL_ID) {
    console.error(
      "Error: GUARDRAIL_ID is not set. Run setup-guardrail.js first.",
    );
    process.exit(1);
  }

  const { values } = parseArgs({
    options: {
      name: { type: "string", short: "n" },
      description: { type: "string", short: "d" },
    },
  });

  if (!values.name && !values.description) {
    console.log(
      'Usage: node index.js --name "<name>" --description "<description>"',
    );
    console.log("At least one of --name or --description is required.");
    process.exit(1);
  }

  const fields = [];
  if (values.name) {
    validateLength("name", values.name, NAME_MAX_LENGTH);
    fields.push({ label: "name", value: values.name });
  }
  if (values.description) {
    validateLength("description", values.description, DESCRIPTION_MAX_LENGTH);
    fields.push({ label: "description", value: values.description });
  }

  // ── Phase 1: Word filter (free) ───────────────────────────────────────────
  console.log(`\nPhase 1 — Word filter (guardrail: ${GUARDRAIL_ID})...`);
  const wordResults = await Promise.all(
    fields.map((f) => applyGuardrail(GUARDRAIL_ID, f.label, f.value)),
  );
  wordResults.forEach((r) => printResult(r));

  const wordPassed = wordResults.every((r) => r.passed);
  if (!wordPassed) {
    console.log("\n──────────────────────────────────────");
    console.log("🚫 Blocked by word filter. Collection cannot be created.");
    process.exit(1);
  }

  // ── Phase 2: Content filter (paid) — only if Phase 1 passed ──────────────
  if (CONTENT_GUARDRAIL_ID) {
    console.log(
      `\nPhase 2 — Content filter (guardrail: ${CONTENT_GUARDRAIL_ID})...`,
    );
    const contentResults = await Promise.all(
      fields.map((f) => applyGuardrail(CONTENT_GUARDRAIL_ID, f.label, f.value)),
    );
    contentResults.forEach((r) => printResult(r));

    const contentPassed = contentResults.every((r) => r.passed);
    if (!contentPassed) {
      console.log("\n──────────────────────────────────────");
      console.log(
        "🚫 Blocked by content filter. Collection cannot be created.",
      );
      process.exit(1);
    }
  } else {
    console.log("\n(Phase 2 skipped — CONTENT_GUARDRAIL_ID not set)");
  }

  console.log("\n──────────────────────────────────────");
  console.log("✅ All checks passed. Collection can be created.");
}

main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
