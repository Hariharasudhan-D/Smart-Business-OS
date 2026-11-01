package com.smartbusiness.os.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "sales")
public class Sale extends BaseEntity {
  public enum PaymentMode {
    Cash,
    UPI,
    Card,
    @JsonProperty("Bank Transfer") BankTransfer,
    Credit
  }

  @Column(name = "invoice_no") private String invoiceNo;
  @NotNull @Column(name = "sale_date") private LocalDate date;
  @NotNull @Column(name = "customer_id") private UUID customerId;
  private BigDecimal subtotal = BigDecimal.ZERO;
  private BigDecimal discount = BigDecimal.ZERO;
  private BigDecimal total = BigDecimal.ZERO;
  @NotNull @Enumerated(EnumType.STRING) @Column(name = "payment_mode") private PaymentMode paymentMode;

  @Valid
  @NotEmpty
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "sale_items", joinColumns = @JoinColumn(name = "sale_id"))
  private List<SaleItem> items = new ArrayList<>();

  public String getInvoiceNo() { return invoiceNo; }
  public void setInvoiceNo(String invoiceNo) { this.invoiceNo = invoiceNo; }
  public LocalDate getDate() { return date; }
  public void setDate(LocalDate date) { this.date = date; }
  public UUID getCustomerId() { return customerId; }
  public void setCustomerId(UUID customerId) { this.customerId = customerId; }
  public BigDecimal getSubtotal() { return subtotal; }
  public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
  public BigDecimal getDiscount() { return discount; }
  public void setDiscount(BigDecimal discount) { this.discount = discount; }
  public BigDecimal getTotal() { return total; }
  public void setTotal(BigDecimal total) { this.total = total; }
  public PaymentMode getPaymentMode() { return paymentMode; }
  public void setPaymentMode(PaymentMode paymentMode) { this.paymentMode = paymentMode; }
  public List<SaleItem> getItems() { return items; }
  public void setItems(List<SaleItem> items) { this.items = items; }
}
