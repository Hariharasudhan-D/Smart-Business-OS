package com.smartbusiness.os.service;

import com.smartbusiness.os.model.Sale;
import com.smartbusiness.os.model.SaleItem;
import com.smartbusiness.os.repo.Repositories.CustomerRepository;
import com.smartbusiness.os.repo.Repositories.ProductRepository;
import com.smartbusiness.os.repo.Repositories.SaleRepository;
import java.math.BigDecimal;
import java.time.Year;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SaleService {
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
    BigDecimal subtotal = BigDecimal.ZERO;
    BigDecimal total = BigDecimal.ZERO;
    for (SaleItem item : sale.getItems()) {
      if (!products.existsById(item.productId())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown product in sale: " + item.productId());
      }
      subtotal = subtotal.add(Money.times(item.qty(), item.price()));
      total = total.add(Money.afterDiscount(item.qty(), item.price(), item.discount()));
    }
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
