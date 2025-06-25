package com.sincon.ticketing_app.supportservice;


import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportServiceResponse {

    private Long id;
    private String title;
    private String description;
    private Long categoryId;
    private String categoryName;
}