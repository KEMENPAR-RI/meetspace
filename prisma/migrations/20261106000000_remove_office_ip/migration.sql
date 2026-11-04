-- Hand-written: remove office IP check settings (trusted_ip_header is kept)
DELETE FROM `app_settings` WHERE `key` IN ('office_ip_check', 'office_allowed_ips');
