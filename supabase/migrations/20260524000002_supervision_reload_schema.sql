-- Postgrest caches the table schema; tell it to reload after we added the
-- four supervision columns so client UPDATEs don't silently hang.
NOTIFY pgrst, 'reload schema';
