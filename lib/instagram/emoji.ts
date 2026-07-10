// A complete emoji can include a presentation selector, skin-tone modifier,
// keycap, regional-indicator pair, or a ZWJ-joined sequence. We deliberately
// require the whole non-whitespace input to consist only of such tokens.
const EMOJI_TOKEN = String.raw`(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?\p{Emoji_Modifier}?)*)(?:\uFE0E|\uFE0F)?`
const ONLY_EMOJI = new RegExp(String.raw`^(?:${EMOJI_TOKEN}\s*)+$`, 'u')

/** True only when the input contains one or more emoji and no real text. */
export function isEmojiOnly(input: string): boolean {
  const value = input.trim()
  return value.length > 0 && ONLY_EMOJI.test(value)
}
