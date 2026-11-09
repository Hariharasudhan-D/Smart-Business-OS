package com.smartbusiness.os;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbusiness.os.auth.JwtService;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JwtService jwt;
  @Autowired JdbcTemplate jdbc;

  private MockHttpServletRequestBuilder login(String email, String password, String address) {
    return post("/api/auth/login")
        .with(r -> {
          r.setRemoteAddr(address);
          return r;
        })
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
  }

  @Test
  void healthCheckIsPublic() throws Exception {
    mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
  }

  @Test
  void apiNeedsAValidToken() throws Exception {
    mvc.perform(get("/api/products")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Please sign in"));
    mvc.perform(get("/api/products").header("Authorization", "Bearer not-a-real-token")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/products").header("Authorization", "Bearer " + jwt.create(TestUsersSeeder.ADMIN_EMAIL, Instant.now().minusSeconds(60))))
        .andExpect(status().isUnauthorized());
    // a correctly signed token for someone who is not an admin on the website is rejected
    mvc.perform(get("/api/products").header("Authorization", "Bearer " + jwt.create("ghost@test.com", jwt.expiryFromNow()))).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/products").header("Authorization", "Bearer " + jwt.create(TestUsersSeeder.CUSTOMER_EMAIL, jwt.expiryFromNow()))).andExpect(status().isUnauthorized());
    // a token signed with some other secret is rejected
    String forged = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkB0ZXN0LmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    mvc.perform(get("/api/products").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
  }

  @Test
  void websiteAdminCanSignInAndStaysSignedInForDays() throws Exception {
    String body = mvc.perform(login("  Admin@Test.com ", TestUsersSeeder.PASSWORD, "10.1.0.1")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    JsonNode session = json.readTree(body);
    assertEquals("Test Admin", session.get("name").asText());
    assertEquals(TestUsersSeeder.ADMIN_EMAIL, session.get("email").asText());
    Instant expires = Instant.parse(session.get("expiresAt").asText());
    assertTrue(Duration.between(Instant.now(), expires).toDays() >= 2, "sign-in must last at least 2 days");

    String header = "Bearer " + session.get("token").asText();
    mvc.perform(get("/api/auth/me").header("Authorization", header)).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(TestUsersSeeder.ADMIN_EMAIL));
    mvc.perform(get("/api/products").header("Authorization", header)).andExpect(status().isOk());
  }

  private JsonNode appLogin(String address) throws Exception {
    String body = mvc.perform(post("/api/auth/login")
            .with(r -> {
              r.setRemoteAddr(address);
              return r;
            })
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + TestUsersSeeder.ADMIN_EMAIL + "\",\"password\":\"" + TestUsersSeeder.PASSWORD + "\",\"client\":\"app\"}"))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    return json.readTree(body);
  }

  @Test
  void appSignInLastsMonthsAndRenewsItselfUntilSignOut() throws Exception {
    JsonNode session = appLogin("10.5.0.1");
    Instant expires = Instant.parse(session.get("expiresAt").asText());
    long days = Duration.between(Instant.now(), expires).toDays();
    assertTrue(days >= 60 && days <= 120, "app sign-in lasts about 90 days, was " + days);

    // renewing gives a new token; the old one stops working at once
    String oldHeader = "Bearer " + session.get("token").asText();
    JsonNode renewed = json.readTree(mvc.perform(post("/api/auth/refresh").header("Authorization", oldHeader))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    String newHeader = "Bearer " + renewed.get("token").asText();
    assertTrue(Instant.parse(renewed.get("expiresAt").asText()).isAfter(Instant.now().plus(Duration.ofDays(60))), "renewed app token keeps the app lifetime");
    mvc.perform(get("/api/auth/me").header("Authorization", oldHeader)).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/auth/me").header("Authorization", newHeader)).andExpect(status().isOk());

    // signing out ends the sign-in on the server: a copy of the token no longer works
    mvc.perform(post("/api/auth/logout").header("Authorization", newHeader)).andExpect(status().isNoContent());
    mvc.perform(get("/api/products").header("Authorization", newHeader)).andExpect(status().isUnauthorized());
  }

  @Test
  void signOutEndsOnlyThatSignIn() throws Exception {
    String a = "Bearer " + appLogin("10.6.0.1").get("token").asText();
    String b = "Bearer " + appLogin("10.6.0.2").get("token").asText();
    mvc.perform(post("/api/auth/logout").header("Authorization", a)).andExpect(status().isNoContent());
    mvc.perform(get("/api/auth/me").header("Authorization", a)).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/auth/me").header("Authorization", b)).andExpect(status().isOk());
  }

  @Test
  void tokensNotMadeForTheOsAreRejected() throws Exception {
    // signed with the right secret, but without the OS issuer/audience (e.g. made by another service)
    javax.crypto.SecretKey key = io.jsonwebtoken.security.Keys.hmacShaKeyFor("test-secret-test-secret-test-secret-1234".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    String foreign = io.jsonwebtoken.Jwts.builder().subject(TestUsersSeeder.ADMIN_EMAIL).claim("role", "ADMIN")
        .id("x").expiration(java.util.Date.from(Instant.now().plusSeconds(3600))).signWith(key).compact();
    mvc.perform(get("/api/products").header("Authorization", "Bearer " + foreign)).andExpect(status().isUnauthorized());
  }

  @Test
  void guessingOneAccountFromManyAddressesIsLockedOut() throws Exception {
    // the address can be faked behind a proxy, so wrong passwords also count per account
    for (int i = 1; i <= 10; i++) mvc.perform(login("locked.target@test.com", "wrong", "10.9.0." + i)).andExpect(status().isUnauthorized());
    mvc.perform(login("locked.target@test.com", "any-password", "10.9.1.1")).andExpect(status().isTooManyRequests());
    // other accounts are not affected
    mvc.perform(login(TestUsersSeeder.ADMIN_EMAIL, TestUsersSeeder.PASSWORD, "10.9.1.2")).andExpect(status().isOk());
  }

  @Test
  void answersCarrySecurityHeadersAndAreNeverCached() throws Exception {
    mvc.perform(get("/api/health"))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("X-Content-Type-Options", "nosniff"))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("X-Frame-Options", "DENY"))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control", "no-store"));
    // a huge body is refused before it is read
    mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + "a".repeat(1_100_000) + "\"}"))
        .andExpect(status().isPayloadTooLarge());
  }

  @Test
  void unsafeOrOverlongInputIsRefused() throws Exception {
    String header = "Bearer " + jwt.create(TestUsersSeeder.ADMIN_EMAIL, jwt.expiryFromNow());
    for (String image : new String[] {"javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "https://x.test/a.png\"onerror=\"x"}) {
      mvc.perform(post("/api/products").header("Authorization", header).contentType(MediaType.APPLICATION_JSON)
              .content("{\"name\":\"Bad\",\"costPrice\":1,\"sellingPrice\":0,\"unit\":\"pcs\",\"kind\":\"purchase\",\"image\":\"" + image.replace("\"", "\\\"") + "\"}"))
          .andExpect(status().isBadRequest());
    }
    mvc.perform(post("/api/products").header("Authorization", header).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Good\",\"costPrice\":1,\"sellingPrice\":0,\"unit\":\"pcs\",\"kind\":\"purchase\",\"image\":\"https://example.com/cake.jpg\"}"))
        .andExpect(status().isCreated());
    mvc.perform(post("/api/customers").header("Authorization", header).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"" + "n".repeat(201) + "\",\"phone\":\"\",\"email\":\"\",\"address\":\"\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void customersCannotEnterAndRemovingTheAdminRoleSignsThemOut() throws Exception {
    mvc.perform(login(TestUsersSeeder.CUSTOMER_EMAIL, TestUsersSeeder.PASSWORD, "10.4.0.1")).andExpect(status().isForbidden());

    jdbc.update("insert into public.users (name, email, password, role) select 'Temp Admin', 'temp@test.com', password, 'ADMIN' from public.users where email = ?", TestUsersSeeder.ADMIN_EMAIL);
    String body = mvc.perform(login("temp@test.com", TestUsersSeeder.PASSWORD, "10.4.0.2")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    String header = "Bearer " + json.readTree(body).get("token").asText();
    mvc.perform(get("/api/products").header("Authorization", header)).andExpect(status().isOk());
    jdbc.update("update public.users set role = 'CUSTOMER' where email = 'temp@test.com'");
    mvc.perform(get("/api/products").header("Authorization", header)).andExpect(status().isUnauthorized());
  }

  @Test
  void wrongCredentialsAreRejectedAndRepeatedFailuresAreLockedOut() throws Exception {
    mvc.perform(login(TestUsersSeeder.ADMIN_EMAIL, "wrong", "10.2.0.1")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Wrong email or password"));
    mvc.perform(login("someone-else@test.com", TestUsersSeeder.PASSWORD, "10.2.0.1")).andExpect(status().isUnauthorized());
    for (int i = 0; i < 3; i++) mvc.perform(login(TestUsersSeeder.ADMIN_EMAIL, "wrong", "10.2.0.1")).andExpect(status().isUnauthorized());
    // 5 failures so far: even the right password is refused for a while
    mvc.perform(login(TestUsersSeeder.ADMIN_EMAIL, TestUsersSeeder.PASSWORD, "10.2.0.1")).andExpect(status().isTooManyRequests());
    // other addresses are not affected
    mvc.perform(login(TestUsersSeeder.ADMIN_EMAIL, TestUsersSeeder.PASSWORD, "10.2.0.2")).andExpect(status().isOk());
  }
}
