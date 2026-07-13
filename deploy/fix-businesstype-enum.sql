-- ============================================================================
--  Vignet — Fix missing BusinessType enum values (SOCIAL, SUPPORT)
--
--  این اسکریپت مشکل خطای Prisma زیر را حل می‌کند:
--    "invalid input value for enum \"BusinessType\": \"SOCIAL\""
--
--  علت: migration با نام 20260713210000_add_support_social_business_types
--  شامل دستور ALTER TYPE ... ADD VALUE است که داخل transaction کار نمی‌کند.
--  Prisma migrate deploy همه‌ی migration را داخل یک transaction اجرا می‌کند،
--  پس این migration ممکن است silent fail شده باشد (مخصوصاً روی نسخه‌های
--  قدیمی‌تر PostgreSQL یا وقتی migration قبلاً نصفه اعمال شده).
--
--  راه‌حل: این SQL را مستقیماً روی دیتابیس اجرا کنید:
--    psql "$DATABASE_URL" -f deploy/fix-businesstype-enum.sql
--  یا اگر pgAdmin / DBeaver دارید، آنجا اجرا کنید.
--
--  این اسکریپت idempotent است (با IF NOT EXISTS) — اجرای چندباره مشکلی ندارد.
-- ============================================================================

-- ابتدا بررسی کنید که چه مقادیری در enum موجود هستند:
SELECT unnest(enum_range(NULL::"BusinessType")) AS existing_values;

-- اضافه کردن مقادیر گم‌شده (IF NOT EXISTS از خطای duplicate جلوگیری می‌کند).
-- نکته: ALTER TYPE ... ADD VALUE نمی‌تواند داخل transaction باشد، پس این
-- اسکریپت را خارج از transaction اجرا کنید (psql به‌صورت پیش‌فرض این‌طور است).
ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'SOCIAL';

-- بررسی نهایی:
SELECT unnest(enum_range(NULL::"BusinessType")) AS all_values_after_fix;
