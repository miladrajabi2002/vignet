# Runtime review contract

The reviewer receives sequential segments from exactly one conversation plus a running assessment. It updates the assessment using every segment seen so far and returns JSON only.

```json
{
  "intent": "customer need",
  "intentMessageIds": ["message-id"],
  "outcome": "RESOLVED | UNRESOLVED | UNKNOWN",
  "outcomeMessageIds": ["message-id"],
  "summary": "concise evidence-based account",
  "strengths": [
    { "title": "what worked", "messageIds": ["message-id"] }
  ],
  "findings": [
    {
      "kind": "KNOWLEDGE | BEHAVIOR | TOOL",
      "scope": "AGENT | CUSTOMER",
      "topicKey": "stable reusable key",
      "title": "short actionable title",
      "diagnosis": "root cause, uncertainty, and why the action helps",
      "priority": "HIGH | MEDIUM | LOW",
      "messageIds": ["message-id"],
      "draft": {
        "question": "reusable knowledge question or empty",
        "answer": "grounded knowledge answer, explicit customer preference, resolution note, or empty",
        "missing": "one precise owner question or empty",
        "targetKnowledgeId": null,
        "behaviorPath": null,
        "behaviorValue": null
      }
    }
  ]
}
```

Contract rules:

- `RESOLVED` and `UNRESOLVED` require at least one outcome message ID. `UNKNOWN` may use an empty list.
- Each strength and finding requires evidence. Intent requires evidence when the conversation contains customer messages.
- `CUSTOMER` requires an identified contact, `kind: BEHAVIOR`, an explicit preference in `draft.answer`, and no global behavior path or knowledge target.
- `KNOWLEDGE` drafts may contain business facts only when grounded in supplied approved knowledge or an explicit human-operator message. Otherwise `answer` stays empty and `missing` asks the owner for the minimum fact needed.
- `BEHAVIOR` with `AGENT` scope may select only server-supplied behavior paths and values. It must not restate a value already active.
- `TOOL` describes the source, integration, permission, or workflow that must be repaired; it must not disguise the problem as a new FAQ.
- Preserve earlier evidence while processing later segments. Keep no more than eight findings and five strengths.
- A response simulation compares the same historical turn with and without the proposed change. It never sends a customer message and never claims that a better simulation proves real-world improvement.
