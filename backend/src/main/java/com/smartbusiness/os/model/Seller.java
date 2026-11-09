package com.smartbusiness.os.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "sellers")
public class Seller extends BaseEntity {
  // Limits match the database columns, so overlong input is a clear 400, not a server error.
  @NotBlank @Size(max = 200) private String name;
  @Size(max = 40) private String phone = "";
  @Email @Size(max = 200) private String email = "";
  @Size(max = 500) private String address = "";
  @Size(max = 30) private String gstin = "";

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone == null ? "" : phone; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email == null ? "" : email; }
  public String getAddress() { return address; }
  public void setAddress(String address) { this.address = address == null ? "" : address; }
  public String getGstin() { return gstin; }
  public void setGstin(String gstin) { this.gstin = gstin == null ? "" : gstin; }
}
