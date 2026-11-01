package com.smartbusiness.os.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

@Embeddable
public record SaleItem(
    @NotNull @Column(name = "product_id") UUID productId,
    @Min(1) int qty,
    @NotNull @DecimalMin("0") BigDecimal price,
    @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal discount) {}
