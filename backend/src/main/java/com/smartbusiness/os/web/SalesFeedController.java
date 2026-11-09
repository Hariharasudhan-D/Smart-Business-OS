package com.smartbusiness.os.web;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Shop sales and delivered website orders in one list, newest first, a page at a time:
 * {@code GET /api/sales/feed?page=0&size=30&q=asha&from=2026-11-01&to=2026-11-30}.
 *
 * <p>A page costs at most 4 queries whatever its size: the page of rows, the total count, and the
 * items of the shop sales and of the website orders on that page (no query per sale). Only the
 * rows of the requested page are read, using the sale_date / created_at indexes.
 */
@RestController
@RequestMapping("/api/sales/feed")
public class SalesFeedController {
  public record Item(UUID productId, String name, BigDecimal qty, String unit, BigDecimal price, BigDecimal discount, BigDecimal amount) {}

  public record FeedSale(
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

  // Same rules as the website-sales list and the report: delivered, after the "start from zero" cutoff,
  // with a buyer and at least one item.
  private static final String SHOP = """
      select cast(s.id as varchar(36)) as id, 'shop' as source, s.invoice_no as invoice_no, s.sale_date as sale_date,
             s.paid_on as paid_on, s.created_at as sort_ts, c.name as customer_name, cast(s.customer_id as varchar(36)) as customer_id,
             s.payment_mode as payment_mode, s.delivery_type as delivery_type, s.delivery_charge as delivery_charge,
             s.subtotal as subtotal, s.discount as discount, s.total as total
      from os.sales s join os.customers c on c.id = s.customer_id
      where 1 = 1""";
  private static final String WEB = """
      select concat('web-', cast(o.id as varchar(20))), 'website', concat('WEB-', cast(o.id as varchar(20))), o.delivery_date,
             o.delivery_date, o.created_at, u.name, cast(null as varchar(36)),
             o.payment_method, o.delivery_type, cast(0 as numeric(12,2)),
             o.total, cast(0 as numeric(12,2)), o.total
      from public.orders o join public.users u on u.id = o.user_id
      where o.status = 'DELIVERED'
        and o.id > (select max(after_order_id) from os.website_sync)
        and exists (select 1 from public.order_items i where i.order_id = o.id)""";

  private final JdbcTemplate jdbc;

  public SalesFeedController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping
  public PageResult<FeedSale> feed(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(required = false) Integer size,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to) {
    if (page < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be 0 or more");
    if (from != null && to != null && from.isAfter(to)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The start date must be on or before the end date");
    int pageSize = PageResult.clampSize(size, 30);

    // Filters are added only when given, so every parameter has a known type (PostgreSQL needs that).
    StringBuilder shop = new StringBuilder(SHOP);
    StringBuilder web = new StringBuilder(WEB);
    List<Object> shopArgs = new ArrayList<>();
    List<Object> webArgs = new ArrayList<>();
    if (from != null) {
      shop.append(" and s.sale_date >= ?");
      web.append(" and o.delivery_date >= ?");
      shopArgs.add(Date.valueOf(from));
      webArgs.add(Date.valueOf(from));
    }
    if (to != null) {
      shop.append(" and s.sale_date <= ?");
      web.append(" and o.delivery_date <= ?");
      shopArgs.add(Date.valueOf(to));
      webArgs.add(Date.valueOf(to));
    }
    String search = q == null ? "" : q.trim().toLowerCase();
    if (search.length() > 100) search = search.substring(0, 100); // a search never needs more; keeps LIKE cheap
    if (!search.isEmpty()) {
      String like = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
      shop.append(" and (lower(c.name) like ? or lower(s.invoice_no) like ?)");
      web.append(" and (lower(u.name) like ? or lower(concat('WEB-', cast(o.id as varchar(20)))) like ?)");
      shopArgs.add(like);
      shopArgs.add(like);
      webArgs.add(like);
      webArgs.add(like);
    }
    String union = shop + "\nunion all\n" + web;
    List<Object> args = new ArrayList<>(shopArgs);
    args.addAll(webArgs);

    Long total = jdbc.queryForObject("select count(*) from (" + union + ") f", Long.class, args.toArray());

    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(pageSize);
    pageArgs.add((long) page * pageSize);
    record Row(String id, String source, String invoiceNo, LocalDate date, LocalDate paidOn, String customerName, String customerId,
               String payment, String delivery, BigDecimal deliveryCharge, BigDecimal subtotal, BigDecimal discount, BigDecimal total) {}
    List<Row> rows = jdbc.query(
        "select * from (" + union + ") f order by f.sale_date desc, f.sort_ts desc, f.id desc limit ? offset ?",
        (rs, n) -> new Row(
            rs.getString("id"), rs.getString("source"), rs.getString("invoice_no"),
            rs.getObject("sale_date", LocalDate.class), rs.getObject("paid_on", LocalDate.class),
            rs.getString("customer_name"), rs.getString("customer_id"),
            rs.getString("payment_mode"), rs.getString("delivery_type"), rs.getBigDecimal("delivery_charge"),
            rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"), rs.getBigDecimal("total")),
        pageArgs.toArray());

    Map<String, List<Item>> itemsBySale = new LinkedHashMap<>();
    List<String> shopIds = rows.stream().filter(r -> r.source().equals("shop")).map(Row::id).toList();
    List<Long> webIds = rows.stream().filter(r -> r.source().equals("website")).map(r -> Long.parseLong(r.id().substring(4))).toList();
    if (!shopIds.isEmpty()) {
      jdbc.query(
          "select si.sale_id, si.product_id, p.name, si.qty, si.unit, si.price, si.discount, si.amount "
              + "from os.sale_items si left join os.products p on p.id = si.product_id where si.sale_id in (" + marks(shopIds.size()) + ")",
          rs -> {
            itemsBySale.computeIfAbsent(rs.getString("sale_id"), k -> new ArrayList<>()).add(new Item(
                rs.getObject("product_id", UUID.class), rs.getString("name"), rs.getBigDecimal("qty"), rs.getString("unit"),
                rs.getBigDecimal("price"), rs.getBigDecimal("discount"), rs.getBigDecimal("amount")));
          },
          shopIds.stream().map(UUID::fromString).toArray());
    }
    if (!webIds.isEmpty()) {
      jdbc.query(
          "select i.order_id, i.cake_name, i.quantity, i.price from public.order_items i where i.order_id in (" + marks(webIds.size()) + ") order by i.id",
          rs -> {
            itemsBySale.computeIfAbsent("web-" + rs.getLong("order_id"), k -> new ArrayList<>()).add(new Item(
                null, rs.getString("cake_name"), BigDecimal.valueOf(rs.getInt("quantity")), "pcs", rs.getBigDecimal("price"), BigDecimal.ZERO, null));
          },
          webIds.toArray());
    }

    List<FeedSale> sales = rows.stream().map(r -> {
      boolean website = r.source().equals("website");
      return new FeedSale(
          r.id(), r.invoiceNo(), r.date(), r.paidOn(), r.source(),
          r.customerId() == null ? null : UUID.fromString(r.customerId()),
          r.customerName(),
          website ? ("UPI".equals(r.payment()) ? "UPI" : "Cash") : "BankTransfer".equals(r.payment()) ? "Bank Transfer" : r.payment(),
          "DELIVERY".equals(r.delivery()) ? "DELIVERY" : "PICKUP",
          r.deliveryCharge() == null ? BigDecimal.ZERO : r.deliveryCharge(),
          itemsBySale.getOrDefault(r.id(), Collections.emptyList()),
          r.subtotal(), r.discount(), r.total());
    }).toList();
    return PageResult.of(sales, total == null ? 0 : total, page, pageSize);
  }

  private static String marks(int n) {
    return String.join(",", Collections.nCopies(n, "?"));
  }
}
