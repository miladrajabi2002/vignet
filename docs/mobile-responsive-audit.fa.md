# ممیزی نهایی Adaptive / Responsive UI ویجنت

تاریخ بازبینی نهایی: ۱۴۰۵/۰۶/۱۰

دامنه این ممیزی شامل هر ۷۳ مسیر `page.tsx`، هر ۲۲ مسیر پنل ادمین، Layoutهای اصلی، ناوبری‌ها، جدول‌ها، فرم‌ها، Dialogها و اکشن‌های ثابت است. بررسی بر پایه ساختار و رفتار کد انجام شده و طبق درخواست، تست تصویری جزو این مرحله نیست.

## نتیجه نهایی

- مورد بازِ «اولویت زیاد» یا «اولویت متوسط» برای نسخه موبایل باقی نمانده است.
- نسخه موبایل در صفحات داده‌محور صرفاً کوچک‌شده دسکتاپ نیست؛ Table، Navigation، Filter، Detail و Action در Breakpoint موبایل ساختار مستقل دارند.
- جدول دسکتاپ فقط از `md` به بالا نمایش داده می‌شود و موبایل در صفحات پرتراکم Card/Inbox/Inspector مستقل دارد.
- ناوبری پایین کاربر و ادمین Safe Area را رعایت می‌کند و اکشن‌ها و Toastهای ثابت بالاتر از آن قرار گرفته‌اند.
- Dialogهای مشترک در موبایل Bottom Sheet دارای Backdrop، Focus Trap، Escape، Focus Restore و قفل اسکرول هستند.

## پنل کاربر

| مسیر / بخش | پیاده‌سازی نهایی موبایل |
|---|---|
| `/contacts` | کارت مشتری، جست‌وجوی زنده، Filter Sheet، چیپ فیلتر، Badge وضعیت، Quick Add، خروجی Excel و جزئیات Bottom Sheet |
| `/contacts/[contactId]` | تب جزئیات، کپی شماره/شناسه، Edit/Delete درجا و بازگشت فوکوس |
| `/conversations` | Inbox کارتی مینیمال بدون نام ایجنت/خلاصه پیام، جست‌وجوی زنده، Filter Sheet و پیش‌نمایش Bottom Sheet پیش از ورود به گفتگو |
| `/conversations/[conversationId]` | تب Sticky «گفتگو / جزئیات»، وضعیت معنایی و نمای دو ستونه مستقل دسکتاپ |
| `/products` | جست‌وجوی Sticky، فیلتر دسته/موجودی/مرتب‌سازی در Bottom Sheet، چیپ‌ها و شمارنده نتیجه |
| `/products/orders` | کارت سفارش، جست‌وجوی Sticky، Filter Sheet، Badge وضعیت و کپی کد رهگیری |
| `/products/[productId]` | کپی SKU، لینک و ID، لینک خارجی با سطح لمس مناسب و ویرایش Sticky بالای Bottom Nav |
| `/products/new` و Edit | فرم تک‌ستونه موبایل، تنوع‌های Adaptive، اکشن حذف ۴۴ پیکسل و ذخیره تمام‌عرض |
| `/products/categories` | ایجاد/ویرایش در Sheet، تأیید حذف، درخت جمع‌شونده، کنترل عمق و Ellipsis |
| `/agents/[agentId]/*` | سه تب اصلی + مقصد فعال + «بیشتر»، ناوبری Sticky و حفظ مسیر فعال |
| `/settings` | تب‌های موبایل «کسب‌وکار / اپراتور / گزارش‌ها» با فرم و ذخیره مستقل هر بخش |
| اتوماسیون Instagram | Stepper «شرط / پاسخ / انتشار»، پیش‌نمایش تمام‌قد در Bottom Sheet و ذخیره بالای Safe Area |
| `/agents/[agentId]/channels` | Accordion مستقل کانال‌ها در موبایل؛ تمام بخش‌ها در دسکتاپ حفظ شده‌اند |
| `/docs` و `/docs/[slug]` | دکمه Sticky عنوان فعال و Bottom Sheet فهرست راهنما؛ Sidebar دسکتاپ حفظ شده است |
| `/appointments` | فیلتر خدمت Sticky، کنترل‌های هفته ۴۴ پیکسل و Dialog رزرو Bottom Sheet |
| `/services` | جست‌وجوی زنده Sticky، کارت خدمت و اکشن‌های ۴۴ پیکسل |
| `/analytics` و Analytics ایجنت | نمودارها و KPIهای Responsive بدون اکشن خروجی اضافی |
| ناوبری عمومی داشبورد | چهار مقصد اصلی + «بیشتر» در Bottom Navigation، Safe Area و جای‌گذاری پلن در راست/اعلان در چپ هدر موبایل |

## پنل ادمین

| مسیر / بخش | پیاده‌سازی نهایی موبایل |
|---|---|
| Layout ادمین | Bottom Navigation ثابت برای داشبورد، کاربران، گفتگوها و پرداخت‌ها؛ منوی کامل در Bottom Sheet |
| `/admin/users` | جست‌وجوی Sticky، Filter Sheet پلن، کارت کاربر/کسب‌وکار و اکشن مستقیم جزئیات |
| `/admin/payments` | جست‌وجوی زنده، Filter Sheet وضعیت/درگاه، کارت پرداخت، Badge وضعیت و لینک‌های جزئیات/کاربر |
| `/admin/conversations` | Inbox کارتی، جست‌وجوی زنده، فیلتر وضعیت/کانال و اکشن مشاهده گفتگو |
| `/admin/mail` | Master/Detail واقعی، دکمه بازگشت و Composer ثابت بالای ناوبری موبایل |
| `/admin/blog` | جست‌وجو و فیلتر Sticky، کارت نوشته، Edit/Delete و Editor تمام‌صفحه موبایل |
| `/admin/system` | کارت صف/پردازشگر در موبایل، فیلتر خطا در Sheet و جزئیات لاگ جمع‌شونده |
| `/admin/database` | انتخاب مدل در Bottom Sheet، کارت رکورد و Row Inspector تمام‌قد؛ جدول خام فقط دسکتاپ |
| `/admin/revenue` | کارت کسب‌وکار و پلن به‌جای جدول در موبایل |
| `/admin/agents` | کارت Responsive و جست‌وجوی زنده Sticky نام ایجنت/کسب‌وکار |
| AI، Usage، Settings و جزئیات‌ها | Gridهای Breakpoint-based، کارت‌های موبایل و فرم‌های تک‌ستونه؛ جدول‌های AI از قبل Card fallback دارند |

## پوشش قابلیت‌های فهرست اولیه

| قابلیت | محل استفاده |
|---|---|
| Responsive و Breakpoint-Based Layout | تمام Layoutهای کاربر و ادمین |
| Responsive Data Table / Customer Card View | مشتریان، سفارش‌ها و همه جدول‌های اصلی ادمین |
| Off-Canvas / Mobile Drawer | منوی «بیشتر» کاربر و ادمین، فهرست Docs |
| Bottom Navigation Bar | داشبورد کاربر و پنل ادمین |
| Sticky Navigation | جست‌وجو/فیلتر صفحات لیستی، تب گفتگو و فرم Instagram |
| Tabbed Navigation / Detail Tabs | گفتگو، مشتری، Settings و Agent |
| Live Search | مشتری، گفتگو، محصول، سفارش، خدمت و لیست‌های اصلی ادمین |
| Dropdown / Responsive Filters | مشتری، گفتگو، محصول، سفارش و صفحات داده‌محور ادمین |
| Export to Excel | فقط مشتریان، مطابق نیاز محصول |
| Quick Add Action | مشتری، محصول، خدمت و رزرو |
| Status Indicator | مشتری، گفتگو، سفارش، محصول و رکوردهای ادمین |
| Bottom Sheet / Backdrop Overlay | جزئیات، فیلتر، ایجاد/ویرایش، Preview و ناوبری‌های بیشتر |
| Copy to Clipboard | مشتری، کد رهگیری، SKU، لینک و شناسه محصول |
| Inline Actions | جزئیات مشتری، محصول، دسته‌بندی، خدمت، بلاگ و کارت‌های ادمین |
| Adaptive Content Density | فاصله بیشتر و سطوح لمس حداقل ۴۴ پیکسل در موبایل؛ تراکم بیشتر دسکتاپ |

## بازبینی صفحات بدون نیاز به تغییر ساختاری بیشتر

- `/overview`، `/billing`، `/vigento`، `/integrations`، `/menu` و فهرست `/agents` از قبل Grid/Card تطبیقی داشتند.
- Knowledge، Learning، Catalog و Store Access در موبایل تک‌ستونه‌اند و اکنون از ناوبری داخلی جدید Agent استفاده می‌کنند.
- Login، Onboarding، چت عمومی `/c/[slug]` و منوی عمومی `/menu/[slug]` از `100dvh` و/یا Safe Area استفاده می‌کنند.
- صفحات عمومی Home، Pricing، Solutions، Blog، Status و Legal ناوبری و Grid موبایل مستقل دارند.
- مسیرهای `/admin/workspaces` Redirect هستند و UI مستقلی برای بازطراحی ندارند.

## موارد توسعه‌ای آینده، نه نقص Responsive

این موارد در بازبینی نهایی مانع نسخه موبایل نیستند و فقط در صورت رشد داده یا نیاز محصول معنا پیدا می‌کنند:

- Virtualization برای فهرست‌های چند هزار رکوردی.
- انتخاب بازه زمانی سفارشی و Drill-down چندسطحی برای گزارش‌های تحلیلی.
- جست‌وجوی سمت سرور برای بلاگ در صورت عبور تعداد نوشته‌ها از سقف فعلی ۲۰۰ رکورد.

## تأیید فنی تحویل

- تست تصویری: طبق درخواست اجرا نمی‌شود.
- تست یکپارچه نهایی: ۹۸ فایل و ۵۰۶ تست، همگی موفق.
- Production Build و TypeScript: موفق؛ هر ۸۷ صفحه استاتیک Build و همه مسیرهای Dynamic بدون خطای کامپایل ثبت شدند.
- Graphify: دستور به‌روزرسانی اجرا شد اما CLI روی سرور در دسترس نبود (`graphify: command not found`).
