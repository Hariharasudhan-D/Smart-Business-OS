package com.smartbusiness.os.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

final class Money {
  private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

  private Money() {}

  static BigDecimal round(BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP);
  }

  static BigDecimal times(int qty, BigDecimal price) {
    return round(price.multiply(BigDecimal.valueOf(qty)));
  }

  static BigDecimal times(BigDecimal qty, BigDecimal price) {
    return round(price.multiply(qty));
  }

  static BigDecimal afterDiscount(BigDecimal qty, BigDecimal price, BigDecimal discountPercent) {
    return round(price.multiply(qty).multiply(HUNDRED.subtract(discountPercent)).divide(HUNDRED, 6, RoundingMode.HALF_UP));
  }

  static BigDecimal percentOf(BigDecimal amount, BigDecimal percent) {
    return round(amount.multiply(percent).divide(HUNDRED, 6, RoundingMode.HALF_UP));
  }
}
