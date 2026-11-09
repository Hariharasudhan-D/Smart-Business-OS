package com.smartbusiness.os.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * One line of a sale. qty may be a weight (unit "kg", e.g. 1.5) or a count (unit "pcs").
 * amount, when given, is the line total the seller typed and replaces qty x price.
 */
@Embeddable
public record SaleItem(
    @NotNull @Column(name = "product_id") UUID productId,
    @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal qty,
    @Pattern(regexp = "kg|pcs") String unit,
    @NotNull @DecimalMin("0") BigDecimal price,
    @DecimalMin("0") @DecimalMax("100") BigDecimal discount,
    @DecimalMin("0") BigDecimal amount) {

  /** Fills in the defaults (pieces, no discount) so old clients keep working. */
  public SaleItem normalized() {
    return new SaleItem(productId, qty, unit == null ? "pcs" : unit, price, discount == null ? BigDecimal.ZERO : discount, amount);
  }
}
