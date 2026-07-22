---
type: "query"
date: "2026-07-22T00:43:36.332645+00:00"
question: "خطا و ارور داریم: Prisma knowledgeBase.count Unknown argument workspace"
contributor: "graphify"
outcome: "useful"
source_nodes: ["page.tsx", "reporting-scope.ts"]
---

# Q: خطا و ارور داریم: Prisma knowledgeBase.count Unknown argument workspace

## Answer

Expanded from original query via graph vocab: [knowledge, base, workspace, agent, admin, count, exclude, report, ready, prisma]. Root cause: KnowledgeBase has no workspace relation; it belongs to Agent, which owns the workspace relation. Fixed admin agents ready-knowledge count to use a typed ADMIN_VISIBLE_KNOWLEDGE_WHERE filter through agent.workspace. Focused tests, TypeScript, diff check, production build, and graph update passed.

## Outcome

- Signal: useful

## Source Nodes

- page.tsx
- reporting-scope.ts