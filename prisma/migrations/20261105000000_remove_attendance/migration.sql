-- Irreversible data loss: back up attendances first (mysqldump); down.sql only restores empty structure.
-- attendance_rate_limits is kept: still used by public booking rate limiting.

-- DropForeignKey
ALTER TABLE `attendances` DROP FOREIGN KEY `attendances_booking_id_fkey`;

-- DropTable
DROP TABLE `attendances`;

-- DropTable
DROP TABLE `attendance_device_locks`;

-- DropIndex
DROP INDEX `bookings_attendance_token_key` ON `bookings`;

-- AlterTable
ALTER TABLE `bookings` DROP COLUMN `attendance_token`;

-- Hand-written: remove attendance-only settings
DELETE FROM `app_settings` WHERE `key` IN ('public_attendance_max_per_booking', 'attendance_device_cooldown_min');
