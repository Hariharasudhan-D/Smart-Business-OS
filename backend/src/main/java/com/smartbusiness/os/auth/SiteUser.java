package com.smartbusiness.os.auth;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

/** A row of the website's users table. The OS only reads it: accounts are created and changed on the website. */
@Entity
@Immutable
@Table(name = "users", schema = "public")
public class SiteUser {
  public enum Role { CUSTOMER, ADMIN }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String name;
  private String email;
  private String password;

  @Enumerated(EnumType.STRING)
  private Role role;

  protected SiteUser() {}

  public Long getId() { return id; }
  public String getName() { return name; }
  public String getEmail() { return email; }
  public String getPassword() { return password; }
  public Role getRole() { return role; }
}
