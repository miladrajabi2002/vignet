import type { ReactNode } from 'react'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'

export default function MarketingLayout({
  children,
}: {
  children: ReactNode
}) {
  // Marketing site is always pure black, regardless of dashboard theme.
  return (
    <div className="dark bg-black">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
