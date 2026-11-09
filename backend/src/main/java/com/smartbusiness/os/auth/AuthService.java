package com.smartbusiness.os.auth;

import java.time.Instant;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Signs in with the website's own accounts (same email and password). Only users with role ADMIN get in. */
@Service
public class AuthService {
  public record Session(String token, String name, String email, Instant expiresAt) {}

  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
  // Checked when the email is unknown, so a wrong email takes as long as a wrong password.
  private final String decoyHash = encoder.encode("decoy-password-for-timing");
  private final SiteUserRepository users;
  private final JwtService jwt;
  private final LoginRateLimiter limiter;
  private final TokenRevocationService revocations;
  private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AuthService.class);

  public AuthService(SiteUserRepository users, JwtService jwt, LoginRateLimiter limiter, TokenRevocationService revocations) {
    this.users = users;
    this.jwt = jwt;
    this.limiter = limiter;
    this.revocations = revocations;
  }

  public static String normalize(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }

  public Session login(String email, String password, String clientAddress) {
    return login(email, password, clientAddress, false);
  }

  public Session login(String email, String password, String clientAddress, boolean fromApp) {
    String account = normalize(email);
    long wait = limiter.minutesBlocked(clientAddress, account);
    if (wait > 0) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many wrong attempts. Try again in " + wait + " minute" + (wait == 1 ? "" : "s") + ".");
    }
    SiteUser user = users.findByEmail(account).orElse(null);
    boolean passwordOk = encoder.matches(password == null ? "" : password, user == null ? decoyHash : user.getPassword());
    if (user == null || !passwordOk) {
      limiter.recordFailure(clientAddress, account);
      log.warn("Failed OS sign-in from {}", clientAddress);
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Wrong email or password");
    }
    // The password was right, so it is safe to say why this account cannot enter.
    if (user.getRole() != SiteUser.Role.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the shop admin can sign in to the OS.");
    }
    limiter.recordSuccess(clientAddress, account);
    log.info("OS sign-in ({}) from {}", fromApp ? "app" : "web", clientAddress);
    return issue(user, fromApp);
  }

  /**
   * A fresh token for a signed-in admin, replacing the one in use (which is ended). The phone app calls
   * this while it is used, so it stays signed in without long-lived tokens.
   */
  public Session refresh(JwtService.Verified current) {
    SiteUser user = users.findByEmail(current.email()).filter(u -> u.getRole() == SiteUser.Role.ADMIN)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in"));
    Session next = issue(user, current.app());
    revocations.revoke(current.id(), current.expiresAt());
    return next;
  }

  /** Signs out: this token stops working at once, everywhere. */
  public void logout(JwtService.Verified current) {
    revocations.revoke(current.id(), current.expiresAt());
  }

  private Session issue(SiteUser user, boolean app) {
    Instant expires = app ? jwt.appExpiryFromNow() : jwt.expiryFromNow();
    return new Session(jwt.create(user.getEmail(), expires, app), user.getName(), user.getEmail(), expires);
  }
}
