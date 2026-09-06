// Run with: tsx -r dotenv/config scripts/agent-closing-smoke.ts
// Uses an isolated temporary workspace; never delivers messages to external channels.
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { startChat, generateReply } from '@/lib/ai/chat-engine'

async function main() {
  const workspace = await prisma.workspace.create({data:{name:'Closing verification',slug:`closing-verify-${Date.now()}`,plan:'TRIAL',trialEndsAt:new Date(Date.now()+3600000),aiCreditBalanceIRR:100000,excludeFromAdminReports:true,onboardingCompleted:true}})
  let calls=0
  const originalFetch=globalThis.fetch
  try {
    const agent=await prisma.agent.create({data:{workspaceId:workspace.id,name:'Closing verification',systemPrompt:'Always end with a question.',language:'fa',handoffEnabled:false,requireCustomerInfo:false,productAccessEnabled:true}})
    globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
      if (/openrouter/.test(String(args[0]))) { calls++;throw new Error('Closing must not call embedding or completion APIs') }
      return originalFetch(...args)
    }
    for (const channel of ['WEB_WIDGET','API','TELEGRAM','INSTAGRAM','WHATSAPP','BALE','RUBIKA'] as const) {
      const conversation=await prisma.conversation.create({data:{workspaceId:workspace.id,agentId:agent.id,channel,customerInfoState:'skipped',messageCount:2,messages:{create:[{role:'USER',content:'هزینه ارسال؟',createdAt:new Date(Date.now()-2000)},{role:'ASSISTANT',content:'۱۲۸ هزار تومان.',createdAt:new Date(Date.now()-1000)}]}}})
      const params={workspaceId:workspace.id,agent:agent as any,conversationId:conversation.id,channel,message:'ممنون'}
      if (channel==='WEB_WIDGET') {
        const result=await startChat(params)
        assert('stream' in result, JSON.stringify(result))
        const events=await new Response(result.stream).text()
        assert(events.includes('خواهش می‌کنم.'))
        assert(events.includes('"type":"done"'))
      } else {
        const result=await generateReply(params)
        assert('reply' in result,JSON.stringify(result))
        assert.equal(result.reply,'خواهش می‌کنم.')
      }
      const saved=await prisma.message.findMany({where:{conversationId:conversation.id},orderBy:{createdAt:'asc'}})
      assert.equal(saved.length,4)
      assert.equal(saved.at(-1)?.content,'خواهش می‌کنم.')
      console.log('PASS',channel,'persisted closing without AI')
    }
    const balance=await prisma.workspace.findUniqueOrThrow({where:{id:workspace.id}})
    assert.equal(balance.aiCreditBalanceIRR,100000)
    assert.equal(balance.aiCreditReservedIRR,0)
    const usage=await prisma.usageLog.findMany({where:{workspaceId:workspace.id}})
    assert.equal(usage.length,7)
    assert(usage.every(u=>u.status==='RELEASED'&&u.promptTokens===0&&u.completionTokens===0&&u.chargedIRR===0))
    assert.equal(calls,0)
    console.log('PASS credit unchanged, no reservations, zero provider calls')
  } finally {
    globalThis.fetch=originalFetch
    await prisma.workspace.delete({where:{id:workspace.id}})
    await prisma.$disconnect()
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})
