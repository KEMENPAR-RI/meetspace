-- CreateTable
CREATE TABLE `rooms` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `building` VARCHAR(100) NULL,
    `floor` VARCHAR(20) NULL,
    `capacity` SMALLINT UNSIGNED NULL,
    `facilities` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `rooms_name_key`(`name`),
    INDEX `rooms_is_active_name_idx`(`is_active`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Hand-written: enforced on MySQL >= 8.0.16 / MariaDB >= 10.2.1
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_capacity_range` CHECK (`capacity` IS NULL OR `capacity` BETWEEN 1 AND 1000);

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `username` VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `role` ENUM('SUPERADMIN', 'ADMIN') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_role_is_active_idx`(`role`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_admins` (
    `room_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `room_admins_user_id_key`(`user_id`),
    PRIMARY KEY (`room_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `room_admins` ADD CONSTRAINT `room_admins_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_admins` ADD CONSTRAINT `room_admins_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `expires_at` DATETIME(6) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `app_settings` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `value` MEDIUMTEXT NOT NULL,

    UNIQUE INDEX `app_settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Hand-written: default settings with fixed ids (deterministic across environments)
INSERT INTO `app_settings` (`id`, `key`, `value`) VALUES
    ('00000000-0000-4000-8000-000000000201', 'login_rate_max', '10'),
    ('00000000-0000-4000-8000-000000000202', 'login_ip_rate_max', '50'),
    ('00000000-0000-4000-8000-000000000203', 'login_rate_window_min', '15'),
    ('00000000-0000-4000-8000-000000000204', 'office_ip_check', 'false'),
    ('00000000-0000-4000-8000-000000000205', 'office_allowed_ips', ''),
    ('00000000-0000-4000-8000-000000000206', 'trusted_ip_header', 'x-real-ip'),
    ('00000000-0000-4000-8000-000000000207', 'public_attendance_max_per_booking', '200'),
    ('00000000-0000-4000-8000-000000000208', 'app_name', 'Booking Rapat'),
    ('00000000-0000-4000-8000-000000000209', 'primary_color', 'navy');

-- Hand-written: default room with a fixed UUID; every legacy booking is moved here
INSERT INTO `rooms` (`id`, `name`, `is_active`, `created_at`, `updated_at`)
VALUES ('00000000-0000-4000-8000-000000000001', 'Ruang Rapat', true, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));

-- Hand-written: add nullable, backfill, then enforce NOT NULL
ALTER TABLE `bookings` ADD COLUMN `room_id` CHAR(36) NULL;

UPDATE `bookings` SET `room_id` = '00000000-0000-4000-8000-000000000001' WHERE `room_id` IS NULL;

ALTER TABLE `bookings` MODIFY `room_id` CHAR(36) NOT NULL;

-- CreateIndex
CREATE INDEX `bookings_room_id_starts_at_idx` ON `bookings`(`room_id`, `starts_at`);

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: nullable for legacy attendances
ALTER TABLE `attendances` ADD COLUMN `gender` ENUM('L', 'P') NULL;
