/**
 * Why a payment could not be made, in words the owner can act on. Shared by
 * every place the dashboard creates one (new link, a card sent into a chat)
 * so the same refusal reads the same everywhere. `limit` is the boundary that
 * was crossed, whole tomans (the minimum or the gateway's ceiling).
 */
export const MIN_PAY_AMOUNT_TOMAN = 1_000

export function paymentCreateErrorText(code: string | null | undefined, fa: boolean, limit?: number | null): string | null {
  const toman = (value: number) => `${value.toLocaleString(fa ? 'fa-IR' : 'en-US')} ${fa ? 'تومان' : 'Toman'}`
  switch (code) {
    case 'AMOUNT_TOO_LOW':
      return fa
        ? `مبلغ کمتر از حداقل است؛ کارت‌به‌کارت دست‌کم ${toman(limit ?? MIN_PAY_AMOUNT_TOMAN)} است.`
        : `The amount is below the minimum; a card transfer is at least ${toman(limit ?? MIN_PAY_AMOUNT_TOMAN)}.`
    case 'AMOUNT_TOO_HIGH':
      return limit
        ? (fa ? `مبلغ از سقف یک کارت‌به‌کارت (${toman(limit)}) بیشتر است؛ آن را در چند پرداخت بگیرید.` : `The amount is above the card-transfer ceiling (${toman(limit)}); take it in several payments.`)
        : (fa ? 'مبلغ از سقف یک کارت‌به‌کارت بیشتر است؛ آن را در چند پرداخت بگیرید.' : 'The amount is above the card-transfer ceiling; take it in several payments.')
    case 'AMOUNT_INVALID':
      return fa ? 'مبلغ را به تومان و فقط با عدد بنویسید.' : 'Write the amount in Toman, digits only.'
    case 'NO_CARD':
      return fa ? 'کارت فعالی در درگاه نیست؛ اول یک کارت اضافه یا فعال کنید.' : 'There is no active card; add or switch one on first.'
    case 'DISABLED':
      return fa ? 'درگاه خاموش است؛ از «تنظیمات» روشنش کنید.' : 'The gateway is off; switch it on in Settings.'
    case 'CAP_REACHED':
      return fa ? 'سقف پرداخت‌های این ماهِ پلن شما پر شده است.' : 'This month’s payment limit of your plan is reached.'
    case 'NO_SLOT':
      return fa ? 'الان پرداخت‌های باز زیادی با همین مبلغ هست؛ چند دقیقهٔ دیگر تلاش کنید.' : 'Too many open payments with this amount; try again shortly.'
    case 'WINDOW_CLOSED':
      return fa ? 'اینستاگرام فقط تا ۲۴ ساعت بعد از آخرین پیام مشتری اجازهٔ پیام می‌دهد؛ «فقط لینک بساز» را بزنید و لینک را جور دیگری بفرستید.' : 'Instagram allows messages only within 24 hours of the customer’s last one; make a link instead.'
    case 'NOT_FOUND':
      return fa ? 'این گفتگو پیدا نشد.' : 'That conversation was not found.'
    default:
      return null
  }
}
