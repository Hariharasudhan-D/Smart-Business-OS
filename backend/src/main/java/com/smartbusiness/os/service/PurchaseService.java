package com.smartbusiness.os.service;

import com.smartbusiness.os.model.Purchase;
import com.smartbusiness.os.model.PurchaseItem;
import com.smartbusiness.os.repo.Repositories.ProductRepository;
import com.smartbusiness.os.repo.Repositories.PurchaseRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PurchaseService {
  private final PurchaseRepository purchases;
  private final ProductRepository products;

  /**
   * Purchases newest first, filtered by day range and supplier / bill-number search, one page at a time
   * (page null = all matching rows). Only the requested rows and their items are read (2–3 queries).
   */
  @Transactional(readOnly = true)
  public org.springframework.data.domain.Page<Purchase> search(java.time.LocalDate from, java.time.LocalDate to, String q, Integer page, int size) {
    String search = q == null ? "" : q.trim().toLowerCase();
    String like = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    Sort newestFirst = Sort.by(Sort.Direction.DESC, "date").and(Sort.by(Sort.Direction.DESC, "createdAt"));
    org.springframework.data.domain.Pageable pageable =
        page == null ? org.springframework.data.domain.Pageable.unpaged(newestFirst) : org.springframework.data.domain.PageRequest.of(page, size, newestFirst);
    return purchases.search(
        from == null ? java.time.LocalDate.of(1900, 1, 1) : from,
        to == null ? java.time.LocalDate.of(9999, 12, 31) : to,
        like, pageable);
  }

  public PurchaseService(PurchaseRepository purchases, ProductRepository products) {
    this.purchases = purchases;
    this.products = products;
  }

  @Transactional(readOnly = true)
  public java.util.List<Purchase> list() {
    return purchases.findAll(Sort.by(Sort.Direction.DESC, "date").and(Sort.by(Sort.Direction.DESC, "createdAt")));
  }

  @Transactional(readOnly = true)
  public Purchase get(UUID id) {
    return purchases.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase not found"));
  }

  /** Saves the purchase with server-side totals. */
  @Transactional
  public Purchase create(Purchase purchase) {
    BigDecimal subtotal = BigDecimal.ZERO;
    for (PurchaseItem item : purchase.getItems()) {
      subtotal = subtotal.add(Money.times(item.qty(), item.unitCost()));
    }
    BigDecimal tax = Money.percentOf(subtotal, purchase.getTaxRate());
    purchase.setSubtotal(subtotal);
    purchase.setTax(tax);
    purchase.setTotal(subtotal.add(tax));
    purchase.setSupplier(purchase.getSupplier().trim());
    purchase.setInvoiceNo(purchase.getInvoiceNo().trim());

    // All products checked in one query (was one query per item).
    java.util.Set<java.util.UUID> productIds = new java.util.HashSet<>();
    purchase.getItems().forEach(i -> productIds.add(i.productId()));
    if (productIds.contains(null) || products.countByIdIn(productIds) != productIds.size()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown product in purchase");
    }
    return purchases.save(purchase);
  }

  @Transactional
  public void delete(UUID id) {
    purchases.delete(get(id));
  }
}
