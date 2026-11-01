package com.smartbusiness.os.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;

@Entity
@Table(name = "customers")
public class Customer extends BaseEntity {
  @NotBlank private String name;
  private String phone = "";
  private String email = "";
  private String address = "";

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone == null ? "" : phone; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email == null ? "" : email; }
  public String getAddress() { return address; }
  public void setAddress(String address) { this.address = address == null ? "" : address; }
}
