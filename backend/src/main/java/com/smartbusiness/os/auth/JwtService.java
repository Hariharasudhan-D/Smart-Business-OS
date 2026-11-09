package com.smartbusiness.os.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Signs and checks the OS sign-in tokens. Each token carries:
 * <ul>
 *   <li>the admin's email (subject) and a unique id (jti), so one sign-in can be ended on its own;
 *   <li>issuer and audience "smart-business-os", so only tokens made for the OS are accepted
 *       (not, for example, a token another service signed with the same secret);
 *   <li>which client it is for ("web" or "app"), so a renewal keeps the right lifetime.
 * </ul>
 */
@Service
public class JwtService {
  public static final String ISSUER = "smart-business-os";
  public static final String AUDIENCE = "smart-business-os";
  public static final String CLIENT_CLAIM = "client";

  /** A checked token: who it belongs to, its id, when it ends, and whether it was made for the phone app. */
  public record Verified(String email, String id, Instant expiresAt, boolean app) {}

  private final SecretKey key;
  private final Duration lifetime;
  private final Duration appLifetime;

  public JwtService(
      @Value("${app.auth.jwt-secret}") String secret,
      @Value("${app.auth.token-days}") long tokenDays,
      @Value("${app.auth.app-token-days}") long appTokenDays) {
    if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
      throw new IllegalStateException("JWT_SECRET must be set to a random string of at least 32 characters (see backend/.env.example).");
    }
    if (tokenDays < 1 || appTokenDays < 1) {
      throw new IllegalStateException("AUTH_TOKEN_DAYS and AUTH_APP_TOKEN_DAYS must be at least 1.");
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.lifetime = Duration.ofDays(tokenDays);
    this.appLifetime = Duration.ofDays(appTokenDays);
  }

  public Instant expiryFromNow() {
    return Instant.now().plus(lifetime);
  }

  /** The phone app's sign-in lasts longer and is renewed while the app is used (see /api/auth/refresh). */
  public Instant appExpiryFromNow() {
    return Instant.now().plus(appLifetime);
  }

  /** A web (OS website) token. */
  public String create(String email, Instant expiresAt) {
    return create(email, expiresAt, false);
  }

  public String create(String email, Instant expiresAt, boolean app) {
    return Jwts.builder()
        .id(UUID.randomUUID().toString())
        .issuer(ISSUER)
        .audience().add(AUDIENCE).and()
        .subject(email)
        .claim("role", "ADMIN")
        .claim(CLIENT_CLAIM, app ? "app" : "web")
        .issuedAt(new Date())
        .expiration(Date.from(expiresAt))
        .signWith(key)
        .compact();
  }

  /** The checked token, or empty if it is forged, malformed, expired, or not made for the OS. */
  public Optional<Verified> verify(String token) {
    try {
      Claims c = Jwts.parser().verifyWith(key).requireIssuer(ISSUER).requireAudience(AUDIENCE).build().parseSignedClaims(token).getPayload();
      if (c.getSubject() == null || c.getId() == null || c.getExpiration() == null) return Optional.empty();
      return Optional.of(new Verified(c.getSubject(), c.getId(), c.getExpiration().toInstant(), "app".equals(c.get(CLIENT_CLAIM, String.class))));
    } catch (JwtException | IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  /** The email inside a valid OS token, or empty. */
  public Optional<String> emailOf(String token) {
    return verify(token).map(Verified::email);
  }
}
