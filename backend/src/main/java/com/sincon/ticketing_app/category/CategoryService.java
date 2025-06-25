package com.sincon.ticketing_app.category;

import com.sincon.ticketing_app.exception.*;
import lombok.RequiredArgsConstructor;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository repository;
    private final CategoryMapper mapper;

    public List<CategoryResponse> getAllCategories() {
        return repository.findAll().stream()
                .map(mapper::toResponse)
                .toList();
    }

    public CategoryResponse createCategory(CategoryDTO dto) {
        if (repository.existsByName(dto.getName())) {
            throw new BadRequestException("Category already exists with name: " + dto.getName());
        }

        Category category = mapper.fromDTO(dto);
        repository.save(category);
        return mapper.toResponse(category);
    }

    @PreAuthorize("hasRole('ADMIN')")
    public CategoryResponse update(Long id, CategoryDTO dto) {
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

    public CategoryResponse getCategory(Long id) {
        return repository.findById(id)
                .map(mapper::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
    }
}
