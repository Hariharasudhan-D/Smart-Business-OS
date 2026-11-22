package com.smartbusiness.os.web;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public release metadata used by the phone app before it opens the signed-in UI. */
@RestController
public class AppVersionController {
  public record AppVersion(
      String latestVersion,
      String minimumSupportedVersion,
      String downloadUrl,
      List<String> releaseNotes) {}

  private final AppVersion version;

  public AppVersionController(
      @Value("${app.mobile.latest-version}") String latestVersion,
      @Value("${app.mobile.minimum-supported-version}") String minimumSupportedVersion,
      @Value("${app.mobile.download-url}") String downloadUrl,
      @Value("${app.mobile.release-notes}") List<String> releaseNotes) {
    this.version = new AppVersion(latestVersion, minimumSupportedVersion, downloadUrl, List.copyOf(releaseNotes));
  }

  @GetMapping("/api/app-version")
  public AppVersion version() {
    return version;
  }
}
