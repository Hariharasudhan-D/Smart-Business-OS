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

    for (PurchaseItem item : purchase.getItems()) {
      if (!products.existsById(item.productId())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown product in purchase: " + item.productId());
      }
    }
    return purchases.save(purchase);
  }

  @Transactional
  public void delete(UUID id) {
    purchases.delete(get(id));
  }
}
