'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { useUrlSearchInput } from '@/lib/hooks/use-url-search-input'

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
  queryParam = 'q',
  pageParam = 'page',
}: {
  defaultQuery: string
  placeholder: string
  ariaLabel: string
  basePath?: string
  /** For pages that host more than one list and namespace their params. */
  queryParam?: string
  pageParam?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput, markSearchSent] = useUrlSearchInput(defaultQuery)
  const [isSearching, startSearchTransition] = useTransition()

  // Debounced live search: 280ms after the last keystroke.
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === defaultQuery.trim()) return
    const timer = window.setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString())
      if (trimmed) sp.set(queryParam, trimmed)
      else sp.delete(queryParam)
      sp.delete(pageParam)
      const url = sp.toString()
      markSearchSent(trimmed)
      startSearchTransition(() => {
        router.replace(url ? `${basePath}?${url}` : basePath, {
          scroll: false,
        })
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchInput, defaultQuery, searchParams, router, basePath, queryParam, pageParam, markSearchSent])

  return (
    <form
      method="GET"
      className="relative min-w-[10rem] flex-1"
      autoComplete="off"
      onSubmit={(e) => e.preventDefault()}
    >
      {isSearching ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" />
      ) : (
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
      )}
      <input
        type="search"
        name={queryParam}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="admin-input border-0 bg-black/[0.025] pr-10 shadow-none"
      />
    </form>
  )
}
