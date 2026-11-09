package com.smartbusiness.os.auth;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Every /api request needs a valid admin token, except login and the health check. */
@Component
public class AuthInterceptor implements HandlerInterceptor {
  public static final String EMAIL_ATTRIBUTE = "adminEmail";
  public static final String TOKEN_ATTRIBUTE = "adminToken";
  private static final String BEARER = "Bearer ";

  private final JwtService jwt;
  private final SiteUserRepository users;
  private final TokenRevocationService revocations;
  private final long adminCheckMs;
  /** email -> time until which "still an admin" is trusted without asking the database again. */
  private final Map<String, Long> confirmedAdmins = new ConcurrentHashMap<>();

  public AuthInterceptor(JwtService jwt, SiteUserRepository users, TokenRevocationService revocations,
      @Value("${app.auth.admin-check-seconds:60}") long adminCheckSeconds) {
    this.jwt = jwt;
    this.users = users;
    this.revocations = revocations;
    this.adminCheckMs = adminCheckSeconds * 1000;
  }

  /**
   * Is this email still an admin on the website? The answer is remembered for a minute: asking the
   * database on every request added a full round trip to each screen. Removing the role therefore
   * signs the person out within a minute.
   */
  private boolean stillAdmin(String email) {
    long now = System.currentTimeMillis();
    Long until = confirmedAdmins.get(email);
    if (until != null && until > now) return true;
    boolean admin = users.existsByEmailAndRole(email, SiteUser.Role.ADMIN);
    if (admin && adminCheckMs > 0) confirmedAdmins.put(email, now + adminCheckMs);
    else confirmedAdmins.remove(email);
    return admin;
  }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
    if (HttpMethod.OPTIONS.matches(request.getMethod()) || request.getRequestURI().equals("/api/auth/login") || request.getRequestURI().equals("/api/health")) {
      return true;
    }
    String header = request.getHeader("Authorization");
    Optional<JwtService.Verified> token = header != null && header.startsWith(BEARER) ? jwt.verify(header.substring(BEARER.length()).trim()) : Optional.empty();
    // A valid token is not enough: it must not have been ended (sign out), and the user must still be
    // an admin on the website (removing the role signs them out).
    token = token.filter(t -> !revocations.isRevoked(t.id())).filter(t -> stillAdmin(t.email()));
    if (token.isEmpty()) {
      response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      response.setCharacterEncoding(StandardCharsets.UTF_8.name());
      response.getWriter().write("{\"message\":\"Please sign in\"}");
      return false;
    }
    request.setAttribute(EMAIL_ATTRIBUTE, token.get().email());
    request.setAttribute(TOKEN_ATTRIBUTE, token.get());
    return true;
  }
}
