package com.sincon.ticketing_app.supportservice;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/services")
@RequiredArgsConstructor
@Tag(name = "Support Services")
public class SupportServiceController {

    private final SupportServiceService service;

    @GetMapping
    public ResponseEntity<List<SupportServiceResponse>> getAll() {
        return ResponseEntity.ok(service.getAllServices());
    }

    @GetMapping("/category/{categoryId}")
    public ResponseEntity<List<SupportServiceResponse>> getByCategory(@PathVariable Long categoryId) {
        return ResponseEntity.ok(service.getServicesByCategory(categoryId));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupportServiceResponse> create(@RequestBody @Valid SupportServiceCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupportServiceResponse> update(@PathVariable Long id,
                     @RequestBody @Valid SupportServiceUpdateRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
