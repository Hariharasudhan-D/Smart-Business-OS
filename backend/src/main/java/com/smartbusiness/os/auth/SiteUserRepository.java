package com.smartbusiness.os.auth;

import java.util.Optional;
import org.springframework.data.repository.Repository;

/** Read-only access to the website's users. */
public interface SiteUserRepository extends Repository<SiteUser, Long> {
  Optional<SiteUser> findByEmail(String email);

  boolean existsByEmailAndRole(String email, SiteUser.Role role);
}
