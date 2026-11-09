package com.smartbusiness.os.web;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The one place where sales, purchases and profit are calculated. The OS website and the phone app
 * both show these numbers, so they always agree.
 *
 * <ul>
 *   <li>Sales = shop sales by their counted day (the order day, or today for advance orders) and
 *       delivered website orders by their delivery day.
 *   <li>Purchases by purchase day. Profit = sales - purchases.
 *   <li>Delivery charges are reported apart and never count as sales or profit.
 *   <li>Orders = sales booked for the day (shop sales by order day, website orders by delivery day).
 * </ul>
 */
@RestController
@RequestMapping("/api/report")
public class ReportController {
  public record Row(String key, BigDecimal sales, BigDecimal purchases, BigDecimal profit, BigDecimal delivery, int orders) {}

  public record Totals(BigDecimal sales, BigDecimal purchases, BigDecimal profit, BigDecimal delivery, int deliveries, int orders) {}

  public record Report(LocalDate from, LocalDate to, String group, Totals totals, List<Row> rows) {}

  private static final class Bucket {
    BigDecimal sales = BigDecimal.ZERO;
    BigDecimal purchases = BigDecimal.ZERO;
    BigDecimal delivery = BigDecimal.ZERO;
    int deliveries;
    int orders;
  }

  /**
   * Everything the report needs for [from, to], in one database round trip and without loading
   * sale items or rows outside the range:
   *   paid     = shop sales by the day the money came in (sales)
   *   booked   = shop sales by order day (orders, delivery charges)
   *   purchase = purchases by purchase day
   *   web      = delivered website orders by delivery day (sales and orders), with the same rules as
   *              the website-sales list: after the "start from zero" cutoff, with a buyer and at least one item.
   */
  private static final String SQL = """
      select 'paid' as row_kind, s.paid_on as row_day, s.total as row_amount from os.sales s
        where s.paid_on between ? and ?
      union all
      select 'booked', s.sale_date, s.delivery_charge from os.sales s
        where s.sale_date between ? and ?
      union all
      select 'purchase', p.purchase_date, p.total from os.purchases p
        where p.purchase_date between ? and ?
      union all
      select 'web', o.delivery_date, o.total from public.orders o
        join public.users u on u.id = o.user_id
        where o.status = 'DELIVERED'
          and o.id > (select max(after_order_id) from os.website_sync)
          and o.delivery_date between ? and ?
          and exists (select 1 from public.order_items i where i.order_id = o.id)
      """;

  private final JdbcTemplate jdbc;

  public ReportController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /** group: day | month | year | none. Every bucket in [from, to] is returned, empty ones as zeros. */
  // Not one big transaction: it would hold a database connection while the website sync needs another.
  @GetMapping
  public Report report(@RequestParam LocalDate from, @RequestParam LocalDate to, @RequestParam(defaultValue = "none") String group) {
    if (from.isAfter(to)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The start date must be on or before the end date");
    Function<LocalDate, String> keyOf = switch (group) {
      case "day" -> LocalDate::toString;
      case "month" -> d -> d.toString().substring(0, 7);
      case "year" -> d -> d.toString().substring(0, 4);
      case "none" -> d -> "all";
      default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "group must be day, month, year or none");
    };
    if (group.equals("day") && ChronoUnit.DAYS.between(from, to) > 400) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use month or year for ranges longer than about a year");
    }
    if (ChronoUnit.YEARS.between(from, to) > 50) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Range too long");

    Map<String, Bucket> buckets = new LinkedHashMap<>();
    for (LocalDate d = from; !d.isAfter(to); d = step(d, group)) buckets.putIfAbsent(keyOf.apply(d), new Bucket());
    buckets.putIfAbsent(keyOf.apply(to), new Bucket());
    Function<LocalDate, Bucket> at = d -> d == null || d.isBefore(from) || d.isAfter(to) ? null : buckets.get(keyOf.apply(d));

    Date f = Date.valueOf(from);
    Date t = Date.valueOf(to);
    jdbc.query(SQL, rs -> {
      Bucket b = at.apply(rs.getObject("row_day", LocalDate.class));
      if (b == null) return;
      BigDecimal amount = rs.getBigDecimal("row_amount") == null ? BigDecimal.ZERO : rs.getBigDecimal("row_amount");
      switch (rs.getString("row_kind")) {
        case "paid" -> b.sales = b.sales.add(amount);
        case "booked" -> {
          b.orders++;
          if (amount.signum() > 0) {
            b.delivery = b.delivery.add(amount);
            b.deliveries++;
          }
        }
        case "purchase" -> b.purchases = b.purchases.add(amount);
        case "web" -> {
          b.sales = b.sales.add(amount);
          b.orders++;
        }
        default -> { }
      }
    }, f, t, f, t, f, t, f, t);

    List<Row> rows = new ArrayList<>();
    Bucket sum = new Bucket();
    buckets.forEach((key, b) -> {
      rows.add(new Row(key, b.sales, b.purchases, b.sales.subtract(b.purchases), b.delivery, b.orders));
      sum.sales = sum.sales.add(b.sales);
      sum.purchases = sum.purchases.add(b.purchases);
      sum.delivery = sum.delivery.add(b.delivery);
      sum.deliveries += b.deliveries;
      sum.orders += b.orders;
    });
    Totals totals = new Totals(sum.sales, sum.purchases, sum.sales.subtract(sum.purchases), sum.delivery, sum.deliveries, sum.orders);
    return new Report(from, to, group, totals, rows);
  }

  private static LocalDate step(LocalDate d, String group) {
    return switch (group) {
      case "month" -> d.withDayOfMonth(1).plusMonths(1);
      case "year" -> d.withDayOfYear(1).plusYears(1);
      case "none" -> d.plusYears(1000);
      default -> d.plusDays(1);
    };
  }
}
