import { Prisma, PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const since = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  const alerts = await p.handoffAlert.findMany({
    where: {},
    select: { id: true, conversationId: true, state: true, createdAt: true, reason: true },
    orderBy: { createdAt: 'desc' }, take: 400,
  });
  let leakCount = 0, openCount = 0; const leakSamples = [];
  for (const a of alerts) {
    if (a.state === 'open') openCount++;
    const aiMsgs = await p.message.findMany({
      where: { conversationId: a.conversationId, role: 'ASSISTANT', createdAt: { gt: a.createdAt }, OR: [{ metadata: { path: ['operator'], not: true } }, { metadata: { equals: Prisma.DbNull } }] },
      select: { createdAt: true, content: true, metadata: true },
      take: 2, orderBy: { createdAt: 'asc' },
    });
    if (aiMsgs.length > 0) {
      leakCount++;
      if (leakSamples.length < 6) leakSamples.push({
        alert: a.id.slice(-8), conv: a.conversationId, state: a.state,
        reason: (a.reason || '').slice(0, 40),
        alertAt: a.createdAt.toISOString().slice(5, 16),
        aiAfter: aiMsgs.map(m => ({ t: m.createdAt.toISOString().slice(5, 16), c: (m.content || '').replace(/\n/g, ' ').slice(0, 60) })),
      });
    }
  }
  console.log(`ALERTS total: ${alerts.length} | open: ${openCount} | conversations-with-AI-after-alert: ${leakCount}`);
  for (const s of leakSamples) console.log(JSON.stringify(s));
  // all-time state counts
  const st = await p.handoffAlert.groupBy({ by: ['state'], _count: { _all: true } });
  console.log('STATES:', JSON.stringify(st));
} catch (e) { console.error('ERROR:', e.message?.slice(0, 400)); }
await p.$disconnect();
