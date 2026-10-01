/**
 * Live in-chat checkout test fixture.
 *
 * Creates (idempotently) an internal test workspace wired to the demo
 * WooCommerce store at https://vigent.ir/demo-shop:
 *   workspace (excluded from admin reports) → agent with order capture +
 *   payment links → chat link /c/<slug> → WooCommerce integration.
 *
 * Prints the integration secret and the plugin settings to apply on the demo
 * store. Run: npx tsx -r dotenv/config scripts/checkout-live-setup.ts [webhookBase]
 *   webhookBase defaults to https://vigent.ir (use http://127.0.0.1:3013 for a
 *   local staging server).
 */
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const WORKSPACE_SLUG = 'vigent-checkout-live-test'
const CHAT_SLUG = 'vigent-demo-shop'
const STORE_URL = 'https://vigent.ir/demo-shop'

async function main() {
  const webhookBase = (process.argv[2] || 'https://vigent.ir').replace(/\/$/, '')
  let workspace = await prisma.workspace.findUnique({ where: { slug: WORKSPACE_SLUG } })
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'فروشگاه آزمایشی پرداخت در چت',
        slug: WORKSPACE_SLUG,
        // TRIAL with a long end date: no billing records are created for tests.
        plan: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 90 * 24 * 3_600_000),
        aiCreditBalanceIRR: 5_000_000,
        businessType: 'COMMERCE',
        businessProfile: { businessName: 'فروشگاه آزمایشی ویجنت', services: ['مبلمان', 'دکوراسیون'] },
        onboardingStep: 4,
        onboardingCompleted: true,
        defaultModel: 'fast',
        language: 'fa',
        excludeFromAdminReports: true,
      },
    })
  } else {
    workspace = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        plan: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 90 * 24 * 3_600_000),
        ...(workspace.aiCreditBalanceIRR < 1_000_000 ? { aiCreditBalanceIRR: 5_000_000 } : {}),
      },
    })
  }

  let agent = await prisma.agent.findFirst({ where: { workspaceId: workspace.id } })
  const agentData = {
    name: 'فروشندهٔ فروشگاه آزمایشی',
    description: 'مشاور فروش مبلمان و دکوراسیون با سبد خرید و لینک پرداخت داخل گفتگو',
    systemPrompt: 'تو فروشندهٔ مشاور یک فروشگاه آنلاین مبلمان و دکوراسیون هستی. کوتاه، گرم و دقیق جواب بده و فقط از کاتالوگ فروشگاه محصول پیشنهاد کن.',
    model: 'fast',
    language: 'fa',
    welcomeMessage: 'سلام! برای انتخاب مبلمان و دکوراسیون کمکتون می‌کنم؛ همین‌جا هم می‌تونید سفارش بدید.',
    handoffEnabled: false,
    requireCustomerInfo: false,
    productAccessEnabled: true,
    productAccessConfigured: true,
    orderTrackingEnabled: true,
    orderTrackingConfigured: true,
    orderCaptureEnabled: true,
    restockAlertsEnabled: true,
    payLinkEnabled: true,
    payLinkTtlHours: 24,
    active: true,
  }
  agent = agent
    ? await prisma.agent.update({ where: { id: agent.id }, data: agentData })
    : await prisma.agent.create({ data: { ...agentData, workspaceId: workspace.id } })

  const chatLink = await prisma.chatLink.upsert({
    where: { agentId: agent.id },
    update: { enabled: true },
    create: { workspaceId: workspace.id, agentId: agent.id, slug: CHAT_SLUG, enabled: true },
  })

  // Web widget embedded on the demo store itself (and the chat link above).
  await prisma.agentChannel.upsert({
    where: { agentId_type: { agentId: agent.id, type: 'WEB_WIDGET' } },
    update: { active: true },
    create: { agentId: agent.id, type: 'WEB_WIDGET', active: true, config: { allowedDomains: ['vigent.ir'], title: 'مشاور فروش' } },
  })

  let integration = await prisma.storeIntegration.findFirst({ where: { workspaceId: workspace.id, type: 'WOOCOMMERCE' } })
  if (!integration) {
    integration = await prisma.storeIntegration.create({
      data: {
        workspaceId: workspace.id,
        type: 'WOOCOMMERCE',
        storeUrl: STORE_URL,
        credentials: {},
        webhookSecret: crypto.randomBytes(24).toString('hex'),
        pollIntervalMinutes: 0,
        active: true,
      },
    })
  }

  console.log(JSON.stringify({
    workspaceId: workspace.id,
    agentId: agent.id,
    chatLink: `https://vigent.ir/c/${chatLink.slug}`,
    integrationId: integration.id,
    pluginVersion: integration.pluginVersion,
    plugin: {
      webhook_url: `${webhookBase}/api/sync/woocommerce?token=${integration.webhookSecret}`,
      webhook_secret: integration.webhookSecret,
    },
  }, null, 2))
}

main().finally(() => prisma.$disconnect())
