import { Hero } from '@/components/marketing/hero'
import { DemoSection } from '@/components/marketing/demo-section'
import { ChannelsSection } from '@/components/marketing/channels-section'
import { FeaturesSection } from '@/components/marketing/features-section'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { Testimonials } from '@/components/marketing/testimonials'
import { PricingSection } from '@/components/marketing/pricing-section'
import { FaqSection } from '@/components/marketing/faq-section'
import { CtaSection } from '@/components/marketing/cta-section'

export default function HomePage() {
  return (
    <>
      <Hero />
      <DemoSection />
      <ChannelsSection />
      <FeaturesSection />
      <HowItWorks />
      <Testimonials />
      <PricingSection />
      <FaqSection />
      <CtaSection />
    </>
  )
}
