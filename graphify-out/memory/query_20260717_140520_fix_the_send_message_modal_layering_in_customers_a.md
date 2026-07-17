---
type: "query"
date: "2026-07-17T14:05:20.455421+00:00"
question: "Fix the send-message modal layering in customers and conversations"
contributor: "graphify"
outcome: "useful"
source_nodes: ["campaign-composer.tsx", "PageHeader()", "contacts-view.tsx", "ConversationsPage()"]
---

# Q: Fix the send-message modal layering in customers and conversations

## Answer

Expanded from the original Persian request via graph vocab: conversation, contact, composer, dialog, header, blur, message, send. Both pages render CampaignLaunchButton inside the backdrop-filter PageHeader; CampaignComposer was therefore trapped in the header stacking context and clipped by overflow-hidden. The composer now portals to document.body at z-index 1000 while preserving dialog focus trapping and Escape handling.

## Outcome

- Signal: useful

## Source Nodes

- campaign-composer.tsx
- PageHeader()
- contacts-view.tsx
- ConversationsPage()