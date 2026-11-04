-- Manual rollback: npx prisma db execute --file prisma/migrations/20261105000000_remove_attendance/down.sql
-- Restores empty structure only; attendance data comes back only from a backup.
ALTER TABLE `bookings` ADD COLUMN `attendance_token` CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL;
CREATE UNIQUE INDEX `bookings_attendance_token_key` ON `bookings`(`attendance_token`);

CREATE TABLE `attendances` (
    `id` CHAR(36) NOT NULL,
    `booking_id` CHAR(36) NOT NULL,
    `attendee_name` VARCHAR(100) NOT NULL,
    `name_key` VARCHAR(150) COLLATE utf8mb4_bin NOT NULL,
    `division` VARCHAR(100) NOT NULL,
    `attendee_role` VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `phone` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    `signature` VARCHAR(100) NOT NULL,
    `signed_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `gender` ENUM('L', 'P') NULL,

    UNIQUE INDEX `attendances_booking_id_name_key_key`(`booking_id`, `name_key`),
    UNIQUE INDEX `attendances_booking_id_phone_key`(`booking_id`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `attendances` ADD CONSTRAINT `attendances_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `attendance_device_locks` (
    `device_key` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `last_submit_at` DATETIME(3) NOT NULL,

    INDEX `attendance_device_locks_last_submit_at_idx`(`last_submit_at`),
    PRIMARY KEY (`device_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Re-seed defaults (same fixed id as multi_room); attendance_device_cooldown_min was never seeded, app falls back to its default.
INSERT IGNORE INTO `app_settings` (`id`, `key`, `value`) VALUES
    ('00000000-0000-4000-8000-000000000207', 'public_attendance_max_per_booking', '200');

-- Let `prisma migrate deploy` re-apply this migration later
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261105000000_remove_attendance';
