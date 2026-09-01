'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface CategoryNode {
  id: string
  name: string
  parentId: string | null
  products: number
}

export function CategoryTree({ categories }: { categories: CategoryNode[] }) {
  const t = useTranslations('products.categories')
  const router = useRouter()
  const createTriggerRef = useRef<HTMLButtonElement>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryNode | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CategoryNode | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const byParent = useMemo(() => {
    const map = new Map<string | null, CategoryNode[]>()
    for (const category of categories) {
      const siblings = map.get(category.parentId) ?? []
      siblings.push(category)
      map.set(category.parentId, siblings)
    }
    return map
  }, [categories])

  const unavailableParents = useMemo(() => {
    const ids = new Set<string>()
    if (!editing) return ids
    const visit = (id: string) => {
      if (ids.has(id)) return
      ids.add(id)
      for (const child of byParent.get(id) ?? []) visit(child.id)
    }
    visit(editing.id)
    return ids
  }, [byParent, editing])

  function openCreate() {
    setEditing(null)
    setName('')
    setParentId('')
    setError(null)
    setEditorOpen(true)
  }

  function openEdit(category: CategoryNode) {
    setEditing(category)
    setName(category.name)
    setParentId(category.parentId ?? '')
    setError(null)
    setEditorOpen(true)
  }

  async function save() {
    const normalizedName = name.trim()
    if (!normalizedName || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        editing ? `/api/products/categories/${editing.id}` : '/api/products/categories',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: normalizedName, parentId: parentId || null }),
        },
      )
      if (!response.ok) throw new Error('save-failed')
      setEditorOpen(false)
      router.refresh()
    } catch {
      setError(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!deleting || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/products/categories/${deleting.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('delete-failed')
      setDeleting(null)
      router.refresh()
    } catch {
      setError(t('deleteFailed'))
    } finally {
      setBusy(false)
    }
  }

  function toggleBranch(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderRow(category: CategoryNode, depth: number, ancestors: Set<string>) {
    if (ancestors.has(category.id)) return null
    const children = byParent.get(category.id) ?? []
    const isCollapsed = collapsed.has(category.id)
    const nextAncestors = new Set(ancestors).add(category.id)

    return (
      <div key={category.id}>
        <article
          className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5 sm:p-3"
          style={{ marginInlineStart: Math.min(depth, 3) * 10 }}
        >
          {children.length ? (
            <button
              type="button"
              onClick={() => toggleBranch(category.id)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? t('expand') : t('collapse')}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4 rtl:rotate-180" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center text-[var(--text-muted)]">
              <FolderTree className="h-4 w-4" aria-hidden="true" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">{category.name}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('count', { count: category.products })}</p>
          </div>

          <button
            type="button"
            onClick={() => openEdit(category)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            aria-label={t('edit')}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setDeleting(category)
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600"
            aria-label={t('delete')}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </article>

        {!isCollapsed && children.length > 0 && (
          <div className="mt-2 space-y-2">
            {children.map((child) => renderRow(child, depth + 1, nextAncestors))}
          </div>
        )}
      </div>
    )
  }

  const roots = byParent.get(null) ?? []

  return (
    <div className="space-y-4">
      <div className="sticky top-[5.25rem] z-20 -mx-1 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/95 p-3 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <p className="text-sm text-[var(--text-secondary)]">{t('total', { count: categories.length })}</p>
        <button
          ref={createTriggerRef}
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('add')}
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-8 text-center">
          <FolderTree className="mx-auto h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm text-[var(--text-muted)]">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">{roots.map((category) => renderRow(category, 0, new Set()))}</div>
      )}

      <MobileBottomSheet
        open={editorOpen}
        title={editing ? t('editTitle') : t('createTitle')}
        description={t('editorDescription')}
        closeLabel={t('cancel')}
        mobileOnly={false}
        triggerRef={createTriggerRef}
        onClose={() => !busy && setEditorOpen(false)}
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditorOpen(false)} disabled={busy} className="min-h-11 rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50">
              {t('cancel')}
            </button>
            <button type="button" onClick={save} disabled={busy || !name.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              {editing ? t('save') : t('add')}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{t('name')}</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && save()} placeholder={t('namePlaceholder')} className="input min-h-11 w-full" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{t('parent')}</span>
            <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="input min-h-11 w-full">
              <option value="">{t('noParent')}</option>
              {categories.filter((category) => !unavailableParents.has(category.id)).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
      </MobileBottomSheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('deleteTitle')}
        description={deleting ? t('deleteDescription', { name: deleting.name }) : undefined}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busy={busy}
        error={deleting ? error : null}
        onConfirm={remove}
        onClose={() => !busy && setDeleting(null)}
      />
    </div>
  )
}
