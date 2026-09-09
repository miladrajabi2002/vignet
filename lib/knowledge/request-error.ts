export type KnowledgeRequestErrorMessageKey =
  | 'storageNotConfigured'
  | 'invalidUrl'
  | 'sessionExpired'
  | 'planBlocked'
  | 'rateLimit'
  | 'emptyContent'
  | 'fileTooLarge'
  | 'invalidFileType'
  | 'invalidFileContent'
  | 'uploadQuotaExceeded'
  | 'requestFailed'

/** Convert API failures into user-facing knowledge translation keys. */
export function knowledgeRequestErrorMessageKey(
  status: number,
  code?: string,
): KnowledgeRequestErrorMessageKey {
  switch (code) {
    case 'STORAGE_NOT_CONFIGURED':
      return 'storageNotConfigured'
    case 'INVALID_URL':
      return 'invalidUrl'
    case 'EMPTY':
    case 'EMPTY_FILE':
    case 'NO_FILE':
      return 'emptyContent'
    case 'FILE_TOO_LARGE':
    case 'PAYLOAD_TOO_LARGE':
      return 'fileTooLarge'
    case 'INVALID_FILE_TYPE':
      return 'invalidFileType'
    case 'INVALID_FILE_CONTENT':
      return 'invalidFileContent'
    case 'UPLOAD_QUOTA_EXCEEDED':
    case 'UPLOAD_CAPACITY_EXCEEDED':
      return 'uploadQuotaExceeded'
  }

  if (status === 401 || code === 'UNAUTHORIZED') return 'sessionExpired'
  if (status === 402 || code === 'PLAN_BLOCKED') return 'planBlocked'
  if (status === 429 || code === 'RATE_LIMIT') return 'rateLimit'
  return 'requestFailed'
}
