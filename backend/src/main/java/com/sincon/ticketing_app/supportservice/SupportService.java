package com.sincon.ticketing_app.supportservice;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.common.Auditable;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "support_services")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportService extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 150, unique = true)
    private String title;

    @Column(length = 500)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;
}