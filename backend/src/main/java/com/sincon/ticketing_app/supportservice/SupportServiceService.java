package com.sincon.ticketing_app.supportservice;

import com.sincon.ticketing_app.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SupportServiceService {

    private final SupportServiceRepository repository;
    private final SupportServiceMapper mapper;

    public List<SupportServiceResponse> getAllServices() {
        return repository.findAll().stream()
                .map(mapper::toResponse)
                .toList();
    }

    public List<SupportServiceResponse> getServicesByCategory(Long categoryId) {
        return repository.findAllByCategoryId(categoryId).stream()
                .map(mapper::toResponse)
                .toList();
    }

    public SupportServiceResponse create(SupportServiceCreateRequest request) {
        SupportService service = mapper.toEntity(request);
        return mapper.toResponse(repository.save(service));
    }

    public SupportServiceResponse update(Long id, SupportServiceUpdateRequest request) {
        SupportService service = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Service not found"));

        mapper.updateEntity(service, request);
        return mapper.toResponse(repository.save(service));
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }
}
