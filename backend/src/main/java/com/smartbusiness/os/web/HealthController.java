package com.smartbusiness.os.web;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public "are you awake?" check for Render's health check and for the apps to wake a sleeping server. */
@RestController
public class HealthController {
  @GetMapping("/api/health")
  public Map<String, String> health() {
    return Map.of("status", "ok");
  }
}
