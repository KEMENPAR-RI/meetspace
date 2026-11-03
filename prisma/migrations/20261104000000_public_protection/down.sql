-- Manual rollback: npx prisma db execute --file prisma/migrations/20261104000000_public_protection/down.sql
DROP TABLE IF EXISTS `attendance_device_locks`;

-- Let `prisma migrate deploy` re-apply this migration later
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261104000000_public_protection';
