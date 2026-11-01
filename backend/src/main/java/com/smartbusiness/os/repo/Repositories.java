package com.smartbusiness.os.repo;

import com.smartbusiness.os.model.Customer;
import com.smartbusiness.os.model.Product;
import com.smartbusiness.os.model.Purchase;
import com.smartbusiness.os.model.Sale;
import com.smartbusiness.os.model.Seller;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public final class Repositories {
  private Repositories() {}

  public interface ProductRepository extends JpaRepository<Product, UUID> {}

  public interface SellerRepository extends JpaRepository<Seller, UUID> {}

  public interface CustomerRepository extends JpaRepository<Customer, UUID> {}

  public interface PurchaseRepository extends JpaRepository<Purchase, UUID> {}

  public interface SaleRepository extends JpaRepository<Sale, UUID> {
    @Query(value = "select nextval('invoice_seq')", nativeQuery = true)
    long nextInvoiceNumber();
  }
}
