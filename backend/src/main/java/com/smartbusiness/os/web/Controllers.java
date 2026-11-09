package com.smartbusiness.os.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbusiness.os.model.Customer;
import com.smartbusiness.os.model.Product;
import com.smartbusiness.os.model.Purchase;
import com.smartbusiness.os.model.Sale;
import com.smartbusiness.os.model.Seller;
import com.smartbusiness.os.repo.Repositories.CustomerRepository;
import com.smartbusiness.os.repo.Repositories.ProductRepository;
import com.smartbusiness.os.repo.Repositories.SellerRepository;
import com.smartbusiness.os.service.PurchaseService;
import com.smartbusiness.os.service.SaleService;
import com.smartbusiness.os.service.WebsiteSyncService;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

public final class Controllers {
  private Controllers() {}

  @RestController
  @RequestMapping("/api/products")
  public static class ProductController extends CrudController<Product> {
    private final WebsiteSyncService sync;

    public ProductController(ProductRepository repo, ObjectMapper mapper, Validator validator, WebsiteSyncService sync) {
      super(repo, mapper, validator, "Product");
      this.sync = sync;
    }

    /** The website's cakes are always part of the product list (same as in the phone app). */
    @Override
    @GetMapping
    public List<Product> list() {
      sync.syncCakes();
      return super.list();
    }
  }

  @RestController
  @RequestMapping("/api/sellers")
  public static class SellerController extends CrudController<Seller> {
    public SellerController(SellerRepository repo, ObjectMapper mapper, Validator validator) {
      super(repo, mapper, validator, "Seller");
    }
  }

  @RestController
  @RequestMapping("/api/customers")
  public static class CustomerController extends CrudController<Customer> {
    private final WebsiteSyncService sync;

    public CustomerController(CustomerRepository repo, ObjectMapper mapper, Validator validator, WebsiteSyncService sync) {
      super(repo, mapper, validator, "Customer");
      this.sync = sync;
    }

    /** Website buyers are always part of the customer list (same as in the phone app). */
    @Override
    @GetMapping
    public List<Customer> list() {
      sync.syncCustomers();
      return super.list();
    }
  }

  @RestController
  @RequestMapping("/api/purchases")
  public static class PurchaseController {
    private final PurchaseService service;

    public PurchaseController(PurchaseService service) {
      this.service = service;
    }

    /**
     * Without parameters: every purchase (as before). With page: one page, as {items, total, page, size, hasMore}.
     * from / to / q filter by purchase day and supplier or bill number; without page they return the filtered list.
     */
    @GetMapping
    public Object list(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to) {
      if (page == null && size == null && q == null && from == null && to == null) return service.list();
      if (page != null && page < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be 0 or more");
      int pageSize = PageResult.clampSize(size, 30);
      var result = service.search(from, to, q, page, pageSize);
      if (page == null) return result.getContent();
      return PageResult.of(result.getContent(), result.getTotalElements(), page, pageSize);
    }

    @GetMapping("/{id}")
    public Purchase get(@PathVariable UUID id) {
      return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Purchase create(@Valid @RequestBody Purchase body) {
      return service.create(body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
      service.delete(id);
    }
  }

  @RestController
  @RequestMapping("/api/sales")
  public static class SaleController {
    private final SaleService service;

    public SaleController(SaleService service) {
      this.service = service;
    }

    @GetMapping
    public List<Sale> list() {
      return service.list();
    }

    @GetMapping("/{id}")
    public Sale get(@PathVariable UUID id) {
      return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Sale create(@Valid @RequestBody Sale body) {
      return service.create(body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
      service.delete(id);
    }
  }
}
