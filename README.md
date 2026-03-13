# Guardrail POC — Amazon Bedrock

## Purpose

POC to evaluate Amazon Bedrock Guardrails for moderating user-generated content in public collections.

Logged-in users can create public collections with a **name** (max 50 chars) and **description** (max 200 chars). This POC validates that both fields are free of profanity and sensitive content before a collection is allowed to be created.

---

## Implementation

Two guardrails are used in sequence to minimise cost:

### Phase 1 — Word filter (free)
Uses the AWS-managed `PROFANITY` word list plus an optional custom word list. Runs on every request. If this phase blocks, Phase 2 is skipped entirely.

### Phase 2 — Content filter (paid)
Uses AWS's ML-based content filters to catch broader categories of harmful content that a word list alone may miss.

| Category | Strength |
|---|---|
| Hate speech | HIGH |
| Insults | HIGH |
| Sexual content | HIGH |
| Violence | HIGH |
| Misconduct | HIGH |

If Phase 1 passes, Phase 2 runs. If Phase 2 blocks, the collection is rejected.

---

## Prerequisites

- Node.js 18+
- An AWS account with access to Amazon Bedrock
- IAM permissions: `bedrock:CreateGuardrail`, `bedrock:UpdateGuardrail`, `bedrock:ApplyGuardrail`

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your AWS credentials:

```bash
cp .env.example .env
```

```env
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
GUARDRAIL_ID=                     # filled after step 3
CONTENT_GUARDRAIL_ID=             # filled after step 3
GUARDRAIL_VERSION=DRAFT
```

> If you have AWS CLI configured locally (`~/.aws/credentials`), you can leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` blank — the SDK will pick up credentials automatically.

### 3. Create the guardrails

Run once to create both guardrails in AWS:

```bash
node setup-guardrail.js
```

Copy the printed IDs into your `.env`:

```
GUARDRAIL_ID=<word filter id>
CONTENT_GUARDRAIL_ID=<content filter id>
```

Re-run this script any time you change the guardrail configuration (e.g. adding custom words). It will update existing guardrails if the IDs are already in `.env`.

---

## Usage

```bash
node index.js --name "<collection name>" --description "<collection description>"
```

Both flags are optional but at least one is required.

### Examples

```bash
# Should pass
node index.js --name "My Photo Collection" --description "Landscape photography from my travels."

# Blocked by word filter (Phase 1)
node index.js --name "shit collection"

# Blocked by content filter (Phase 2)
node index.js --description "I hate all those people"

# Length validation error (no AWS call made)
node index.js --name "This name is way too long and exceeds the fifty character limit!!"
```

### Output

```
Phase 1 — Word filter (guardrail: abc123)...

  [NAME] ✅ PASSED

Phase 2 — Content filter (guardrail: xyz456)...

  [NAME] ✅ PASSED

──────────────────────────────────────
✅ All checks passed. Collection can be created.
```

```
Phase 1 — Word filter (guardrail: abc123)...

  [NAME] 🚫 BLOCKED
    Flagged words : shit

──────────────────────────────────────
🚫 Blocked by word filter. Collection cannot be created.
```

---

## Adding custom words

To block additional words beyond the AWS managed profanity list (e.g. "crap", "damn"), add them to `wordPolicyConfig.wordsConfig` in `setup-guardrail.js`:

```js
wordsConfig: [
  { text: "crap" },
  { text: "damn" },
],
```

Then re-run `node setup-guardrail.js` to apply the changes.

> Custom words are case-insensitive exact matches. Add variations manually if substring matching is needed (e.g. `"crappy"`).