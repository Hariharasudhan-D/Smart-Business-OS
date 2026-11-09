package com.smartbusiness.os.service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Keeps the OS in step with the Geethu's Corner website, which is the source of truth for the cake
 * menu and for customers who order online. Only the OS's own tables (schema os) are written; the
 * website's tables are read. Runs before the cake, customer and website-sales lists are returned, so
 * the OS website and the phone app always see the same cakes and customers.
 *
 * <p>Each sync runs at most once per {@code app.website-sync.min-interval-seconds} (60 s by default):
 * syncing on every request made every screen wait for several database writes. Website changes
 * therefore reach the OS within a minute.
 */
@Service
public class WebsiteSyncService {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final long minIntervalMs;
  private volatile long cakesSyncedAt;
  private volatile long customersSyncedAt;

  public WebsiteSyncService(
      JdbcTemplate jdbc,
      PlatformTransactionManager transactions,
      @Value("${app.website-sync.min-interval-seconds:60}") long minIntervalSeconds) {
    this.jdbc = jdbc;
    this.tx = new TransactionTemplate(transactions);
    this.minIntervalMs = minIntervalSeconds * 1000;
  }

  private boolean fresh(long syncedAt) {
    return syncedAt != 0 && System.currentTimeMillis() - syncedAt < minIntervalMs;
  }

  /** Every available website cake becomes a selling product (same name, price and photo). */
  public void syncCakes() {
    if (fresh(cakesSyncedAt)) return;
    synchronized (this) {
      if (fresh(cakesSyncedAt)) return;
      tx.executeWithoutResult(status -> copyCakes());
      cakesSyncedAt = System.currentTimeMillis();
    }
  }

  /** Website buyers with a delivered order (after the "start from zero" cutoff) become OS customers. */
  public void syncCustomers() {
    if (fresh(customersSyncedAt)) return;
    synchronized (this) {
      if (fresh(customersSyncedAt)) return;
      tx.executeWithoutResult(status -> copyCustomers());
      customersSyncedAt = System.currentTimeMillis();
    }
  }

  private void copyCakes() {
    jdbc.query(
        """
        select c.name, max(c.price) as price, max(c.image_url) as image_url
        from public.cakes c
        where c.available = true
          and not exists (select 1 from os.products p where lower(p.name) = lower(c.name))
        group by c.name
        """,
        rs -> {
          String image = rs.getString("image_url");
          jdbc.update(
              "insert into os.products (id, name, cost_price, selling_price, qty, reorder_level, unit, kind, image, created_at) "
                  + "values (?, ?, 0, ?, 0, 0, 'pcs', 'selling', ?, ?)",
              UUID.randomUUID(), rs.getString("name"), money(rs.getBigDecimal("price")), image == null ? "" : image, now());
        });
    // The website owns the menu: keep price and photo of matching cakes up to date.
    jdbc.update(
        """
        update os.products set
          selling_price = (select max(c.price) from public.cakes c where lower(c.name) = lower(os.products.name)),
          image = coalesce((select max(c.image_url) from public.cakes c where lower(c.name) = lower(os.products.name)), image)
        where kind <> 'purchase'
          and exists (select 1 from public.cakes c where lower(c.name) = lower(os.products.name))
          -- only rows that really changed, so a normal sync writes nothing
          and (selling_price is distinct from (select max(c.price) from public.cakes c where lower(c.name) = lower(os.products.name))
            or image is distinct from coalesce((select max(c.image_url) from public.cakes c where lower(c.name) = lower(os.products.name)), image))
        """);
  }

  private void copyCustomers() {
    jdbc.query(
        """
        select u.name, u.email, max(coalesce(nullif(u.phone, ''), o.phone)) as phone
        from public.users u
        join public.orders o on o.user_id = u.id
        where o.status = 'DELIVERED'
          and o.id > (select max(after_order_id) from os.website_sync)
          and not exists (select 1 from os.customers c where lower(c.email) = lower(u.email))
        group by u.id, u.name, u.email
        """,
        rs -> {
          String phone = rs.getString("phone");
          jdbc.update(
              "insert into os.customers (id, name, phone, email, address, created_at) values (?, ?, ?, ?, '', ?)",
              UUID.randomUUID(), rs.getString("name"), phone == null ? "" : phone, rs.getString("email"), now());
        });
  }

  private static BigDecimal money(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }

  private static Timestamp now() {
    return Timestamp.valueOf(LocalDateTime.now());
  }
}
