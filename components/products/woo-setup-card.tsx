/**
 * The WooCommerce connection as the Products page reads it. The store itself
 * is managed in the «ووکامرس» tab (components/integrations); this page only
 * shows a one-line status that links there.
 */

interface SyncLogEntry {
    id: string
    direction: string
    entity: string
    outcome: string
    count: number
    message: string | null
    createdAt: string
}

export interface WooIntegrationState {
    id: string
    storeUrl: string
    webhookSecret: string | null
    pollIntervalMinutes: number
    active: boolean
    connectedAt: string | null
    lastWebhookAt: string | null
    lastSyncAt: string | null
    lastSyncStatus: string | null
    lastSyncError: string | null
    hasCredentials: boolean
    _count: { orders: number; syncLogs: number }
    syncLogs: SyncLogEntry[]
}
