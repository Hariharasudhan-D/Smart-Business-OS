package com.smartbusiness.os;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smartbusiness.os.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WebsiteSalesTest {
  @Autowired MockMvc mvc;
  @Autowired JwtService jwt;
  @Autowired JdbcTemplate jdbc;

  private long order(String status, String payment, String total) {
    Long customer = jdbc.queryForObject("select id from public.users where email = ?", Long.class, TestUsersSeeder.CUSTOMER_EMAIL);
    jdbc.update("insert into public.orders (user_id, delivery_date, payment_method, status, total) values (?, date '2026-10-31', ?, ?, " + total + ")", customer, payment, status);
    return jdbc.queryForObject("select max(id) from public.orders", Long.class);
  }

  @Test
  void onlyDeliveredWebsiteOrdersShowAsSales() throws Exception {
    // an order that already existed when the OS started counting is ignored, even though it is delivered
    long beforeStart = order("DELIVERED", "CASH", "999.00");
    jdbc.update("insert into public.order_items (order_id, cake_id, cake_name, price, quantity) values (?, 1, 'Old Cake', 999.00, 1)", beforeStart);
    jdbc.update("update os.website_sync set after_order_id = ?", beforeStart);

    long delivered = order("DELIVERED", "UPI", "1200.00");
    jdbc.update("insert into public.order_items (order_id, cake_id, cake_name, price, quantity) values (?, 1, 'Chocolate Cake', 500.00, 2)", delivered);
    jdbc.update("insert into public.order_items (order_id, cake_id, cake_name, price, quantity) values (?, 2, 'Cupcake', 200.00, 1)", delivered);
    long pending = order("PENDING", "CASH", "300.00");
    jdbc.update("insert into public.order_items (order_id, cake_id, cake_name, price, quantity) values (?, 1, 'Chocolate Cake', 300.00, 1)", pending);
    long cancelled = order("CANCELLED", "CASH", "400.00");
    jdbc.update("insert into public.order_items (order_id, cake_id, cake_name, price, quantity) values (?, 1, 'Chocolate Cake', 400.00, 1)", cancelled);

    String auth = "Bearer " + jwt.create(TestUsersSeeder.ADMIN_EMAIL, jwt.expiryFromNow());
    mvc.perform(get("/api/website-sales").header("Authorization", auth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].invoiceNo").value("WEB-" + delivered))
        .andExpect(jsonPath("$[0].source").value("website"))
        .andExpect(jsonPath("$[0].customerName").value("Test Customer"))
        .andExpect(jsonPath("$[0].paymentMode").value("UPI"))
        .andExpect(jsonPath("$[0].date").value("2026-10-31"))
        .andExpect(jsonPath("$[0].total").value(1200.0))
        .andExpect(jsonPath("$[0].items", hasSize(2)))
        .andExpect(jsonPath("$[0].items[0].name").value("Chocolate Cake"))
        .andExpect(jsonPath("$[0].items[0].qty").value(2));

    // it is behind the admin login like everything else
    mvc.perform(get("/api/website-sales")).andExpect(status().isUnauthorized());
  }
}
