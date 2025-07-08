package com.sincon.ticketing_app.category;

import org.springframework.stereotype.Service;

import com.sincon.ticketing_app.supportservice.SupportService;
import com.sincon.ticketing_app.supportservice.SupportServiceMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CategoryMapper {

    private final SupportServiceMapper supportServiceMapper;

    public CategoryResponse toResponse(Category category) {
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .services(category.getServices().stream()
                        .map(supportServiceMapper::toResponse)
                        .toList())
                .ticketCount(category.getTicketCount())
                .build();
    }

    public Category fromDTO(CategoryRequest dto) {
        return Category.builder()
                .id(dto.getId())
                .name(dto.getName())
                .description(dto.getDescription())
                .build();
    }

    public CategoryRequest toDTO(Category category) {
        return CategoryRequest.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .serviceIds(category.getServices().stream()
                        .map(SupportService::getId)
                        .toList())
                .build();
    }
}
