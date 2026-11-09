package com.smartbusiness.os.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Browser-side protection for every API answer, and a size cap on requests:
 * <ul>
 *   <li>nosniff, no framing, no referrer, and a CSP that allows nothing (the API only returns JSON);
 *   <li>Cache-Control: no-store, so sales, customers and sign-in answers are never kept in a browser
 *       or proxy cache;
 *   <li>HSTS on HTTPS, so browsers only ever talk to the server over HTTPS;
 *   <li>request bodies over 1 MB are refused before they are read (the largest real body, a product
 *       with a phone photo, is well under that).
 * </ul>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeadersFilter extends OncePerRequestFilter {
  static final long MAX_BODY_BYTES = 1_000_000;

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    response.setHeader("Cross-Origin-Resource-Policy", "same-site");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (request.getRequestURI().startsWith("/api/")) {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
    }
    if (request.isSecure()) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    if (request.getContentLengthLong() > MAX_BODY_BYTES) {
      response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      response.setCharacterEncoding(StandardCharsets.UTF_8.name());
      response.getWriter().write("{\"message\":\"The request is too large\"}");
      return;
    }
    chain.doFilter(request, response);
  }
}
