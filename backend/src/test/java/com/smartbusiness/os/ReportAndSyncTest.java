package com.smartbusiness.os;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbusiness.os.auth.JwtService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** The shared report (used by both the OS website and the phone app) and the website sync. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReportAndSyncTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JwtService jwt;
  @Autowired JdbcTemplate jdbc;

  private String auth() {
    return "Bearer " + jwt.create(TestUsersSeeder.ADMIN_EMAIL, jwt.expiryFromNow());
  }

  private JsonNode post201(String url, String body) throws Exception {
    String res = mvc.perform(post(url).header("Authorization", auth()).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    return json.readTree(res);
  }

  private JsonNode getJson(String url) throws Exception {
    return json.readTree(mvc.perform(get(url).header("Authorization", auth())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
  }

  @Test
  void reportCountsMoneyReceivedPurchasesAndKeepsDeliveryApart() throws Exception {
    String cake = post201("/api/products", "{\"name\":\"Report Cake\",\"costPrice\":0,\"sellingPrice\":500,\"unit\":\"pcs\",\"kind\":\"selling\"}").get("id").asText();
    String buyer = post201("/api/customers", "{\"name\":\"Report Buyer\"}").get("id").asText();
    String item = "\"items\":[{\"productId\":\"" + cake + "\",\"qty\":1,\"unit\":\"pcs\",\"price\":500}]";
    // March 2019: a 500 cash sale with a 50 delivery charge, a 300 UPI sale, a 200 purchase
    post201("/api/sales", "{\"date\":\"2019-03-10\",\"customerId\":\"" + buyer + "\",\"paymentMode\":\"Cash\",\"deliveryType\":\"DELIVERY\",\"deliveryCharge\":50," + item + "}");
    post201("/api/sales", "{\"date\":\"2019-03-11\",\"customerId\":\"" + buyer + "\",\"paymentMode\":\"UPI\","
        + "\"items\":[{\"productId\":\"" + cake + "\",\"qty\":1,\"unit\":\"pcs\",\"price\":300}]}");
    post201("/api/purchases", "{\"date\":\"2019-03-12\",\"supplier\":\"Baker's World\",\"invoiceNo\":\"36\",\"taxRate\":0,"
        + "\"items\":[{\"productId\":\"" + cake + "\",\"qty\":2,\"unitCost\":100}]}");

    JsonNode month = getJson("/api/report?from=2019-03-01&to=2019-03-31&group=day");
    Assertions.assertEquals(800.0, month.at("/totals/sales").asDouble());
    Assertions.assertEquals(200.0, month.at("/totals/purchases").asDouble());
    Assertions.assertEquals(600.0, month.at("/totals/profit").asDouble());
    Assertions.assertEquals(50.0, month.at("/totals/delivery").asDouble());
    Assertions.assertEquals(2, month.at("/totals/orders").asInt());
    Assertions.assertEquals(31, month.get("rows").size(), "every day of the month is listed");

    JsonNode year = getJson("/api/report?from=2019-01-01&to=2019-12-31&group=month");
    Assertions.assertEquals(12, year.get("rows").size());
    Assertions.assertEquals("2019-03", year.at("/rows/2/key").asText());
    Assertions.assertEquals(800.0, year.at("/rows/2/sales").asDouble());

    mvc.perform(get("/api/report?from=2019-03-31&to=2019-03-01").header("Authorization", auth())).andExpect(status().isBadRequest());
  }

  @Test
  void websiteCakesAndBuyersAppearInTheOsLists() throws Exception {
    jdbc.update("insert into public.cakes (name, price, image_url, available) values ('Sync Truffle', 750.00, 'https://example.com/t.jpg', true)");
    JsonNode products = getJson("/api/products");
    JsonNode truffle = null;
    for (JsonNode p : products) if (p.get("name").asText().equals("Sync Truffle")) truffle = p;
    Assertions.assertNotNull(truffle, "website cake is listed as a product");
    Assertions.assertEquals(750.0, truffle.get("sellingPrice").asDouble());
    Assertions.assertEquals("https://example.com/t.jpg", truffle.get("image").asText());

    // the website changes the price: the OS follows, and the cake is never added twice
    jdbc.update("update public.cakes set price = 800.00 where name = 'Sync Truffle'");
    mvc.perform(get("/api/products").header("Authorization", auth()))
        .andExpect(jsonPath("$[?(@.name == 'Sync Truffle')].sellingPrice").value(800.0))
        .andExpect(jsonPath("$[?(@.name == 'Sync Truffle')]").value(org.hamcrest.Matchers.hasSize(1)));

    // a website buyer with a delivered order becomes an OS customer, linked to the website sale
    jdbc.update("insert into public.users (name, email, password, phone, role) values ('Web Buyer', 'web.buyer@test.local', 'x', '9000000001', 'CUSTOMER')");
    Long user = jdbc.queryForObject("select id from public.users where email = 'web.buyer@test.local'", Long.class);
    jdbc.update("insert into public.orders (user_id, delivery_date, payment_method, status, total) values (?, date '2031-05-05', 'UPI', 'DELIVERED', 800.00)", user);
    Long order = jdbc.queryForObject("select max(id) from public.orders", Long.class);
    jdbc.update("insert into public.order_items (order_id, cake_id, cake_name, price, quantity) values (?, 1, 'Sync Truffle', 800.00, 1)", order);

    JsonNode customers = getJson("/api/customers");
    String customerId = null;
    for (JsonNode c : customers) if (c.get("email").asText().equals("web.buyer@test.local")) customerId = c.get("id").asText();
    Assertions.assertNotNull(customerId, "website buyer is an OS customer");
    Assertions.assertEquals(1, jdbc.queryForObject("select count(*) from os.customers where email = 'web.buyer@test.local'", Integer.class));
    getJson("/api/customers");
    Assertions.assertEquals(1, jdbc.queryForObject("select count(*) from os.customers where email = 'web.buyer@test.local'", Integer.class), "not added twice");

    mvc.perform(get("/api/website-sales").header("Authorization", auth()))
        .andExpect(jsonPath("$[?(@.id == 'web-" + order + "')].customerId").value(customerId))
        .andExpect(jsonPath("$[?(@.id == 'web-" + order + "')].items[0].productId").value(truffle.get("id").asText()));
    Assertions.assertEquals(800.0, getJson("/api/report?from=2031-05-01&to=2031-05-31").at("/totals/sales").asDouble());
  }
}
