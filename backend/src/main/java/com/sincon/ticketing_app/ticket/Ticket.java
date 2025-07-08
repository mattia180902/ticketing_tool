package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.common.Auditable;
import com.sincon.ticketing_app.enums.TicketPriority;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.supportservice.SupportService;
import com.sincon.ticketing_app.ticketHistory.TicketHistory;
import com.sincon.ticketing_app.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@ToString
@Table(name = "tickets")
public class Ticket extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    private TicketPriority priority;

    @Enumerated(EnumType.STRING)
    private TicketStatus status;

    @Temporal(TemporalType.TIMESTAMP)
    private Date solveDate;

    @Temporal(TemporalType.TIMESTAMP)
    private Date assignedDate;

    // Contatti utente richiesti al momento della creazione del ticket
    private String email;
    private String phoneNumber;
    private String fiscalCode;

    // Categoria selezionata per il ticket
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    // Servizio specifico associato
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private SupportService service;

    // Utente che ha creato il ticket
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    // Helper a cui è assegnato il ticket (può essere null finché non assegnato)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private User assignedTo;

    @OneToMany(mappedBy = "ticket", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TicketHistory> history = new ArrayList<>();
}
