package com.smartbusiness.os.auth;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Ended sign-ins (sign out, or a token replaced by a renewed one). They are stored in the database so
 * they survive a restart, and kept in memory so checking a request costs no database query.
 */
@Service
public class TokenRevocationService {
  private final JdbcTemplate jdbc;
  private final Map<String, Instant> revoked = new ConcurrentHashMap<>();
  private volatile boolean loaded;

  public TokenRevocationService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /** True if this token was ended before its expiry. */
  public boolean isRevoked(String tokenId) {
    loadOnce();
    Instant until = revoked.get(tokenId);
    return until != null && until.isAfter(Instant.now());
  }

  /** Ends a sign-in now. Its row is removed once the token would have expired anyway. */
  public void revoke(String tokenId, Instant expiresAt) {
    loadOnce();
    if (tokenId == null || expiresAt == null || !expiresAt.isAfter(Instant.now()) || revoked.putIfAbsent(tokenId, expiresAt) != null) return;
    jdbc.update("insert into os.revoked_tokens (token_id, expires_at) values (?, ?)", tokenId, Timestamp.from(expiresAt));
    // tidy up: forget tokens that have expired on their own
    Instant now = Instant.now();
    revoked.values().removeIf(until -> !until.isAfter(now));
    jdbc.update("delete from os.revoked_tokens where expires_at <= ?", Timestamp.from(now));
  }

  private void loadOnce() {
    if (loaded) return;
    synchronized (this) {
      if (loaded) return;
      jdbc.query("select token_id, expires_at from os.revoked_tokens where expires_at > ?",
          rs -> { revoked.put(rs.getString("token_id"), rs.getTimestamp("expires_at").toInstant()); },
          Timestamp.from(Instant.now()));
      loaded = true;
    }
  }
}
