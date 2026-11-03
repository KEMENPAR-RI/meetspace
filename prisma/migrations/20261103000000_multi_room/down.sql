-- Manual rollback: npx prisma db execute --file prisma/migrations/20261103000000_multi_room/down.sql
-- Loses rooms, accounts, room assignments, sessions, app settings and attendance gender; bookings and attendances stay intact.
ALTER TABLE `bookings` DROP FOREIGN KEY `bookings_room_id_fkey`;
DROP INDEX `bookings_room_id_starts_at_idx` ON `bookings`;
ALTER TABLE `bookings` DROP COLUMN `room_id`;

ALTER TABLE `attendances` DROP COLUMN `gender`;

DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `app_settings`;
DROP TABLE IF EXISTS `room_admins`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `rooms`;

-- Let `prisma migrate deploy` re-apply this migration later
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261103000000_multi_room';
