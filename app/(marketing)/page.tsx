import { Hero } from '@/components/marketing/hero'
import { StatsCounter } from '@/components/marketing/stats-counter'
import { FeaturesSection } from '@/components/marketing/features-section'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { ChannelsSection } from '@/components/marketing/channels-section'
import { PricingSection } from '@/components/marketing/pricing-section'
import { FaqSection } from '@/components/marketing/faq-section'
import { CtaSection } from '@/components/marketing/cta-section'

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsCounter />
      <FeaturesSection />
      <HowItWorks />
      <ChannelsSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
    </>
  )
}
