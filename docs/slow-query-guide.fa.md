# شناسایی کوئری‌های کند (Slow-Query Discovery)

این سند راهنمای کاربردی برای شناسایی و بهینه‌سازی کوئری‌های کند دیتابیس Vigent
است. پس از فعال‌سازی `pg_stat_statements` در سپتامبر ۲۰۲۶، تمام کوئری‌های
اجرا‌شده روی PostgreSQL به‌صورت ناشناس (با جایگزینی literalها با `$1`, `$2` …)
ضبط می‌شوند.

## وضعیت فعلی سیستم

- PostgreSQL 16.14
- `pg_stat_statements` 1.10 فعال
- `shared_preload_libraries = pg_stat_statements`
- `pg_stat_statements.track = top` (کوئری‌های تودرتو داخل functionها جدا شمرده نمی‌شوند)
- `pg_stat_statements.max = 10000` (حداکثر ۱۰٬۰۰۰ شکل کوئری منحصر)
- `pg_stat_statements.track_utility = on` (DDL مثل CREATE INDEX هم ضبط می‌شود)
- `pg_stat_statements.save = on` (آمار با restart از بین نمی‌رود)
- `track_io_timing = on` (زمان I/O دیسک جداگانه هم اندازه‌گیری می‌شود)
- کانفیگ نصب‌شده در: `/etc/postgresql/16/main/conf.d/00-pg_stat_statements.conf`

## چطور از آن استفاده کنیم

### ۱. گرفتن گزارش slow-query

اسکریپت آماده‌ای که روی سرور هست:

```bash
# گزارش پیش‌فرض: top 20 با حداقل 5 فراخوانی
bash /var/www/vigent.ir/public/vignet/scripts/pg-slow-queries.sh

# گزارش متفاوت: top 50 با حداقل 2 فراخوانی
bash /var/www/vigent.ir/public/vignet/scripts/pg-slow-queries.sh 50 2

# متن کامل و اعداد یک کوئری (queryid از ستون اول گزارش)
bash /var/www/vigent.ir/public/vignet/scripts/pg-slow-queries.sh --query 5831092145799257361
```

اسکریپت آدرس اتصال را از `.env` می‌خواند (اول `DIRECT_URL`، بعد
`DATABASE_URL`)؛ هیچ رمزی داخل خود اسکریپت نیست.

این اسکریپت ۴ بخش تولید می‌کند:
1. **بیشترین TOTAL exec time** — مجموع زمان مصرفی، همراه با `bufs_per_call`
2. **بیشترین MEAN exec time** — میانگین هر فراخوانی
3. **بیشترین DISK READS** — کوئری‌هایی که داده‌شان در کش نبوده (داده سرد)
4. **بیشترین ROWS RETURNED** — کوئری‌هایی که داده سنگین برمی‌گردانند

و در انتها پنجره آمار (`stats_since` و `stats_window`) را چاپ می‌کند تا معلوم
باشد اعداد مربوط به چه بازه‌ای است.

هر ردیف یک `queryid` دارد. متن کوئری در گزارش کوتاه شده (فهرست ستون‌های
Prisma با `…` جایگزین می‌شود)، پس برای دیدن متن کامل از `--query` استفاده
کنید. کوئری‌های `pg_dump` بک‌آپ شبانه (`COPY … TO stdout` و خواندن کاتالوگ)
و کوئری‌های مانیتورینگ در گزارش نمی‌آیند، چون ترافیک برنامه نیستند.

### ۲. ریست baseline قبل از اندازه‌گیری

قبل از شروع یک پنجره اندازه‌گیری (مثلاً قبل از تست load یا قبل از یک روز
ترافیک)، reset کنید:

```bash
sudo -u postgres psql -d vigent -c "SELECT pg_stat_statements_reset();"
```

سپس بعد از ۲۴ ساعت یا پایان تست، گزارش بگیرید. اعداد فقط مربوط به آن پنجره
خواهد بود.

### ۳. نحوه درخواست از اپراتور (من یا AI)

وقتی می‌خواهید تحلیل slow-query بدهید، به‌سادگی یکی از این پیام‌ها را بفرستید:

- **"گزارش slow-query بده"** — گزارش کامل با پیش‌فرض‌ها (top 20، min 5 calls)
- **"slow query top 50 بده"** — نسخه گسترده‌تر
- **"آیا کوئری جدیدی پیدا شده که نیاز به ایندکس داشته باشد؟"** — تحلیل تخصصی
  با پیشنهاد ایندکس
- **"بعد از ۲۴ ساعت از ریست، گزارش بده"** — اگر خودتان ریست کرده‌اید، بعد از
  مدت مشخص گزارش بگیرید

من اسکریپت را اجرا می‌کنم، خروجی را تحلیل می‌کنم و در صورت نیاز پیشنهاد ایندکس
جدید یا بهینه‌سازی کوئری می‌دهم.

## نشانه‌های کوئری که نیاز به ایندکس دارد

| نشانه | معنی | اقدام |
|------|------|------|
| `bufs_per_call` بالا با `rows` کم (مثلاً صدها page برای چند ردیف) | برای پیدا کردن چند ردیف کل جدول خوانده می‌شود | `EXPLAIN (ANALYZE, BUFFERS)` بگیرید؛ معمولاً ایندکس روی ستون فیلتر |
| `cache_hit_pct < 90%` + `disk_reads` بالا | داده در کش نبوده (داده سرد یا `shared_buffers` کم) | به‌تنهایی نشانه نبودِ ایندکس نیست؛ `bufs_per_call` را هم ببینید |
| `rows_per_call > 1000` | کوئری خیلی زیاد برمی‌گرداند | `LIMIT` یا pagination اضافه کنید |
| `mean_ms > 50` با `calls > 100` | کوئری پرتکرار و کند | `EXPLAIN ANALYZE` بگیرید |
| `Seq Scan` در `EXPLAIN` | اسکن کامل جدول | ایندکس روی ستون فیلتر |

## نکات مهم

- `pg_stat_statements` query shape normalization انجام می‌دهد: `WHERE id = 'abc'`
  و `WHERE id = 'xyz'` به‌عنوان یک کوئری شمرده می‌شوند. این برای aggregate
  آماری بهتر است اما مقادیر واقعی پارامترها را نشان نمی‌دهد؛ برای `EXPLAIN`
  باید خودتان یک نمونه واقعی جای `$1`, `$2` … بگذارید.
- Restart PostgreSQL آمار را reset نمی‌کند؛ آمار روی دیسک ذخیره می‌شود و فقط
  `pg_stat_statements_reset()` آن را پاک می‌کند.
- `total_exec_time` زمان واقعی اجرا است و همیشه I/O دیسک را هم شامل می‌شود.
  `track_io_timing` فقط سهم I/O را جداگانه (در ستون `blk_read_time`) ثبت
  می‌کند. زمان planning حساب نمی‌شود چون `track_planning` خاموش است.
- پنجره طولانی، کد قدیم و جدید را با هم جمع می‌زند. برای سنجیدن اثر یک
  تغییر، قبلش reset کنید؛ ولی کوئری‌های نادر (مثل حذف یک کانال) فقط در
  پنجره‌های طولانی دیده می‌شوند.
- کلید خارجی با `onDelete: Cascade` روی ستونی که ایندکس ندارد یعنی هر حذفِ
  والد یک اسکن کامل جدول فرزند. این در گزارش زیر نام `DELETE` والد دیده
  می‌شود، نه جدول فرزند.

## Rollback (در صورت نیاز)

اگر خواستید `pg_stat_statements` را غیرفعال کنید:

```bash
sudo rm /etc/postgresql/16/main/conf.d/00-pg_stat_statements.conf
sudo systemctl restart postgresql@16-main
sudo -u postgres psql -d vigent -c "DROP EXTENSION IF EXISTS pg_stat_statements;"
```

این کار نیازی به تغییر در کد ندارد چون فقط ابزار مانیتورینگ است.
