package com.sincon.ticketing_app.category;

import java.util.List;

import com.sincon.ticketing_app.supportservice.SupportServiceResponse;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategoryResponse {

    private Long id;
    private String name;
    private String description;
    private List<SupportServiceResponse> services;
    private Long ticketCount;
}