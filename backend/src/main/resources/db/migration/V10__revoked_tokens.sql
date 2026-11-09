-- Sign-ins that were ended on purpose (sign out, or replaced by a renewed token). A token whose id is
-- here is refused even though its signature and expiry are still valid. Rows are kept only until the
-- token would have expired anyway.
create table revoked_tokens (
  token_id   varchar(64) primary key,
  expires_at timestamp   not null
);
create index idx_revoked_tokens_expires on revoked_tokens (expires_at);
