package com.smartbusiness.os;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbusiness.os.auth.JwtService;
import com.smartbusiness.os.db.QueryStats;
import com.smartbusiness.os.service.PurchaseService;
import com.smartbusiness.os.web.SalesFeedController;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Server-side pages for sales (shop + website) and purchases, and that a page costs a fixed few queries. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PaginationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JwtService jwt;
  @Autowired JdbcTemplate jdbc;
  @Autowired SalesFeedController feed;
  @Autowired PurchaseService purchases;

  private String auth() {
    return "Bearer " + jwt.create(TestUsersSeeder.ADMIN_EMAIL, jwt.expiryFromNow());
  }

  private JsonNode post201(String url, String body) throws Exception {
    return json.readTree(mvc.perform(post(url).header("Authorization", auth()).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
  }

  private JsonNode getJson(String url) throws Exception {
    return json.readTree(mvc.perform(get(url).header("Authorization", auth())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
  }

  @Test
  void salesAndPurchasesComeOnePageAtATime() throws Exception {
    List<String> saleIds = new ArrayList<>();
    List<String> purchaseIds = new ArrayList<>();
    try {
      String productId = post201("/api/products", "{\"name\":\"Feed Cake\",\"costPrice\":0,\"sellingPrice\":0,\"unit\":\"kg\",\"kind\":\"both\",\"image\":\"\"}").get("id").asText();
      String customerId = post201("/api/customers", "{\"name\":\"Feed Buyer\",\"phone\":\"\",\"email\":\"\",\"address\":\"\"}").get("id").asText();
      for (int day = 1; day <= 3; day++) {
        saleIds.add(post201("/api/sales", "{\"date\":\"2041-02-0" + day + "\",\"customerId\":\"" + customerId + "\",\"paymentMode\":\"Cash\","
            + "\"items\":[{\"productId\":\"" + productId + "\",\"qty\":1.5,\"unit\":\"kg\",\"price\":600}]}").get("id").asText());
        purchaseIds.add(post201("/api/purchases", "{\"date\":\"2041-03-0" + day + "\",\"supplier\":\"Feed Supplier\",\"invoiceNo\":\"FS-" + day + "\",\"taxRate\":0,"
            + "\"items\":[{\"productId\":\"" + productId + "\",\"qty\":1,\"unitCost\":100}]}").get("id").asText());
      }
      // a delivered website order on 2041-02-02
      jdbc.update("insert into public.users (name, email, password, phone, role) values ('Feed Web', 'feed.web@test.local', 'x', '', 'CUSTOMER')");
      Long user = jdbc.queryForObject("select id from public.users where email = 'feed.web@test.local'", Long.class);
      jdbc.update("insert into public.orders (user_id, delivery_date, payment_method, status, total) values (?, date '2041-02-02', 'UPI', 'DELIVERED', 900.00)", user);
      Long order = jdbc.queryForObject("select max(id) from public.orders", Long.class);
      jdbc.update("insert into public.order_items (order_id, cake_id, cake_name, price, quantity) values (?, 1, 'Web Truffle', 900.00, 1)", order);

      // page 0 of 2: newest first, with items
      JsonNode p0 = getJson("/api/sales/feed?from=2041-02-01&to=2041-02-28&size=2&page=0");
      Assertions.assertEquals(4, p0.get("total").asInt());
      Assertions.assertEquals(2, p0.get("items").size());
      Assertions.assertTrue(p0.get("hasMore").asBoolean());
      Assertions.assertEquals("2041-02-03", p0.at("/items/0/date").asText());
      Assertions.assertEquals("Feed Cake", p0.at("/items/0/items/0/name").asText());
      Assertions.assertEquals(1.5, p0.at("/items/0/items/0/qty").asDouble());

      // page 1: the rest, including the website order with its cake
      JsonNode p1 = getJson("/api/sales/feed?from=2041-02-01&to=2041-02-28&size=2&page=1");
      Assertions.assertEquals(2, p1.get("items").size());
      Assertions.assertFalse(p1.get("hasMore").asBoolean());
      boolean webFound = false;
      for (JsonNode s : p0.get("items")) webFound |= s.get("id").asText().equals("web-" + order);
      for (JsonNode s : p1.get("items")) {
        if (s.get("id").asText().equals("web-" + order)) {
          webFound = true;
          Assertions.assertEquals("website", s.get("source").asText());
          Assertions.assertEquals("Web Truffle", s.at("/items/0/name").asText());
          Assertions.assertEquals("UPI", s.get("paymentMode").asText());
        }
      }
      Assertions.assertTrue(webFound, "website order is in the feed");

      // search by customer name, on the server
      Assertions.assertEquals(3, getJson("/api/sales/feed?from=2041-02-01&to=2041-02-28&q=BUYER").get("total").asInt());

      // purchases: paged, filtered, searched; the plain list still works
      JsonNode pp = getJson("/api/purchases?page=0&size=2&from=2041-03-01&to=2041-03-31");
      Assertions.assertEquals(3, pp.get("total").asInt());
      Assertions.assertEquals(2, pp.get("items").size());
      Assertions.assertEquals("2041-03-03", pp.at("/items/0/date").asText());
      Assertions.assertEquals(1, pp.at("/items/0/items").size());
      Assertions.assertEquals(1, getJson("/api/purchases?q=fs-2&from=2041-03-01&to=2041-03-31").size());
      Assertions.assertTrue(getJson("/api/purchases").isArray());

      // a page costs a fixed few queries, not one per sale (no N+1)
      QueryStats.begin();
      feed.feed(0, 50, null, LocalDate.of(2041, 2, 1), LocalDate.of(2041, 2, 28));
      long feedQueries = QueryStats.end()[0];
      Assertions.assertTrue(feedQueries <= 4, "sales page used " + feedQueries + " queries");
      QueryStats.begin();
      purchases.search(LocalDate.of(2041, 3, 1), LocalDate.of(2041, 3, 31), null, 0, 50).getContent().forEach(p -> p.getItems().size());
      long purchaseQueries = QueryStats.end()[0];
      Assertions.assertTrue(purchaseQueries <= 3, "purchases page used " + purchaseQueries + " queries");
    } finally {
      for (String id : saleIds) mvc.perform(delete("/api/sales/" + id).header("Authorization", auth()));
      for (String id : purchaseIds) mvc.perform(delete("/api/purchases/" + id).header("Authorization", auth()));
      jdbc.update("delete from public.order_items where cake_name = 'Web Truffle'");
      jdbc.update("delete from public.orders where user_id in (select id from public.users where email = 'feed.web@test.local')");
      jdbc.update("delete from public.users where email = 'feed.web@test.local'");
    }
  }
}
