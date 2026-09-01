'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'

/**
 * Live AJAX search input for the admin users page.
 *
 * Updates the URL on a 280ms debounce so the admin can search by name,
 * phone or business without pressing Enter. Soft navigation via App Router
 * makes this feel instant without a full page reload.
 *
 * The plan filter is preserved across searches by reading the current
 * `plan` query param via useSearchParams().
 */
import { useSearchParams } from 'next/navigation'

export function AdminUsersSearchForm({
  defaultQuery,
  placeholder,
  ariaLabel,
  basePath = '/admin/users',
}: {
  defaultQuery: string
  placeholder: string
  ariaLabel: string
  basePath?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(defaultQuery)
  const [isSearching, startSearchTransition] = useTransition()

  // Keep local state in sync when the URL changes externally.
  useEffect(() => {
    setSearchInput(defaultQuery)
  }, [defaultQuery])

  // Debounced live search: 280ms after the last keystroke.
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === defaultQuery.trim()) return
    const timer = window.setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString())
      if (trimmed) sp.set('q', trimmed)
      else sp.delete('q')
      sp.delete('page')
      const url = sp.toString()
      startSearchTransition(() => {
        router.replace(url ? `${basePath}?${url}` : basePath, {
          scroll: false,
        })
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchInput, defaultQuery, searchParams, router, basePath])

  return (
    <form
      method="GET"
      className="relative min-w-0 flex-1"
      autoComplete="off"
      onSubmit={(e) => e.preventDefault()}
    >
      {isSearching ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400 motion-reduce:animate-none" />
      ) : (
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      )}
      <input
        type="search"
        name="q"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="admin-input border-0 bg-black/[0.025] pr-10 shadow-none"
      />
    </form>
  )
}
