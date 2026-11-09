package com.smartbusiness.os.repo;

import com.smartbusiness.os.model.Customer;
import com.smartbusiness.os.model.Product;
import com.smartbusiness.os.model.Purchase;
import com.smartbusiness.os.model.Sale;
import com.smartbusiness.os.model.Seller;
import java.util.UUID;
import java.time.LocalDate;
import java.util.Collection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public final class Repositories {
  private Repositories() {}

  public interface ProductRepository extends JpaRepository<Product, UUID> {
    /** How many of these ids exist: checks all products of a sale or purchase in one query. */
    long countByIdIn(Collection<UUID> ids);
  }

  public interface SellerRepository extends JpaRepository<Seller, UUID> {}

  public interface CustomerRepository extends JpaRepository<Customer, UUID> {}

  public interface PurchaseRepository extends JpaRepository<Purchase, UUID> {
    /** Purchases between two days whose supplier or bill number contains q (q is a LIKE pattern, '%' for all). */
    @Query("select p from Purchase p where p.date between :from and :to and (lower(p.supplier) like :q or lower(p.invoiceNo) like :q)")
    Page<Purchase> search(@Param("from") LocalDate from, @Param("to") LocalDate to, @Param("q") String q, Pageable pageable);
  }

  public interface SaleRepository extends JpaRepository<Sale, UUID> {
    @Query(value = "select nextval('os.invoice_seq')", nativeQuery = true)
    long nextInvoiceNumber();
  }
}
