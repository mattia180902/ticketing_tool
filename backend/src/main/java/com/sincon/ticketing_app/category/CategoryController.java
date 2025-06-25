package com.sincon.ticketing_app.category;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
@Tag(name = "Category")
public class CategoryController {

    private final CategoryService service;

    @GetMapping
    public ResponseEntity<List<CategoryResponse>> getAllCategories() {
        return ResponseEntity.ok(service.getAllCategories());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CategoryResponse> getCategory(@PathVariable Long id) {
        return ResponseEntity.ok(service.getCategory(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CategoryResponse> createCategory(@RequestBody @Valid CategoryDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createCategory(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CategoryResponse> update(
        @PathVariable Long id,
        @Valid @RequestBody CategoryDTO dto
    ) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        service.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}
