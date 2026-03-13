# Costs — Amazon Bedrock Guardrails

Reference: [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)

---

## How text units work

Pricing is based on **text units**. One text unit = up to **1,000 characters**.

The character count is the total length of the text submitted in a single `ApplyGuardrail` call. In this POC, name and description are checked in separate calls, so each is counted independently.

---

## Phase 1 — Word filter

**Cost: free**

The managed `PROFANITY` word list and custom word lists are not billed per text unit. There is no charge for running the word filter policy regardless of volume.

How it works: exact string matching against a list of blocked words/phrases. It does not use ML inference, which is why it has no per-unit cost.

---

## Phase 2 — Content filter

**Cost: $0.15 per 1,000 text units** (as of December 2024)

ML-based inference that classifies text across categories (hate, insults, sexual, violence, misconduct). This runs per `ApplyGuardrail` call and is only charged when Phase 1 passes.

---

## Cost example

**Scenario:** 1,000 users each create one public collection per month, using the maximum allowed characters — name (50 chars) + description (200 chars).

### Per collection

| Field | Characters | Text units |
|---|---|---|
| Name | 50 | 0.05 |
| Description | 200 | 0.20 |
| **Total** | **250** | **0.25** |

> Each field is a separate API call, but both are well under 1,000 chars so each rounds to a fraction of one text unit.

### Per month (1,000 collections)

| Phase | Text units | Price per 1,000 | Monthly cost |
|---|---|---|---|
| Word filter | 250 | free | $0.00 |
| Content filter | 250 | $0.15 | **$0.04** |

> Content filter only runs when word filter passes. In the worst case (all 1,000 collections pass Phase 1), the content filter cost is still $0.04/month.

### At higher volumes

| Collections/month | Content filter cost |
|---|---|
| 1,000 | $0.04 |
| 10,000 | $0.38 |
| 100,000 | $3.75 |
| 1,000,000 | $37.50 |

---

## Summary

For this use case (short user-generated text, two fields), Guardrails is extremely cheap. Even at 1 million collections/month the content filter cost is ~$37.50. The word filter is always free.
