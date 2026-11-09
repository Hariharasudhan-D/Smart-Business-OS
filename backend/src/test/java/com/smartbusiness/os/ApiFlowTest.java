package com.smartbusiness.os;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbusiness.os.auth.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles("test")
class ApiFlowTest {
  @Autowired WebApplicationContext ctx;
  @Autowired JwtService jwt;
  MockMvc mvc;
  @Autowired ObjectMapper json;

  @BeforeEach
  void signIn() {
    String token = jwt.create("admin@test.com", jwt.expiryFromNow());
    mvc = MockMvcBuilders.webAppContextSetup(ctx).defaultRequest(get("/").header("Authorization", "Bearer " + token)).build();
  }

  private JsonNode send(org.springframework.test.web.servlet.RequestBuilder req, int expected) throws Exception {
    String body = mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    return body.isEmpty() ? null : json.readTree(body);
  }

  private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder jsonPost(String url, String body) {
    return post(url).contentType(MediaType.APPLICATION_JSON).content(body);
  }

  @Test
  void productKeepsPhoneAppPhotoAndRejectsHugeOnes() throws Exception {
    // A shrunk phone photo (~30 KB as base64) is saved and read back unchanged.
    String photo = "data:image/jpeg;base64," + "A".repeat(30_000);
    String id = send(jsonPost("/api/products",
        "{\"name\":\"Truffle Cake\",\"costPrice\":0,\"sellingPrice\":0,\"unit\":\"kg\",\"kind\":\"selling\",\"image\":\"" + photo + "\"}"), 201)
        .get("id").asText();
    mvc.perform(get("/api/products/" + id)).andExpect(jsonPath("$.image").value(photo));

    // A picture far above the cap is refused with a readable message.
    String huge = "data:image/jpeg;base64," + "A".repeat(400_001);
    send(jsonPost("/api/products",
        "{\"name\":\"Too big\",\"costPrice\":10,\"sellingPrice\":0,\"unit\":\"pcs\",\"kind\":\"purchase\",\"image\":\"" + huge + "\"}"), 400);
  }

  @Test
  void purchaseAddsStockAndSaleDoesNot() throws Exception {
    JsonNode product = send(jsonPost("/api/products",
        "{\"name\":\"Maida 1kg\",\"costPrice\":40,\"sellingPrice\":0,\"unit\":\"kg\",\"kind\":\"purchase\",\"image\":\"\"}"), 201);
    String productId = product.get("id").asText();

    // validation error is readable
    send(jsonPost("/api/products", "{\"name\":\"\"}"), 400);

    send(jsonPost("/api/sellers", "{\"name\":\"Metro\",\"phone\":\"1\",\"email\":\"\",\"address\":\"\",\"gstin\":\"\"}"), 201);
    String customerId = send(jsonPost("/api/customers",
        "{\"name\":\"Asha\",\"phone\":\"\",\"email\":\"\",\"address\":\"\"}"), 201).get("id").asText();

    JsonNode purchase = send(jsonPost("/api/purchases",
        "{\"date\":\"2026-10-30\",\"supplier\":\"Metro\",\"invoiceNo\":\"M-1\",\"taxRate\":5,"
            + "\"items\":[{\"productId\":\"" + productId + "\",\"qty\":10,\"unitCost\":40}],\"subtotal\":1,\"tax\":1,\"total\":1}"), 201);
    org.junit.jupiter.api.Assertions.assertEquals(400.0, purchase.get("subtotal").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals(20.0, purchase.get("tax").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals(420.0, purchase.get("total").asDouble());

    // purchases no longer change stock
    mvc.perform(get("/api/products/" + productId)).andExpect(jsonPath("$.qty").value(0));

    JsonNode sale = send(jsonPost("/api/sales",
        "{\"date\":\"2026-10-31\",\"customerId\":\"" + customerId + "\",\"paymentMode\":\"Bank Transfer\","
            + "\"items\":[{\"productId\":\"" + productId + "\",\"qty\":3,\"price\":500,\"discount\":10}]}"), 201);
    org.junit.jupiter.api.Assertions.assertEquals(1500.0, sale.get("subtotal").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals(1350.0, sale.get("total").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals(150.0, sale.get("discount").asDouble());
    org.junit.jupiter.api.Assertions.assertEquals("Bank Transfer", sale.get("paymentMode").asText());

    mvc.perform(get("/api/sales")).andExpect(jsonPath("$[0].invoiceNo").value(matchesPattern("INV-\\d{4}-\\d{4}")));
    mvc.perform(get("/api/products/" + productId)).andExpect(jsonPath("$.qty").value(0));

    send(patch("/api/products/" + productId).contentType(MediaType.APPLICATION_JSON).content("{\"qty\":7}"), 200);
    mvc.perform(get("/api/products/" + productId)).andExpect(jsonPath("$.qty").value(7)).andExpect(jsonPath("$.name").value("Maida 1kg"));

    // purchase of an unknown product rolls back
    send(jsonPost("/api/purchases",
        "{\"date\":\"2026-10-30\",\"supplier\":\"Metro\",\"invoiceNo\":\"M-2\",\"taxRate\":0,"
            + "\"items\":[{\"productId\":\"00000000-0000-0000-0000-000000000001\",\"qty\":1,\"unitCost\":1}]}"), 400);
    mvc.perform(get("/api/purchases")).andExpect(jsonPath("$", hasSize(1)));

    // a buyer with sales cannot be deleted; deleting the sale first allows it
    send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/customers/" + customerId), 409);
    send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/sales/" + sale.get("id").asText()), 204);
    send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/customers/" + customerId), 204);

    send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/purchases/" + purchase.get("id").asText()), 204);
    mvc.perform(get("/api/purchases")).andExpect(jsonPath("$", hasSize(0)));
  }
}
