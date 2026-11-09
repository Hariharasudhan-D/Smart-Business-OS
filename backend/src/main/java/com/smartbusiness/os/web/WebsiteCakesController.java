package com.smartbusiness.os.web;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The website's cake menu (name, price, photo), used for suggestions when recording a sale. Read-only. */
@RestController
@RequestMapping("/api/website-cakes")
public class WebsiteCakesController {
  public record Cake(long id, String name, BigDecimal price, String imageUrl) {}

  private final JdbcTemplate jdbc;

  public WebsiteCakesController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping
  public List<Cake> list() {
    return jdbc.query(
        "select id, name, price, image_url from public.cakes where available = true order by name",
        (rs, n) -> new Cake(rs.getLong("id"), rs.getString("name"), rs.getBigDecimal("price"), rs.getString("image_url")));
  }
}
