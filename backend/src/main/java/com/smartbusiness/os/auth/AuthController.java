package com.smartbusiness.os.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  /** client = "app" for the phone app, which keeps its sign-in by renewing it (see refresh). */
  public record LoginRequest(@NotBlank @Size(max = 200) String email, @NotBlank @Size(max = 200) String password, @Size(max = 10) String client) {}

  private final AuthService auth;

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/login")
  public AuthService.Session login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
    return auth.login(body.email(), body.password(), request.getRemoteAddr(), "app".equals(body.client()));
  }

  /** Lets the app check that its saved sign-in is still valid. */
  @GetMapping("/me")
  public Map<String, String> me(HttpServletRequest request) {
    return Map.of("email", (String) request.getAttribute(AuthInterceptor.EMAIL_ATTRIBUTE));
  }

  /** Swaps the current token for a fresh one (the old one stops working). */
  @PostMapping("/refresh")
  public AuthService.Session refresh(HttpServletRequest request) {
    return auth.refresh(current(request));
  }

  /** Signs out on the server: the token in use stops working at once, even if a copy of it exists. */
  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(HttpServletRequest request) {
    auth.logout(current(request));
  }

  private static JwtService.Verified current(HttpServletRequest request) {
    return (JwtService.Verified) request.getAttribute(AuthInterceptor.TOKEN_ATTRIBUTE);
  }
}
