import { prisma } from '@/lib/prisma'

/**
 * Global, configurable fixed replies shared by the inbound channel pipeline.
 *
 * Precedence for every text: workspace `businessProfile` override →
 * environment variable → Persian default below. This keeps the texts
 * operational-configurable without a schema migration, while per-business
 * overrides remain possible for tenants that want their own tone.
 *
 * All defaults are deliberately short, colloquial Persian with no trailing
 * period (the outbound post-processor strips those anyway).
 */

export const DEFAULT_QUOTA_EXHAUSTED_MESSAGE =
        'ظرفیت پاسخگویی رایگان این مجموعه فعلاً تکمیل شده است. لطفاً از راه‌های دیگر تماس بگیرید'

export const DEFAULT_MEDIA_UNSUPPORTED_MESSAGE =
        'عکس یا فایل شما دریافت شد. چون ایجنت نمی‌تواند محتوایش را با اطمینان بررسی کند، گفتگو را همراه با همین پیام برای اپراتور فرستادم تا پیگیری کند'

export const DEFAULT_WAITING_FOR_OPERATOR_MESSAGE =
        'لطفاً کمی صبر کنید، همکار ما به‌زودی پاسخ می‌دهد'

/** Minimal interval between repeats of the operator waiting message. */
export const WAITING_MESSAGE_MIN_INTERVAL_MS = 60_000

type FixedReplyKey =
        | 'quotaExhaustedMessage'
        | 'mediaUnsupportedMessage'
        | 'waitingForOperatorMessage'

const ENV_OVERRIDES: Record<FixedReplyKey, string | undefined> = {
        quotaExhaustedMessage: process.env.VIGENT_QUOTA_EXHAUSTED_MESSAGE,
        mediaUnsupportedMessage: process.env.VIGENT_MEDIA_UNSUPPORTED_MESSAGE,
        waitingForOperatorMessage: process.env.VIGENT_WAITING_FOR_OPERATOR_MESSAGE,
}

const DEFAULTS: Record<FixedReplyKey, string> = {
        quotaExhaustedMessage: DEFAULT_QUOTA_EXHAUSTED_MESSAGE,
        mediaUnsupportedMessage: DEFAULT_MEDIA_UNSUPPORTED_MESSAGE,
        waitingForOperatorMessage: DEFAULT_WAITING_FOR_OPERATOR_MESSAGE,
}

/** Read a possibly-JSON `businessProfile` field safely. */
function profileText(value: unknown): string | null {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
}

/**
 * Resolve a fixed reply for one workspace. Reads the workspace's
 * `businessProfile` override once; callers that already hold the profile
 * object can use {@link fixedReplyFromProfile} to avoid the extra query.
 */
export async function fixedReplyForWorkspace(
        key: FixedReplyKey,
        workspaceId: string,
): Promise<string> {
        try {
                const workspace = await prisma.workspace.findUnique({
                        where: { id: workspaceId },
                        select: { businessProfile: true },
                })
                return fixedReplyFromProfile(key, workspace?.businessProfile)
        } catch {
                return DEFAULTS[key]
        }
}

/** Pure resolver: profile override → env → default. No DB access. */
export function fixedReplyFromProfile(
        key: FixedReplyKey,
        businessProfile: unknown,
): string {
        if (businessProfile && typeof businessProfile === 'object' && !Array.isArray(businessProfile)) {
                const override = profileText((businessProfile as Record<string, unknown>)[key])
                if (override) return override
        }
        return ENV_OVERRIDES[key]?.trim() || DEFAULTS[key]
}

export { type FixedReplyKey }
