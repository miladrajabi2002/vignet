/**
 * Demo seed script — creates a fully-populated demo workspace so anyone can
 * explore the dashboard without a real phone/SMS.
 *
 * Run with: `bun run seed:demo`
 * Login with: phone 09120000000, code 123456
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_PHONE = '+989120000000'

async function main() {
  // Clean up any previous demo data (idempotent re-runs)
  const existingUser = await prisma.user.findUnique({ where: { phone: DEMO_PHONE } })
  if (existingUser) {
    // Delete the whole workspace cascade
    const ws = await prisma.workspace.findUnique({ where: { id: existingUser.workspaceId } })
    if (ws) {
      await prisma.workspace.delete({ where: { id: ws.id } })
    }
  }

  // 1. Create workspace with COMMERCE business type, onboarding completed
  const workspace = await prisma.workspace.create({
    data: {
      name: 'فروشگاه دمو ویجنت',
      slug: 'demo-store-' + Math.random().toString(36).slice(2, 8),
      plan: 'PRO',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      aiCreditBalanceIRR: 6_000_000, // 600k toman
      businessType: 'COMMERCE',
      businessProfile: {
        businessName: 'فروشگاه دمو ویجنت',
        services: ['فروش آنلاین پوشاک', 'مشاوره استایل', 'ارسال سریع'],
      },
      onboardingStep: 4,
      onboardingCompleted: true,
      defaultModel: 'fast',
      language: 'fa',
    },
  })

  // 2. Create demo user
  const user = await prisma.user.create({
    data: {
      phone: DEMO_PHONE,
      name: 'کاربر دمو ویجنت',
      workspaceId: workspace.id,
    },
  })

  // 3. Create an agent with 6-layer prompt config
  const agent = await prisma.agent.create({
    data: {
      workspaceId: workspace.id,
      name: 'مشاور فروش دمو',
      description: 'ایجنت مشاور فروش برای فروشگاه پوشاک — موجودی، قیمت و مشاوره استایل',
      systemPrompt: 'تو یک مشاور فروش حرفه‌ای پوشاک هستی.',
      roleTemplate: 'sales_consultant',
      model: 'fast',
      language: 'fa',
      temperature: 0.55,
      maxTokens: 600,
      welcomeMessage: 'سلام! برای انتخاب محصول، بررسی موجودی یا مشاوره استایل در کنارتان هستم.',
      fallbackMessage: 'اگر مطمئن نیستم، همکار انسانی شما را راهنمایی می‌کند.',
      handoffEnabled: true,
      handoffMessage: 'لطفاً صبر کنید، همکار متخصص شما را پیگیری می‌کند.',
      handoffKeywords: ['اپراتور', 'شکایت', 'پرداخت'],
      active: true,
      promptConfig: {
        personality: 'مشاور حرفه‌ای و خوش‌لحن پوشاک با دانش عمیق از مد و استایل.',
        tone: 'صمیمی، مودب، کمک‌کننده؛ فارسی روان.',
        doSay: ['موجودی و قیمت دقیق را بگو', 'مشاوره استایل بده', 'لینک خرید ارسال کن'],
        dontSay: ['اطلاعات ساختگی نده', 'قیمت حدسی نگو', 'بدون تأیید، سفارش ثبت نکن'],
        fallbackBehavior: 'اگر مطمئن نیستم، صادقانه بگو نمی‌دانم و به اپراتور ارجاع می‌دهم.',
        format: { bold: true, emoji: false, links: true, bullets: true, length: 'medium' },
        qaPairs: [
          { question: 'موجودی سایز ۴۰ چیست؟', answer: 'بله، سایز ۴۰ موجود است. لینک خرید ارسال شد.' },
          { question: 'هزینه ارسال چقدر است؟', answer: 'ارسال برای سفارش‌های بالای ۵۰۰ هزار تومان رایگان است.' },
        ],
      },
    },
  })

  // 4. Create product category + products
  const category = await prisma.productCategory.create({
    data: {
      workspaceId: workspace.id,
      name: 'پوشاک',
      slug: 'clothing-' + Math.random().toString(36).slice(2, 6),
      sortOrder: 0,
    },
  })

  const products = await Promise.all([
    prisma.product.create({
      data: {
        workspaceId: workspace.id,
        categoryId: category.id,
        name: 'مانتو زمستانی مشکی',
        description: 'مانتو زمستانی با جنس پشم گرم، رنگ مشکی، سایزبندی ۳۸ تا ۴۶.',
        price: 2_390_000,
        comparePrice: 2_990_000,
        sku: 'MNT-001',
        stock: 12,
        tags: ['زمستان', 'زنانه', 'مانتو'],
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        workspaceId: workspace.id,
        categoryId: category.id,
        name: 'پیراهن مردانه آستین‌بلند',
        description: 'پیراهن مردانه کتان، آستین‌بلند، رنگ سرمه‌ای.',
        price: 1_450_000,
        sku: 'SHRT-002',
        stock: 25,
        tags: ['مردانه', 'پیراهن'],
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        workspaceId: workspace.id,
        categoryId: category.id,
        name: 'شلوار جین زنانه',
        description: 'شلوار جین اسلیم‌فیت، رنگ آبی روشن، سایزبندی ۳۶ تا ۴۴.',
        price: 1_890_000,
        sku: 'JNS-003',
        stock: 8,
        tags: ['زنانه', 'جین'],
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        workspaceId: workspace.id,
        categoryId: category.id,
        name: 'کاپشن پاییزه',
        description: 'کاپشن پاییزه سبک، ضدآب، رنگ کرم.',
        price: 3_200_000,
        comparePrice: 3_800_000,
        sku: 'KPSH-004',
        stock: 5,
        tags: ['پاییز', 'کاپشن'],
        active: true,
      },
    }),
  ])

  // Link all products to the agent's catalog
  await prisma.agentCatalog.createMany({
    data: products.map((p) => ({ agentId: agent.id, productId: p.id })),
  })

  // 5. Create contacts
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        name: 'سارا محمدی',
        phone: '+989121111111',
        instagramUsername: 'sara.m',
        stage: 'customer',
        tags: ['مشتری وفادار'],
        lastActivityAt: new Date(),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        name: 'امیر رضایی',
        phone: '+989122222222',
        telegramUsername: 'amir_r',
        stage: 'qualified',
        tags: ['سرنخ گرم'],
        lastActivityAt: new Date(Date.now() - 3600_000),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        name: 'نگار احمدی',
        phone: '+989123333333',
        whatsappName: 'Negar',
        stage: 'lead',
        tags: [],
        lastActivityAt: new Date(Date.now() - 7200_000),
      },
    }),
    prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        name: 'محمد کریمی',
        phone: '+989124444444',
        stage: 'customer',
        tags: ['خرید عمده'],
        lastActivityAt: new Date(Date.now() - 86400_000),
      },
    }),
  ])

  // 6. Create conversations with messages
  const now = new Date()
  const conv1 = await prisma.conversation.create({
    data: {
      workspaceId: workspace.id,
      agentId: agent.id,
      contactId: contacts[0].id,
      channel: 'INSTAGRAM',
      status: 'OPEN',
      summary: 'سؤال درباره موجودی مانتو مشکی سایز ۴۰ — موجودی تأیید شد، لینک خرید ارسال شد.',
      messageCount: 4,
      lastMessageAt: new Date(now.getTime() - 600_000),
    },
  })
  await prisma.message.createMany({
    data: [
      { conversationId: conv1.id, role: 'USER', content: 'سلام، مانتو مشکی سایز ۴۰ دارید؟', createdAt: new Date(now.getTime() - 900_000) },
      { conversationId: conv1.id, role: 'ASSISTANT', content: 'سلام! بله، مانتو زمستانی مشکی سایز ۴۰ موجود است. قیمت ۲٬۳۹۰٬۰۰۰ تومان است.', createdAt: new Date(now.getTime() - 880_000) },
      { conversationId: conv1.id, role: 'USER', content: 'هزینه ارسال چقدره؟', createdAt: new Date(now.getTime() - 700_000) },
      { conversationId: conv1.id, role: 'ASSISTANT', content: 'ارسال برای سفارش‌های بالای ۵۰۰ هزار تومان رایگانه. لینک خرید ارسال شد ✅', createdAt: new Date(now.getTime() - 600_000) },
    ],
  })

  const conv2 = await prisma.conversation.create({
    data: {
      workspaceId: workspace.id,
      agentId: agent.id,
      contactId: contacts[1].id,
      channel: 'TELEGRAM',
      status: 'HANDED_OFF',
      handedOff: true,
      summary: 'مشتری درخواست مشاوره استایل برای مهمانی داشت — به اپراتور منتقل شد.',
      messageCount: 3,
      lastMessageAt: new Date(now.getTime() - 3600_000),
    },
  })
  await prisma.message.createMany({
    data: [
      { conversationId: conv2.id, role: 'USER', content: 'برای یه مهمانی رسمی چی بپوشم؟', createdAt: new Date(now.getTime() - 4000_000) },
      { conversationId: conv2.id, role: 'ASSISTANT', content: 'بسته به سلیقه‌تان داریم. برای مشاوره تخصصی شما را به همکار متخصص وصل می‌کنم.', createdAt: new Date(now.getTime() - 3800_000) },
      { conversationId: conv2.id, role: 'USER', content: 'ممنون، منتظرم.', createdAt: new Date(now.getTime() - 3600_000) },
    ],
  })

  const conv3 = await prisma.conversation.create({
    data: {
      workspaceId: workspace.id,
      agentId: agent.id,
      contactId: contacts[2].id,
      channel: 'WHATSAPP',
      status: 'RESOLVED',
      summary: 'پیگیری سفارش — وضعیت ارسال اعلام شد، تحویل فردا.',
      messageCount: 4,
      lastMessageAt: new Date(now.getTime() - 86400_000),
    },
  })
  await prisma.message.createMany({
    data: [
      { conversationId: conv3.id, role: 'USER', content: 'سفارشم کی میرسه؟', createdAt: new Date(now.getTime() - 90000_000) },
      { conversationId: conv3.id, role: 'ASSISTANT', content: 'سفارش شما ارسال شده و فردا بین ۱۲ تا ۱۵ تحویل داده می‌شود.', createdAt: new Date(now.getTime() - 89000_000) },
      { conversationId: conv3.id, role: 'USER', content: 'ممنون', createdAt: new Date(now.getTime() - 86400_000) },
      { conversationId: conv3.id, role: 'ASSISTANT', content: 'خواهش می‌کنم! سؤال دیگری بود در خدمتم.', createdAt: new Date(now.getTime() - 86000_000) },
    ],
  })

  // 7. Create a booking service + availability rules + a few appointments
  const service = await prisma.service.create({
    data: {
      workspaceId: workspace.id,
      slug: 'style-consultation',
      name: 'مشاوره استایل',
      description: 'مشاوره حضوری استایل و انتخاب لباس مناسب.',
      durationMinutes: 45,
      slotIntervalMinutes: 45,
      capacity: 1,
      timezone: 'Asia/Tehran',
      location: 'فروشگاه مرکزی',
      active: true,
    },
  })

  // Weekly rules: Saturday–Thursday 10:00–18:00 (minutes from midnight)
  const weekdays = [6, 0, 1, 2, 3, 4] // Sat, Sun, Mon, Tue, Wed, Thu
  await prisma.serviceAvailabilityRule.createMany({
    data: weekdays.map((wd) => ({
      serviceId: service.id,
      weekday: wd,
      startMinute: 10 * 60, // 10:00
      endMinute: 18 * 60,   // 18:00
      active: true,
    })),
  })

  // A few appointments — some today, some tomorrow
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Helper to create a Date at a specific hour on a given day
  function atHour(day: Date, hour: number, min = 0): Date {
    const d = new Date(day)
    d.setHours(hour, min, 0, 0)
    return d
  }

  await prisma.appointment.createMany({
    data: [
      {
        workspaceId: workspace.id,
        serviceId: service.id,
        contactId: contacts[0].id,
        customerName: 'سارا محمدی',
        customerPhone: '+989121111111',
        startsAt: atHour(today, 14, 0),
        endsAt: atHour(today, 14, 45),
        timezone: 'Asia/Tehran',
        partySize: 1,
        status: 'CONFIRMED',
        source: 'agent',
      },
      {
        workspaceId: workspace.id,
        serviceId: service.id,
        contactId: contacts[3].id,
        customerName: 'محمد کریمی',
        customerPhone: '+989124444444',
        startsAt: atHour(today, 16, 0),
        endsAt: atHour(today, 16, 45),
        timezone: 'Asia/Tehran',
        partySize: 1,
        status: 'PENDING',
        source: 'dashboard',
      },
      {
        workspaceId: workspace.id,
        serviceId: service.id,
        contactId: contacts[1].id,
        customerName: 'امیر رضایی',
        customerPhone: '+989122222222',
        startsAt: atHour(tomorrow, 11, 0),
        endsAt: atHour(tomorrow, 11, 45),
        timezone: 'Asia/Tehran',
        partySize: 1,
        status: 'CONFIRMED',
        source: 'agent',
      },
    ],
  })

  // 8. Create a few usage logs so the dashboard charts have data
  const usageLogs: Array<{ type: 'CHAT'; status: 'CAPTURED'; date: Date; cost: number; promptTokens: number; completionTokens: number; model: string }> = []
  for (let i = 13; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    const count = Math.floor(Math.random() * 8) + 2
    for (let j = 0; j < count; j++) {
      const ts = new Date(day)
      ts.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60))
      usageLogs.push({
        type: 'CHAT',
        status: 'CAPTURED',
        date: ts,
        cost: 0.002 + Math.random() * 0.008,
        promptTokens: Math.floor(Math.random() * 500) + 100,
        completionTokens: Math.floor(Math.random() * 300) + 50,
        model: 'fast',
      })
    }
  }
  await prisma.usageLog.createMany({
    data: usageLogs.map((u) => ({ workspaceId: workspace.id, agentId: agent.id, ...u })),
  })

  console.log('✅ Demo seed complete!')
  console.log(`   Workspace: ${workspace.name} (${workspace.id})`)
  console.log(`   User: ${user.name} (${user.phone})`)
  console.log(`   Agent: ${agent.name}`)
  console.log(`   Products: ${products.length}`)
  console.log(`   Contacts: ${contacts.length}`)
  console.log(`   Conversations: 3`)
  console.log(`   Appointments: 3`)
  console.log(`   Usage logs: ${usageLogs.length}`)
  console.log('')
  console.log('   Login: phone 09120000000, code 123456')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
