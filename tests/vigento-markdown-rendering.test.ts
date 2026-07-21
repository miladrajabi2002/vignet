import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')

describe('Vigento assistant Markdown rendering', () => {
  it.each([
    'components/dashboard/vigento-workspace.tsx',
    'components/admin/vigento-admin-console.tsx',
  ])('renders assistant replies as Markdown while keeping user messages plain in %s', (file) => {
    const component = source(file)

    expect(component).toContain("import { ConversationText } from '@/components/chat/conversation-bubble'")
    expect(component).toContain("markdown={message.role === 'assistant'}")
  })
})
