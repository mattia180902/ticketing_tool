package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.auditable.Auditable;
import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.enums.*;
import com.sincon.ticketing_app.user.User;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Ticket extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String description;

    @Enumerated(EnumType.STRING)
    private TicketPriority priority;

    @Enumerated(EnumType.STRING)
    private TicketStatus status;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    @ManyToOne
    @JoinColumn(name = "created_by_user_id")
    private User creator;  // rinominato per evitare conflitto

    @ManyToOne(optional = true)
    @JoinColumn(name = "assigned_to_user_id")
    private User assignedTo;
}

