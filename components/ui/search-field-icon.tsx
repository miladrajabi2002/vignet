import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Leading icon for a search input that quietly turns into a spinner while a search is in flight.
 *
 * The slot is centred with flexbox rather than `-translate-y-1/2`: `animate-spin` owns `transform`,
 * so a translated spinner loses its centring and drops half its height the moment it starts.
 * The spinner also waits a beat before showing, so a fast search never flickers.
 */
export function SearchFieldIcon({ loading, className }: { loading: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-y-0 start-3 flex w-4 items-center justify-center text-[var(--text-muted)]',
        className,
      )}
    >
      <span className="relative h-4 w-4">
        <Search
          className={cn(
            'absolute inset-0 h-4 w-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
            loading ? 'scale-75 opacity-0 delay-150' : 'scale-100 opacity-100',
          )}
        />
        <span
          className={cn(
            'absolute inset-0.5 transition-opacity duration-200 ease-out motion-reduce:transition-none',
            loading ? 'opacity-100 delay-150' : 'opacity-0',
          )}
        >
          <span className="absolute inset-0 rounded-full border-[1.5px] border-current opacity-25" />
          <span
            className={cn(
              'absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-current',
              loading && 'animate-spin [animation-duration:700ms] motion-reduce:animate-none',
            )}
          />
        </span>
      </span>
    </span>
  )
}
