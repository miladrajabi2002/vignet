-- Usage rows written by the retired learning center are no longer relevant.
DELETE FROM "UsageLog"
WHERE type = 'LEARNING';
