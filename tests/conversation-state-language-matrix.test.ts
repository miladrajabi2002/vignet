import { describe, expect, it } from 'vitest'
import {
  advanceConversationWorkingState,
  conversationStateInstruction,
  createEmptyConversationWorkingState,
  observeAssistantTurn,
} from '@/lib/ai/conversation-state'
import { planProductRequest } from '@/lib/ai/conversation'

type MatrixCase = {
  vertical: string
  request: string
  question: string
  answer: string
  slot: string
  services?: string[]
}

function answerQuestion(testCase: MatrixCase) {
  let state = createEmptyConversationWorkingState('matrix-session')
  const firstPlan = planProductRequest(testCase.request, [])
  state = advanceConversationWorkingState({
    state,
    sessionStartId: 'matrix-session',
    message: testCase.request,
    messageId: 'u-1',
    createdAt: '2026-09-15T10:00:00.000Z',
    productPlan: firstPlan,
    knownServiceNames: testCase.services,
  })
  state = observeAssistantTurn(state, testCase.question, 'a-1', '2026-09-15T10:00:01.000Z')
  const answerPlan = planProductRequest(testCase.answer, [
    { role: 'user', content: testCase.request },
    { role: 'assistant', content: testCase.question },
  ])
  return advanceConversationWorkingState({
    state,
    sessionStartId: 'matrix-session',
    message: testCase.answer,
    messageId: 'u-2',
    createdAt: '2026-09-15T10:00:02.000Z',
    productPlan: answerPlan,
    knownServiceNames: testCase.services,
  })
}

const cases: MatrixCase[] = [
  { vertical: 'furniture / known style', request: 'جلومبلی میخوام', question: 'چه سبکی مدنظرته؟', answer: 'مدرنه', slot: 'style' },
  { vertical: 'furniture / open style', request: 'مبل میخوام', question: 'چه سبکی می‌پسندید؟', answer: 'بوهو', slot: 'style' },
  { vertical: 'home / known color', request: 'پرده میخوام', question: 'چه رنگی باشه؟', answer: 'سبز زیتونی', slot: 'color' },
  { vertical: 'home / open color', request: 'فرش میخوام', question: 'چه رنگی باشه؟', answer: 'زغالی', slot: 'color' },
  { vertical: 'fashion / Persian size', request: 'مانتو میخوام', question: 'چه سایزی می‌پوشید؟', answer: '۴۰', slot: 'size' },
  { vertical: 'fashion / Latin size', request: 'پیراهن میخوام', question: 'What size do you need?', answer: 'XL', slot: 'size' },
  { vertical: 'fashion / open size', request: 'کاپشن میخوام', question: 'چه سایزی می‌خواهید؟', answer: 'ایکس لارج', slot: 'size' },
  { vertical: 'real estate / numeric budget', request: 'آپارتمان میخوام', question: 'بودجه‌تون چقدره؟', answer: '۸ میلیارد', slot: 'budget' },
  { vertical: 'real estate / open budget', request: 'ویلا میخوام', question: 'حدود بودجه‌تون چقدره؟', answer: 'حدود پنجاه', slot: 'budget' },
  { vertical: 'clinic / date', request: 'ویزیت پوست میخوام', question: 'چه روزی مناسب شماست؟', answer: 'پنجشنبه', slot: 'date' },
  { vertical: 'clinic / open date', request: 'ویزیت پوست میخوام', question: 'چه روزی مناسب شماست؟', answer: 'هفته بعد', slot: 'date' },
  { vertical: 'clinic / calendar date', request: 'ویزیت پوست میخوام', question: 'چه تاریخی مناسب شماست؟', answer: '۱۴۰۵/۰۶/۲۰', slot: 'date' },
  { vertical: 'salon / time', request: 'فیشیال میخوام', question: 'چه ساعتی مناسب شماست؟', answer: 'عصر', slot: 'time' },
  { vertical: 'salon / open time', request: 'فیشیال میخوام', question: 'چه ساعتی مناسب شماست؟', answer: 'بعد از کار', slot: 'time' },
  { vertical: 'salon / clock time', request: 'فیشیال میخوام', question: 'چه ساعتی مناسب شماست؟', answer: '۱۸:۳۰', slot: 'time' },
  { vertical: 'installation / known city', request: 'نصب کولر میخوام', question: 'در کدام شهر هستید؟', answer: 'تهران', slot: 'location' },
  { vertical: 'installation / open city', request: 'نصب کولر میخوام', question: 'در کدام شهر هستید؟', answer: 'رشت', slot: 'location' },
  { vertical: 'wholesale / numeric quantity', request: 'ظرف یکبار مصرف میخوام', question: 'چند عدد لازم دارید؟', answer: '۲۰۰', slot: 'quantity' },
  { vertical: 'wholesale / word quantity', request: 'صندلی میخوام', question: 'چند تا لازم دارید؟', answer: 'دو تا', slot: 'quantity' },
  { vertical: 'construction / known material', request: 'میز میخوام', question: 'چه جنسی ترجیح می‌دهید؟', answer: 'چوبی', slot: 'material' },
  { vertical: 'construction / open material', request: 'صفحه کابینت میخوام', question: 'چه متریالی ترجیح می‌دهید؟', answer: 'فایبرگلاس', slot: 'material' },
  { vertical: 'gift shop / use case', request: 'یه ساعت میخوام', question: 'برای چه کاربردی می‌خواهید؟', answer: 'هدیه تولد', slot: 'use_case' },
  { vertical: 'interior / room use case', request: 'جلومبلی میخوام', question: 'برای چه فضایی می‌خواهید؟', answer: 'نشیمن خانه', slot: 'use_case' },
  { vertical: 'food / arbitrary answer', request: 'دسر میخوام', question: 'حساسیت غذایی دارید؟', answer: 'به بادام حساسیت دارم', slot: 'answer' },
  { vertical: 'education / arbitrary level', request: 'دوره پایتون میخوام', question: 'سطحتون چقدره؟', answer: 'مبتدی‌ام', slot: 'answer' },
  { vertical: 'registered local service', request: 'میکروبلیدینگ میخوام', question: 'چه روزی تشریف میارید؟', answer: 'فردا', slot: 'date', services: ['میکروبلیدینگ'] },
  { vertical: 'English retail style', request: 'I need a running shoe', question: 'What style do you prefer?', answer: 'minimal', slot: 'style' },
  { vertical: 'English open location', request: 'I need installation', question: 'What city are you in?', answer: 'Manchester', slot: 'location', services: ['installation'] },
  { vertical: 'English open size', request: 'I want a jacket', question: 'What size do you need?', answer: 'extra large', slot: 'size' },
]

describe('conversation state open-world language and vertical matrix', () => {
  it.each(cases)('links the answer in $vertical', (testCase) => {
    const state = answerQuestion(testCase)
    expect(state.lastTurn?.relation).toBe('ANSWER')
    expect(state.slots[testCase.slot]).toBeDefined()
    expect(state.slots[testCase.slot].sourceMessageId).toBe('u-2')
    expect(state.lastAnswer).toMatchObject({ key: testCase.slot, sourceMessageId: 'u-2' })
  })

  it('keeps the live state prompt compact for a normal multi-step sale', () => {
    let state = answerQuestion(cases[0])
    for (let index = 0; index < 8; index += 1) {
      state = advanceConversationWorkingState({
        state,
        sessionStartId: 'matrix-session',
        message: `قید تکمیلی ${index}`,
        messageId: `u-extra-${index}`,
        createdAt: new Date(Date.UTC(2026, 8, 15, 10, 1, index)),
        productPlan: planProductRequest(`قید تکمیلی ${index}`, []),
      })
    }
    const instruction = conversationStateInstruction(state, 'fa')
    expect(instruction.length).toBeLessThan(3_500)
  })
})
