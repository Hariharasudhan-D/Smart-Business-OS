package com.smartbusiness.os.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbusiness.os.model.BaseEntity;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.server.ResponseStatusException;

/** list / get / create / partial update / delete for a simple entity; subclasses only set the base path. */
public abstract class CrudController<T extends BaseEntity> {
  private final JpaRepository<T, UUID> repo;
  private final ObjectMapper mapper;
  private final Validator validator;
  private final String label;

  protected CrudController(JpaRepository<T, UUID> repo, ObjectMapper mapper, Validator validator, String label) {
    this.repo = repo;
    this.mapper = mapper;
    this.validator = validator;
    this.label = label;
  }

  @GetMapping
  public List<T> list() {
    return repo.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
  }

  @GetMapping("/{id}")
  public T get(@PathVariable UUID id) {
    return find(id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public T create(@Valid @RequestBody T body) {
    return repo.save(body);
  }

  @PatchMapping("/{id}")
  public T update(@PathVariable UUID id, @RequestBody JsonNode patch) throws IOException {
    T entity = find(id);
    mapper.readerForUpdating(entity).readValue(patch);
    var violations = validator.validate(entity);
    if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
    return repo.save(entity);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    find(id);
    repo.deleteById(id);
  }

  private T find(UUID id) {
    return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, label + " not found"));
  }
}
