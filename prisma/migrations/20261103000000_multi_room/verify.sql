-- Not run by Prisma. Run the same block BEFORE and AFTER `migrate deploy`; every value must match (B1/B2/B3/B4).
SELECT
    (SELECT COUNT(*) FROM `bookings`) AS bookings_total,
    (SELECT COUNT(*) FROM `attendances`) AS attendances_total,
    (SELECT COUNT(`attendance_token`) FROM `bookings`) AS tokens_total,
    (SELECT BIT_XOR(CRC32(CONCAT(`id`, ':', `attendance_token`))) FROM `bookings` WHERE `attendance_token` IS NOT NULL) AS tokens_checksum,
    (SELECT BIT_XOR(CRC32(CONCAT(`id`, ':', `division`))) FROM `bookings`) AS booking_division_checksum,
    (SELECT BIT_XOR(CRC32(CONCAT(`id`, ':', `division`))) FROM `attendances`) AS attendance_division_checksum;

-- AFTER only: expect 1 row, is_active = 1.
SELECT `id`, `name`, `is_active` FROM `rooms` WHERE `id` = '00000000-0000-4000-8000-000000000001';

-- AFTER only: expect 0 (every legacy booking points at the default room).
SELECT COUNT(*) AS bookings_outside_default
FROM `bookings`
WHERE `room_id` IS NULL OR `room_id` <> '00000000-0000-4000-8000-000000000001';

-- AFTER only: expect 0 (every attendance reaches a room through its booking).
SELECT COUNT(*) AS attendances_without_room
FROM `attendances` a
LEFT JOIN `bookings` b ON b.`id` = a.`booking_id`
LEFT JOIN `rooms` r ON r.`id` = b.`room_id`
WHERE r.`id` IS NULL;

-- AFTER only: expect 0 (legacy attendances keep gender NULL).
SELECT COUNT(`gender`) AS attendances_with_gender FROM `attendances`;

-- AFTER only: expect 9 rows: login_rate_max=10, login_ip_rate_max=50, login_rate_window_min=15, office_ip_check=false,
-- office_allowed_ips='', trusted_ip_header=x-real-ip, public_attendance_max_per_booking=200, app_name=Booking Rapat, primary_color=navy.
SELECT `key`, `value` FROM `app_settings` ORDER BY `key`;

-- AFTER only: expect 0.
SELECT COUNT(*) AS sessions_total FROM `sessions`;
