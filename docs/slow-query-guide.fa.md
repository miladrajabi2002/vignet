# شناسایی کوئری‌های کند (Slow-Query Discovery)

این سند راهنمای کاربردی برای شناسایی و بهینه‌سازی کوئری‌های کند دیتابیس Vigent
است. پس از فعال‌سازی `pg_stat_statements` در سپتامبر ۲۰۲۶، تمام کوئری‌های
اجرا‌شده روی PostgreSQL به‌صورت ناشناس (با جایگزینی literalها با `$1`, `$2` …)
ضبط می‌شوند.

## وضعیت فعلی سیستم

- PostgreSQL 16.14
- `pg_stat_statements` 1.10 فعال
- `shared_preload_libraries = pg_stat_statements`
- `pg_stat_statements.track = top` (اینگنه‌سازی nested statements نادیده گرفته می‌شود)
- `pg_stat_statements.max = 10000` (حداکثر ۱۰٬۰۰۰ شکل کوئری منحصر)
- `pg_stat_statements.track_utility = on` (DDL مثل CREATE INDEX هم ضبط می‌شود)
- `track_io_timing = on` (زمان I/O دیسک قابل اندازه‌گیری است)
- کانفیگ نصب‌شده در: `/etc/postgresql/16/main/conf.d/00-pg_stat_statements.conf`

## چطور از آن استفاده کنیم

### ۱. گرفتن گزارش slow-query

اسکریپت آماده‌ای که روی سرور هست:

```bash
# گزارش پیش‌فرض: top 20 با حداقل 5 فراخوانی
bash /var/www/vigent.ir/public/vignet/scripts/pg-slow-queries.sh

# گزارش متفاوت: top 50 با حداقل 2 فراخوانی
bash /var/www/vigent.ir/public/vignet/scripts/pg-slow-queries.sh 50 2
```

این اسکریپت ۴ بخش تولید می‌کند:
1. **کندترین کوئری‌ها بر اساس TOTAL exec time** — مجموع زمان مصرفی (با cache hit %)
2. **کندترین کوئری‌ها بر اساس MEAN exec time** — میانگین هر فراخوانی
3. **بیشترین DISK READS** — کوئری‌هایی که از کش عبور می‌کنند (کاندید ایندکس)
4. **بیشترین ROWS RETURNED** — کوئری‌هایی که داده سنگین برمی‌گردانند

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
| `cache_hit_pct < 90%` + `disk_reads > 100` | داده روی دیسک خوانده می‌شود | ایندکس ترکیبی اضافه کنید |
| `rows_per_call > 1000` | کوئری خیلی زیاد برمی‌گرداند | `LIMIT` یا pagination اضافه کنید |
| `mean_ms > 50` با `calls > 100` | کوئری پرتکرار و کند | `EXPLAIN ANALYZE` بگیرید |
| `Seq Scan` در `EXPLAIN` | اسکن کامل جدول | ایندکس روی ستون فیلتر |

## نکات مهم

- `pg_stat_statements` query shape normalization انجام می‌دهد: `WHERE id = 'abc'`
  و `WHERE id = 'xyz'` به‌عنوان یک کوئری شمرده می‌شوند. این برای aggregate
  آماری بهتر است اما برای دیدن query واقعی باید `queryid` را با یک نمونه واقعی
  تطبیق دهید.
- Restart PostgreSQL آمار را reset نمی‌کند؛ فقط `pg_stat_statements_reset()`.
- اگر `track_io_timing = on` نباشد، `total_exec_time` فقط شامل CPU+wait است،
  نه I/O. ما این را فعال کرده‌ایم.
- آمار روی Disk ذخیره می‌شود؛ اگر PostgreSQL restart شود، آمار از آخرین
  state ادامه می‌یابد مگر اینکه reset کنید.

## Rollback (در صورت نیاز)

اگر خواستید `pg_stat_statements` را غیرفعال کنید:

```bash
sudo rm /etc/postgresql/16/main/conf.d/00-pg_stat_statements.conf
sudo systemctl restart postgresql@16-main
sudo -u postgres psql -d vigent -c "DROP EXTENSION IF EXISTS pg_stat_statements;"
```

این کار نیازی به تغییر در کد ندارد چون فقط ابزار مانیتورینگ است.
