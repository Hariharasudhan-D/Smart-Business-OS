package com.smartbusiness.os;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbusiness.os.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SaleDeliveryTest {
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

  @Test
  void kgQuantitiesTypedAmountsAndDeliveryChargeKeptOutOfTheTotal() throws Exception {
    String cake = post201("/api/products", "{\"name\":\"Black Forest\",\"costPrice\":0,\"sellingPrice\":800,\"unit\":\"kg\",\"kind\":\"selling\"}").get("id").asText();
    String buyer = post201("/api/customers", "{\"name\":\"Meena\"}").get("id").asText();

    // 1.5 kg at 800/kg = 1200, plus 6 pieces sold for a typed 500; home delivery charge 60 is separate
    JsonNode sale = post201("/api/sales", "{\"date\":\"2026-11-04\",\"customerId\":\"" + buyer + "\",\"paymentMode\":\"UPI\","
        + "\"deliveryType\":\"DELIVERY\",\"deliveryCharge\":60,"
        + "\"items\":[{\"productId\":\"" + cake + "\",\"qty\":1.5,\"unit\":\"kg\",\"price\":800,\"discount\":0},"
        + "{\"productId\":\"" + cake + "\",\"qty\":6,\"unit\":\"pcs\",\"price\":90,\"discount\":0,\"amount\":500}]}");
    org.junit.jupiter.api.Assertions.assertEquals(1700.0, sale.get("total").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals(60.0, sale.get("deliveryCharge").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals("DELIVERY", sale.get("deliveryType").asText());
    org.junit.jupiter.api.Assertions.assertEquals(1.5, sale.get("items").get(0).get("qty").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals("kg", sale.get("items").get(0).get("unit").asText());

    // pickup never carries a delivery charge; old clients without unit/discount still work
    JsonNode pickup = post201("/api/sales", "{\"date\":\"2026-11-04\",\"customerId\":\"" + buyer + "\",\"paymentMode\":\"Cash\","
        + "\"deliveryType\":\"PICKUP\",\"deliveryCharge\":99,"
        + "\"items\":[{\"productId\":\"" + cake + "\",\"qty\":2,\"price\":100}]}");
    org.junit.jupiter.api.Assertions.assertEquals(200.0, pickup.get("total").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals(0.0, pickup.get("deliveryCharge").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals("pcs", pickup.get("items").get(0).get("unit").asText());
    org.junit.jupiter.api.Assertions.assertEquals("2026-11-04", pickup.get("paidOn").asText());
  }

  @Test
  void websiteCakeMenuIsListedForSuggestions() throws Exception {
    jdbc.update("insert into public.cakes (name, price, image_url, available) values ('Red Velvet', 650.00, 'https://example.com/rv.jpg', true)");
    jdbc.update("insert into public.cakes (name, price, image_url, available) values ('Hidden Cake', 100.00, null, false)");
    mvc.perform(get("/api/website-cakes").header("Authorization", auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.name == 'Red Velvet')].imageUrl").value("https://example.com/rv.jpg"))
        .andExpect(jsonPath("$[?(@.name == 'Hidden Cake')]").isEmpty());
  }

  @Test
  void advanceOrderForTomorrowIsAllowedAndCashCountsToday() throws Exception {
    String cake = post201("/api/products", "{\"name\":\"Black Forest\",\"costPrice\":0,\"sellingPrice\":500,\"unit\":\"kg\",\"kind\":\"selling\"}").get("id").asText();
    String buyer = post201("/api/customers", "{\"name\":\"Meena\"}").get("id").asText();
    java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
    JsonNode sale = post201("/api/sales", "{\"date\":\"" + today.plusDays(1) + "\",\"customerId\":\"" + buyer + "\",\"paymentMode\":\"Cash\","
        + "\"items\":[{\"productId\":\"" + cake + "\",\"qty\":1,\"unit\":\"kg\",\"price\":500}]}");
    org.junit.jupiter.api.Assertions.assertEquals(today.plusDays(1).toString(), sale.get("date").asText());
    org.junit.jupiter.api.Assertions.assertEquals(today.toString(), sale.get("paidOn").asText());
  }
}
