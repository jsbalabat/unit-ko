-- Postgres extensions the schema relies on.
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email comparison
