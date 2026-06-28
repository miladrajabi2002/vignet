'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2, Plus, Trash2, Check, HelpCircle, X, MousePointerClick } from 'lucide-react'
import { nodeTypes, PALETTE, type FlowNodeType } from './node-types'

const DEFAULT_NODES: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 80, y: 200 },
    data: { label: 'Start' },
  },
]

export function FlowEditor({
  agentId,
  initialNodes,
  initialEdges,
}: {
  agentId: string
  initialNodes: Node[]
  initialEdges: Edge[]
}) {
  const t = useTranslations('builder')
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.length ? initialNodes : DEFAULT_NODES,
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showGuide, setShowGuide] = useState(true)

  // The canvas is "untouched" when it only holds the implicit start node, so we
  // can show a gentle hint to nudge the user to add their first node.
  const isEmpty = nodes.length <= 1

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges],
  )

  const addNode = useCallback(
    (type: FlowNodeType, label: string) => {
      const id = `${type}-${Date.now()}`
      setNodes((nds) => [
        ...nds,
        {
          id,
          type,
          position: { x: 320, y: 120 + nds.length * 24 },
          data: { label },
        },
      ])
    },
    [setNodes],
  )

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  )

  const updateSelected = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedId) return
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      )
    },
    [selectedId, setNodes],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedId || selectedId === 'start') return
    setNodes((nds) => nds.filter((n) => n.id !== selectedId))
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedId && e.target !== selectedId),
    )
    setSelectedId(null)
  }, [selectedId, setNodes, setEdges])

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowConfig: { nodes, edges } }),
      })
      if (res.ok) {
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {showGuide ? (
        <div className="relative rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <button
            onClick={() => setShowGuide(false)}
            className="absolute end-3 top-3 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            aria-label={t('gotIt')}
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mb-2 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t('guideTitle')}
            </span>
          </div>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">{t('guideIntro')}</p>
          <ol className="space-y-1.5">
            {['guideStep1', 'guideStep2', 'guideStep3', 'guideStep4'].map((k, i) => (
              <li key={k} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--border-hover)] text-[10px] text-[var(--text-primary)]">
                  {i + 1}
                </span>
                {t(k)}
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-lg bg-[var(--bg-base)] px-3 py-2 text-xs leading-relaxed text-[var(--text-muted)]">
            {t('guideNote')}
          </p>
          <button
            onClick={() => setShowGuide(false)}
            className="mt-3 rounded-lg bg-[var(--white)] px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
          >
            {t('gotIt')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {t('showGuide')}
        </button>
      )}

      <div className="flex h-[calc(100vh-260px)] min-h-[460px] gap-3">
        {/* Palette */}
        <div className="flex w-52 shrink-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
          <span className="px-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            {t('addNode')}
          </span>
          {PALETTE.map(({ type, labelKey, descKey, icon: Icon }) => (
            <button
              key={type}
              onClick={() => addNode(type, t(labelKey))}
              title={t(descKey)}
              className="group flex flex-col gap-1 rounded-lg border border-[var(--border-default)] px-2.5 py-2 text-start transition-colors hover:border-[var(--border-hover)]"
            >
              <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {t(labelKey)}
                <Plus className="ms-auto h-3 w-3" />
              </span>
              <span className="text-[10px] leading-snug text-[var(--text-muted)]">
                {t(descKey)}
              </span>
            </button>
          ))}
        </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
          colorMode={isLight ? 'light' : 'dark'}
        >
          <Background color="rgba(var(--ink-rgb),0.08)" gap={20} />
          <Controls className="!border-[var(--border-default)] !bg-[var(--bg-elevated)]" />
        </ReactFlow>

        <button
          onClick={save}
          disabled={saving}
          className="absolute end-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.03] disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5" />
          ) : null}
          {saved ? t('saved') : t('save')}
        </button>

        {isEmpty && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1.5 text-center">
            <MousePointerClick className="h-5 w-5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">{t('emptyCanvas')}</span>
            <span className="text-[11px] text-[var(--text-hint)]">{t('connectHint')}</span>
          </div>
        )}
      </div>

      {/* Inspector */}
      <div className="w-60 shrink-0 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        {selected ? (
          <div className="space-y-3">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {t('nodeSettings')}
            </span>
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--text-secondary)]">
                {t('nodeLabel')}
              </label>
              <input
                value={String(selected.data.label ?? '')}
                onChange={(e) => updateSelected({ label: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--text-secondary)]">
                {t('nodeText')}
              </label>
              <textarea
                rows={4}
                value={String(selected.data.text ?? '')}
                onChange={(e) => updateSelected({ text: e.target.value })}
                className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              />
            </div>
            {selected.id !== 'start' && (
              <button
                onClick={deleteSelected}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('deleteNode')}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">{t('selectHint')}</p>
        )}
        </div>
      </div>
    </div>
  )
}
