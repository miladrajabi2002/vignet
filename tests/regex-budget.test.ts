/**
 * Ratchet on Persian regex literals in production code.
 *
 * Meaning comes from the turn-understanding layer; the legacy regex router is
 * kept only as the fallback for turns without a usable reading. Its regexes
 * may be deleted but never added: every file has a budget (its count when the
 * understanding layer landed) and a file outside the list has a budget of
 * zero. Shape-certain parsers (digits, phone, postal code, evidence checks)
 * belong in lib/agent/parsers/.
 *
 * When you remove regexes, lower the file's number in
 * tests/fixtures/regex-budget.json (the test tells you which).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import budget from './fixtures/regex-budget.json'

const PERSIAN = /[؀-ۿ]/
const ROOTS = ['lib', 'app', 'worker', 'components']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [full] : []
  })
}

/** Regex literals and `new RegExp('…')` calls whose pattern has Persian letters. */
function persianRegexCount(file: string): number {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  let count = 0
  const visit = (node: ts.Node) => {
    if (ts.isRegularExpressionLiteral(node) && PERSIAN.test(node.text)) count++
    else if (
      ts.isNewExpression(node)
      && node.expression.getText(source) === 'RegExp'
      && node.arguments?.[0]
      && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
      && PERSIAN.test(node.arguments[0].text)
    ) count++
    ts.forEachChild(node, visit)
  }
  visit(source)
  return count
}

const budgets = budget.files as Record<string, number>

describe('Persian regex budget', () => {
  const counts = new Map(ROOTS.flatMap((root) => sourceFiles(root)).map((file) => [file.split(path.sep).join('/'), persianRegexCount(file)]))

  it('no file grows its regex count and no new file adds Persian regexes', () => {
    const over = [...counts]
      .filter(([file, count]) => count > (budgets[file] ?? 0))
      .map(([file, count]) => `${file}: ${count} > budget ${budgets[file] ?? 0}`)
    expect(over, 'Read the meaning from the understanding layer instead of a new regex').toEqual([])
  })

  it('the budget is tight (lower it after deleting regexes)', () => {
    const slack = Object.entries(budgets)
      .filter(([file, allowed]) => (counts.get(file) ?? 0) < allowed)
      .map(([file, allowed]) => `${file}: budget ${allowed}, now ${counts.get(file) ?? 0}`)
    expect(slack, 'Lower these numbers in tests/fixtures/regex-budget.json').toEqual([])
  })

  it('the agent core itself stays regex-free outside the shape parsers', () => {
    const core = [...counts].filter(([file, count]) => file.startsWith('lib/agent/') && !file.startsWith('lib/agent/parsers/') && count > 0)
    expect(core).toEqual([])
  })
})
