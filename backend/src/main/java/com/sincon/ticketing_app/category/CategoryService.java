package com.sincon.ticketing_app.category;

import com.sincon.ticketing_app.exception.*;
import lombok.RequiredArgsConstructor;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository repository;
    private final CategoryMapper mapper;

    // Metodo per trovare una categoria per ID
    public Optional<Category> findById(Long id) {
        return repository.findById(id);
    }

    public List<CategoryResponse> getAllCategories() {
        return repository.findAll().stream()
                .map(category -> {
                    category.setTicketCount(repository.countTickets(category.getId()));
                    return mapper.toResponse(category);
                })
                .toList();
    }

    public CategoryResponse createCategory(CategoryRequest dto) {
        if (repository.existsByName(dto.getName())) {
            throw new BadRequestException("Category already exists with name: " + dto.getName());
        }
        Category saved = repository.save(mapper.fromDTO(dto));
        saved.setTicketCount(0L); // Nuovo ticket, conteggio iniziale 0
        return mapper.toResponse(saved);
    }

    @PreAuthorize("hasRole('ADMIN')")
    public CategoryResponse update(Long id, CategoryRequest dto) {
        Category existing = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));

        existing.setName(dto.getName());
        existing.setDescription(dto.getDescription());
        Category saved = repository.save(existing);
        saved.setTicketCount(repository.countTickets(id));
        return mapper.toResponse(saved);
    }

    public void deleteCategory(Long id) {
        repository.deleteById(id);
    }

    // Questo metodo ora è un wrapper per findById, ma restituisce la ResponseDTO e gestisce l'eccezione
    public CategoryResponse getCategory(Long id) {
        Category category = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
        category.setTicketCount(repository.countTickets(id));
        return mapper.toResponse(category);
    }
}
