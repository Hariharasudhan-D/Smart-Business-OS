package com.smartbusiness.os.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Slows down password guessing. Wrong passwords are counted two ways, each for 15 minutes:
 * <ul>
 *   <li>per address: 5 failures block that address (stops one machine trying many passwords);
 *   <li>per account: 10 failures block that email from every address. The address alone can be
 *       faked behind a proxy (X-Forwarded-For), so this limit is what really protects the admin account.
 * </ul>
 * In memory, so it resets when the server restarts. The table is capped so a flood of fake addresses
 * cannot use up the server's memory.
 */
@Component
public class LoginRateLimiter {
  static final int MAX_FAILURES = 5;
  static final int MAX_FAILURES_PER_ACCOUNT = 10;
  static final Duration WINDOW = Duration.ofMinutes(15);
  static final int MAX_TRACKED = 10_000;

  private record Attempts(int failures, Instant windowStart) {}

  private final Map<String, Attempts> byKey = new ConcurrentHashMap<>();

  /** Minutes the caller must still wait, or 0 if sign-in is allowed. */
  public long minutesBlocked(String address) {
    return minutesBlocked(address, null);
  }

  public long minutesBlocked(String address, String email) {
    return Math.max(blockedFor("ip:" + address, MAX_FAILURES), email == null || email.isEmpty() ? 0 : blockedFor("acct:" + email, MAX_FAILURES_PER_ACCOUNT));
  }

  public void recordFailure(String address) {
    recordFailure(address, null);
  }

  public void recordFailure(String address, String email) {
    if (byKey.size() >= MAX_TRACKED) prune();
    count("ip:" + address);
    if (email != null && !email.isEmpty()) count("acct:" + email);
  }

  public void recordSuccess(String address) {
    recordSuccess(address, null);
  }

  public void recordSuccess(String address, String email) {
    byKey.remove("ip:" + address);
    if (email != null) byKey.remove("acct:" + email);
  }

  private long blockedFor(String key, int max) {
    Attempts a = byKey.get(key);
    if (a == null) return 0;
    Instant until = a.windowStart().plus(WINDOW);
    if (Instant.now().isAfter(until)) {
      byKey.remove(key);
      return 0;
    }
    return a.failures() >= max ? Math.max(1, Duration.between(Instant.now(), until).toMinutes() + 1) : 0;
  }

  private void count(String key) {
    byKey.merge(key, new Attempts(1, Instant.now()), (old, ignored) ->
        Instant.now().isAfter(old.windowStart().plus(WINDOW)) ? new Attempts(1, Instant.now()) : new Attempts(old.failures() + 1, old.windowStart()));
  }

  /** Forget expired entries; if still full, forget address entries (account limits are kept). */
  private void prune() {
    Instant now = Instant.now();
    byKey.values().removeIf(a -> now.isAfter(a.windowStart().plus(WINDOW)));
    if (byKey.size() >= MAX_TRACKED) byKey.keySet().removeIf(k -> k.startsWith("ip:"));
  }
}
