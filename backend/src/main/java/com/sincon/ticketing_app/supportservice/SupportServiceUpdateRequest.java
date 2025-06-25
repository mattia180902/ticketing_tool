package com.sincon.ticketing_app.supportservice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportServiceUpdateRequest {
    
    @NotBlank(message = "Service ma,e is required")
    @Size(min = 2, max = 100, message = "Service name must be between 2 and 100 characters")
    private String title;

    @Size(max = 500, message = "Description cannot exceed 500 characters")
    private String description;
}