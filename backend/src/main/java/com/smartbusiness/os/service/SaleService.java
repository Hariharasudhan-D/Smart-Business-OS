package com.smartbusiness.os.service;

import com.smartbusiness.os.model.Sale;
import com.smartbusiness.os.model.SaleItem;
import com.smartbusiness.os.repo.Repositories.CustomerRepository;
import com.smartbusiness.os.repo.Repositories.ProductRepository;
import com.smartbusiness.os.repo.Repositories.SaleRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SaleService {
  private static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");
  private final SaleRepository sales;
  private final CustomerRepository customers;
  private final ProductRepository products;

  public SaleService(SaleRepository sales, CustomerRepository customers, ProductRepository products) {
    this.sales = sales;
    this.customers = customers;
    this.products = products;
  }

  @Transactional(readOnly = true)
  public List<Sale> list() {
    return sales.findAll(Sort.by(Sort.Direction.DESC, "date").and(Sort.by(Sort.Direction.DESC, "createdAt")));
  }

  @Transactional(readOnly = true)
  public Sale get(UUID id) {
    return sales.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sale not found"));
  }

  /** Selling does not touch stock: products are made to order. */
  @Transactional
  public Sale create(Sale sale) {
    if (!customers.existsById(sale.getCustomerId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown customer");
    }
    sale.setItems(new java.util.ArrayList<>(sale.getItems().stream().map(SaleItem::normalized).toList()));
    BigDecimal subtotal = BigDecimal.ZERO;
    BigDecimal total = BigDecimal.ZERO;
    // All products checked in one query (was one query per item).
    java.util.Set<java.util.UUID> productIds = new java.util.HashSet<>();
    sale.getItems().forEach(i -> productIds.add(i.productId()));
    if (productIds.contains(null) || products.countByIdIn(productIds) != productIds.size()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown product in sale");
    }
    for (SaleItem item : sale.getItems()) {
      // A typed line amount wins over qty x price (e.g. 1.5 kg sold for a round 1000).
      BigDecimal line = item.amount() != null ? Money.round(item.amount()) : Money.afterDiscount(item.qty(), item.price(), item.discount());
      subtotal = subtotal.add(item.amount() != null ? line : Money.times(item.qty(), item.price()));
      total = total.add(line);
    }
    // The delivery charge is kept apart: it is not part of the sale total, sales figures or profit.
    if (sale.getDeliveryType() == null) sale.setDeliveryType(Sale.DeliveryType.PICKUP);
    if (sale.getDeliveryType() == Sale.DeliveryType.PICKUP || sale.getDeliveryCharge() == null) sale.setDeliveryCharge(BigDecimal.ZERO);
    sale.setDeliveryCharge(Money.round(sale.getDeliveryCharge()));
    // Orders can be booked for a later day; the money is taken now, so it counts today, not on the order day.
    LocalDate today = LocalDate.now(INDIA);
    sale.setPaidOn(sale.getDate().isAfter(today) ? today : sale.getDate());
    sale.setSubtotal(subtotal);
    sale.setTotal(total);
    sale.setDiscount(subtotal.subtract(total));
    sale.setInvoiceNo(String.format("INV-%d-%04d", Year.now().getValue(), sales.nextInvoiceNumber()));
    return sales.save(sale);
  }

  @Transactional
  public void delete(UUID id) {
    sales.delete(get(id));
  }
}
