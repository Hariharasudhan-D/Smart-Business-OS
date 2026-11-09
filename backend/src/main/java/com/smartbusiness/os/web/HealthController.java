package com.smartbusiness.os.web;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public "are you awake?" checks.
 * <ul>
 *   <li>/api/health — the server only, no database. Render's health check uses this, so a short
 *       database hiccup never makes Render restart the server.
 *   <li>/api/health/db — also runs one tiny database query. A scheduled ping (cron-job.org every
 *       10 minutes) on this keeps BOTH the Render server awake and the free Supabase project active
 *       (Supabase pauses free projects after about 7 days without database activity). The query runs
 *       at most once a minute, however often this is called.
 * </ul>
 */
@RestController
public class HealthController {
  private static final long DB_CHECK_EVERY_MS = 60_000;

  private final JdbcTemplate jdbc;
  private volatile long lastDbCheck;
  private volatile boolean lastDbOk;

  public HealthController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/api/health")
  public Map<String, String> health() {
    return Map.of("status", "ok");
  }

  @GetMapping("/api/health/db")
  public ResponseEntity<Map<String, String>> database() {
    long now = System.currentTimeMillis();
    if (now - lastDbCheck >= DB_CHECK_EVERY_MS) {
      synchronized (this) {
        if (now - lastDbCheck >= DB_CHECK_EVERY_MS) {
          try {
            jdbc.queryForObject("select 1", Integer.class);
            lastDbOk = true;
          } catch (RuntimeException e) {
            lastDbOk = false;
          }
          lastDbCheck = System.currentTimeMillis();
        }
      }
    }
    return lastDbOk
        ? ResponseEntity.ok(Map.of("status", "ok", "database", "ok"))
        : ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("status", "ok", "database", "unreachable"));
  }
}
