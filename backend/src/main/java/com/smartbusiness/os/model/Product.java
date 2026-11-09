package com.smartbusiness.os.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
public class Product extends BaseEntity {
  public enum Unit { pcs, kg, ltr, pack, box }

  public enum Kind { selling, purchase, both }

  @NotBlank @Size(max = 200) private String name;
  @NotNull @DecimalMin("0") @Column(name = "cost_price") private BigDecimal costPrice;
  @NotNull @DecimalMin("0") @Column(name = "selling_price") private BigDecimal sellingPrice;
  @Min(0) private int qty;
  @Min(0) @Column(name = "reorder_level") private int reorderLevel = 10;
  @NotNull @Enumerated(EnumType.STRING) private Unit unit;
  @NotNull @Enumerated(EnumType.STRING) private Kind kind;
  /** A web link or a small photo from the phone app (data:image/...;base64). Capped so one picture stays small. */
  @Size(max = 400_000, message = "The picture is too big. Choose a smaller one.")
  // Only a web link or a small JPEG/PNG/WebP photo: no javascript:, SVG or other active content.
  @jakarta.validation.constraints.Pattern(
      regexp = "^$|^https?://[^\\s\"'<>]+$|^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$",
      message = "must be a web link (https://...) or a JPEG, PNG or WebP photo")
  @Column(columnDefinition = "text") private String image = "";

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public BigDecimal getCostPrice() { return costPrice; }
  public void setCostPrice(BigDecimal costPrice) { this.costPrice = costPrice; }
  public BigDecimal getSellingPrice() { return sellingPrice; }
  public void setSellingPrice(BigDecimal sellingPrice) { this.sellingPrice = sellingPrice; }
  public int getQty() { return qty; }
  public void setQty(int qty) { this.qty = qty; }
  public int getReorderLevel() { return reorderLevel; }
  public void setReorderLevel(int reorderLevel) { this.reorderLevel = reorderLevel; }
  public Unit getUnit() { return unit; }
  public void setUnit(Unit unit) { this.unit = unit; }
  public Kind getKind() { return kind; }
  public void setKind(Kind kind) { this.kind = kind; }
  public String getImage() { return image; }
  public void setImage(String image) { this.image = image == null ? "" : image; }
}
