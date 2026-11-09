package com.smartbusiness.os.web;

import com.smartbusiness.os.service.WebsiteSyncService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Delivered cake orders from the website, shown as sales. Read straight from the website's tables
 * (public.orders, public.order_items, public.users) on every request, so cancelling or re-opening an
 * order on the website is reflected at once. The OS never writes to these tables. Each order is linked
 * to the OS customer (same email) and each cake to the OS product (same name), so customer history,
 * top cakes and reports treat website and shop sales alike.
 */
@RestController
@RequestMapping("/api/website-sales")
public class WebsiteSalesController {
  public record Item(UUID productId, String name, int qty, String unit, BigDecimal price, BigDecimal discount) {}

  public record WebsiteSale(
      String id,
      String invoiceNo,
      LocalDate date,
      LocalDate paidOn,
      String source,
      UUID customerId,
      String customerName,
      String paymentMode,
      String deliveryType,
      BigDecimal deliveryCharge,
      List<Item> items,
      BigDecimal subtotal,
      BigDecimal discount,
      BigDecimal total) {}

  private static final String SQL = """
      select o.id, o.delivery_date, o.payment_method, o.delivery_type, o.total, u.name as customer_name,
             (select c.id from os.customers c where lower(c.email) = lower(u.email) order by c.created_at limit 1) as customer_id,
             (select p.id from os.products p where lower(p.name) = lower(i.cake_name) and p.kind <> 'purchase' order by p.created_at limit 1) as product_id,
             i.cake_name, i.price, i.quantity
      from public.orders o
      join public.users u on u.id = o.user_id
      join public.order_items i on i.order_id = o.id
      where o.status = 'DELIVERED'
        and o.id > (select max(after_order_id) from os.website_sync)
      order by o.delivery_date desc, o.id desc, i.id
      """;

  private final JdbcTemplate jdbc;
  private final WebsiteSyncService sync;

  public WebsiteSalesController(JdbcTemplate jdbc, WebsiteSyncService sync) {
    this.jdbc = jdbc;
    this.sync = sync;
  }

  @GetMapping
  public List<WebsiteSale> list() {
    sync.syncCakes();
    sync.syncCustomers();
    record Row(long orderId, LocalDate date, String payment, String delivery, BigDecimal total, String customer, UUID customerId, Item item) {}
    List<Row> rows = jdbc.query(SQL, (rs, n) -> new Row(
        rs.getLong("id"),
        rs.getObject("delivery_date", LocalDate.class),
        rs.getString("payment_method"),
        rs.getString("delivery_type"),
        rs.getBigDecimal("total"),
        rs.getString("customer_name"),
        rs.getObject("customer_id", UUID.class),
        new Item(rs.getObject("product_id", UUID.class), rs.getString("cake_name"), rs.getInt("quantity"), "pcs", rs.getBigDecimal("price"), BigDecimal.ZERO)));

    Map<Long, List<Row>> byOrder = new LinkedHashMap<>();
    rows.forEach(r -> byOrder.computeIfAbsent(r.orderId(), k -> new ArrayList<>()).add(r));

    List<WebsiteSale> sales = new ArrayList<>();
    byOrder.forEach((orderId, lines) -> {
      Row first = lines.get(0);
      sales.add(new WebsiteSale(
          "web-" + orderId,
          "WEB-" + orderId,
          first.date(),
          first.date(), // delivered website orders are paid
          "website",
          first.customerId(),
          first.customer(),
          "UPI".equals(first.payment()) ? "UPI" : "Cash",
          "DELIVERY".equals(first.delivery()) ? "DELIVERY" : "PICKUP",
          BigDecimal.ZERO,
          lines.stream().map(Row::item).toList(),
          first.total(),
          BigDecimal.ZERO,
          first.total()));
    });
    return sales;
  }
}
