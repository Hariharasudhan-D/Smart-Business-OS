package com.smartbusiness.os.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import org.hibernate.annotations.BatchSize;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "purchases")
public class Purchase extends BaseEntity {
  @NotNull @Column(name = "purchase_date") private LocalDate date;
  @NotBlank @Size(max = 200) private String supplier;
  @NotBlank @Size(max = 80) @Column(name = "invoice_no") private String invoiceNo;
  @NotNull @DecimalMin("0") @DecimalMax("100") @Column(name = "tax_rate") private BigDecimal taxRate = BigDecimal.ZERO;
  private BigDecimal subtotal = BigDecimal.ZERO;
  private BigDecimal tax = BigDecimal.ZERO;
  private BigDecimal total = BigDecimal.ZERO;

  @Valid
  @NotEmpty
  // Items of up to 100 rows load in one extra query (not one query per row), also for paged lists.
  @ElementCollection(fetch = FetchType.EAGER)
  @BatchSize(size = 100)
  @CollectionTable(name = "purchase_items", joinColumns = @JoinColumn(name = "purchase_id"))
  private List<PurchaseItem> items = new ArrayList<>();

  public LocalDate getDate() { return date; }
  public void setDate(LocalDate date) { this.date = date; }
  public String getSupplier() { return supplier; }
  public void setSupplier(String supplier) { this.supplier = supplier; }
  public String getInvoiceNo() { return invoiceNo; }
  public void setInvoiceNo(String invoiceNo) { this.invoiceNo = invoiceNo; }
  public BigDecimal getTaxRate() { return taxRate; }
  public void setTaxRate(BigDecimal taxRate) { this.taxRate = taxRate; }
  public BigDecimal getSubtotal() { return subtotal; }
  public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
  public BigDecimal getTax() { return tax; }
  public void setTax(BigDecimal tax) { this.tax = tax; }
  public BigDecimal getTotal() { return total; }
  public void setTotal(BigDecimal total) { this.total = total; }
  public List<PurchaseItem> getItems() { return items; }
  public void setItems(List<PurchaseItem> items) { this.items = items; }
}
