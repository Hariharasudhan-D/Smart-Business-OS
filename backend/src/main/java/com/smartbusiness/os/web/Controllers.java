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
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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
    public ProductController(ProductRepository repo, ObjectMapper mapper, Validator validator) {
      super(repo, mapper, validator, "Product");
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
    public CustomerController(CustomerRepository repo, ObjectMapper mapper, Validator validator) {
      super(repo, mapper, validator, "Customer");
    }
  }

  @RestController
  @RequestMapping("/api/purchases")
  public static class PurchaseController {
    private final PurchaseService service;

    public PurchaseController(PurchaseService service) {
      this.service = service;
    }

    @GetMapping
    public List<Purchase> list() {
      return service.list();
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
