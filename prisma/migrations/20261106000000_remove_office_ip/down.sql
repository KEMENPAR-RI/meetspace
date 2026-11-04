-- Manual rollback: npx prisma db execute --file prisma/migrations/20261106000000_remove_office_ip/down.sql
-- Re-seed defaults (same fixed ids as multi_room).
INSERT IGNORE INTO `app_settings` (`id`, `key`, `value`) VALUES
    ('00000000-0000-4000-8000-000000000204', 'office_ip_check', 'false'),
    ('00000000-0000-4000-8000-000000000205', 'office_allowed_ips', '');

-- Let `prisma migrate deploy` re-apply this migration later
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261106000000_remove_office_ip';
