package com.sincon.ticketing_app.supportservice;

import lombok.*;
import org.springframework.stereotype.Component;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.category.CategoryRepository;
import com.sincon.ticketing_app.exception.ResourceNotFoundException;


@Component
@RequiredArgsConstructor
public class SupportServiceMapper {

    private final CategoryRepository categoryRepository;

    public SupportService toEntity(SupportServiceCreateRequest dto) {
        Category category = categoryRepository.findById(dto.getCategoryId())
            .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
        return SupportService.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .category(category)
                .build();
    }

    public void updateEntity(SupportService service, SupportServiceUpdateRequest dto) {
        service.setTitle(dto.getTitle());
        service.setDescription(dto.getDescription());
    }

    public SupportServiceResponse toResponse(SupportService service) {
        return SupportServiceResponse.builder()
                .id(service.getId())
                .title(service.getTitle())
                .description(service.getDescription())
                .categoryName(service.getCategory().getName())
                .build();
    }
}
