-- CreateTable
CREATE TABLE `attendance_device_locks` (
    `device_key` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `last_submit_at` DATETIME(3) NOT NULL,

    INDEX `attendance_device_locks_last_submit_at_idx`(`last_submit_at`),
    PRIMARY KEY (`device_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
