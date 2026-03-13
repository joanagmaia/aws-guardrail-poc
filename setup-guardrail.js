/**
 * setup-guardrail.js
 *
 * Creates or updates two Amazon Bedrock Guardrails:
 *   1. Word filter only (free) — GUARDRAIL_ID
 *   2. Content filter only (paid) — CONTENT_GUARDRAIL_ID
 *
 * Run once: node setup-guardrail.js
 * Then copy the printed IDs into your .env file.
 */

import "dotenv/config";
import {
  BedrockClient,
  CreateGuardrailCommand,
  UpdateGuardrailCommand,
} from "@aws-sdk/client-bedrock";

const client = new BedrockClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const SHARED = {
  blockedInputMessaging: "Your input contains content that is not allowed.",
  blockedOutputsMessaging: "The generated content was blocked.",
};

const wordFilterParams = {
  ...SHARED,
  name: "collection-word-filter",
  description:
    "Phase 1: Profanity word filter for collection names and descriptions.",
  wordPolicyConfig: {
    managedWordListsConfig: [{ type: "PROFANITY" }],
  },
};

const contentFilterParams = {
  ...SHARED,
  name: "collection-content-filter",
  description: "Phase 2: Content filter for collection names and descriptions.",
  contentPolicyConfig: {
    filtersConfig: [
      { type: "HATE", inputStrength: "HIGH", outputStrength: "HIGH" },
      { type: "INSULTS", inputStrength: "HIGH", outputStrength: "HIGH" },
      { type: "SEXUAL", inputStrength: "HIGH", outputStrength: "HIGH" },
      { type: "VIOLENCE", inputStrength: "HIGH", outputStrength: "HIGH" },
      { type: "MISCONDUCT", inputStrength: "HIGH", outputStrength: "HIGH" },
    ],
  },
};

async function createOrUpdate(params, existingId, envKey) {
  let response;
  if (existingId) {
    response = await client.send(
      new UpdateGuardrailCommand({
        guardrailIdentifier: existingId,
        ...params,
      }),
    );
    console.log(`✅ "${params.name}" updated — ID: ${response.guardrailId}`);
  } else {
    response = await client.send(new CreateGuardrailCommand(params));
    console.log(`✅ "${params.name}" created — ID: ${response.guardrailId}`);
    console.log(`   Add to .env: ${envKey}=${response.guardrailId}`);
  }
}

try {
  await createOrUpdate(
    wordFilterParams,
    process.env.GUARDRAIL_ID,
    "GUARDRAIL_ID",
  );
  await createOrUpdate(
    contentFilterParams,
    process.env.CONTENT_GUARDRAIL_ID,
    "CONTENT_GUARDRAIL_ID",
  );
} catch (err) {
  console.error("Failed:", err.message);
  process.exit(1);
}
