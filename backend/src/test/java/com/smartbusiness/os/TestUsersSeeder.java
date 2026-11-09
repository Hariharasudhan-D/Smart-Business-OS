package com.smartbusiness.os;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/** Test data standing in for the website's accounts: one admin and one ordinary customer. */
@Component
@Profile("test")
class TestUsersSeeder implements ApplicationRunner {
  static final String ADMIN_EMAIL = "admin@test.com";
  static final String CUSTOMER_EMAIL = "customer@test.com";
  static final String PASSWORD = "test-password-123";

  private final JdbcTemplate jdbc;

  TestUsersSeeder(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void run(ApplicationArguments args) {
    String hash = new BCryptPasswordEncoder().encode(PASSWORD);
    add("Test Admin", ADMIN_EMAIL, hash, "ADMIN");
    add("Test Customer", CUSTOMER_EMAIL, hash, "CUSTOMER");
  }

  private void add(String name, String email, String hash, String role) {
    Integer exists = jdbc.queryForObject("select count(*) from public.users where email = ?", Integer.class, email);
    if (exists == null || exists == 0) {
      jdbc.update("insert into public.users (name, email, password, role) values (?, ?, ?, ?)", name, email, hash, role);
    }
  }
}
