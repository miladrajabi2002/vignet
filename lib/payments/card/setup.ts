/**
 * The gateway's four setup steps, in order. Pure: the shell's status pill,
 * the tabs' ticks and the setup wizard all read the same answer.
 */
import type { GatewayOverview } from '@/lib/payments/card/dashboard'

export type GatewaySetupStep = 'card' | 'phone' | 'test' | 'switch'

export const GATEWAY_SETUP_STEPS: GatewaySetupStep[] = ['card', 'phone', 'test', 'switch']

export interface GatewaySetupState {
  done: Record<GatewaySetupStep, boolean>
  /** The first step not done yet; null once all four are. */
  current: GatewaySetupStep | null
  doneCount: number
  complete: boolean
}

export function gatewaySetupState(overview: Pick<GatewayOverview, 'cards' | 'devices' | 'enabled' | 'platformEnabled'>): GatewaySetupState {
  const done: Record<GatewaySetupStep, boolean> = {
    card: overview.cards.some((card) => card.active),
    // Registered is enough here: the test transfer is what proves the phone works.
    phone: overview.devices.some((device) => device.active),
    test: overview.devices.some((device) => device.verifiedAt),
    switch: overview.enabled && overview.platformEnabled,
  }
  const current = GATEWAY_SETUP_STEPS.find((step) => !done[step]) ?? null
  const doneCount = GATEWAY_SETUP_STEPS.filter((step) => done[step]).length
  return { done, current, doneCount, complete: current === null }
}
