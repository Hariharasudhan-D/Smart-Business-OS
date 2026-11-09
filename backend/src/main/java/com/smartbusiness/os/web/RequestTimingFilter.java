package com.smartbusiness.os.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.smartbusiness.os.db.QueryStats;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Logs how long each API request took, e.g. "GET /api/report 180 ms (200)", so slow screens can be
 * traced to the request that is slow. Only requests at or above app.log.slow-request-ms are logged.
 */
@Component
public class RequestTimingFilter extends OncePerRequestFilter {
  private static final Logger log = LoggerFactory.getLogger(RequestTimingFilter.class);
  private final long thresholdMs;

  public RequestTimingFilter(@Value("${app.log.slow-request-ms:0}") long thresholdMs) {
    this.thresholdMs = thresholdMs;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/api/") || "OPTIONS".equals(request.getMethod());
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    long start = System.nanoTime();
    QueryStats.begin();
    try {
      chain.doFilter(request, response);
    } finally {
      long ms = (System.nanoTime() - start) / 1_000_000;
      long[] db = QueryStats.end();
      if (ms >= thresholdMs) {
        // Search text can be a customer's name: keep it out of the logs.
        String query = request.getQueryString() == null ? null : request.getQueryString().replaceAll("(^|&)q=[^&]*", "$1q=***");
        log.info("{} {}{} {} ms ({}) · {} queries, {} ms in database",
            request.getMethod(), request.getRequestURI(), query == null ? "" : "?" + query, ms, response.getStatus(), db[0], db[1]);
      }
    }
  }
}
