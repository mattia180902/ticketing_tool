package com.sincon.ticketing_app.category;


import java.util.ArrayList;
import java.util.List;

import com.sincon.ticketing_app.common.Auditable;
import com.sincon.ticketing_app.supportservice.SupportService;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "categories")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Category extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String name;

    @Column(length = 500)
    private String description;

    @OneToMany(mappedBy = "category", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<SupportService> services = new ArrayList<>();

    @Transient
    private Long ticketCount;
}