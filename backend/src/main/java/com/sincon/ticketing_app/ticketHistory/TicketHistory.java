package com.sincon.ticketing_app.ticketHistory;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

import com.sincon.ticketing_app.common.Auditable;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.ticket.Ticket;
import com.sincon.ticketing_app.user.User;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TicketHistory extends Auditable{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Ticket di riferimento
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    // Stato precedente
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus previousStatus;

    // Nuovo stato
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus newStatus;

    // Utente che ha eseguito il cambio
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by", nullable = false)
    private User changedBy;

    @ManyToOne
    private User fromAssignee;

    @ManyToOne
    private User toAssignee;

    private LocalDateTime changedAt;

    // Eventuale commento opzionale
    @Column(length = 500)
    private String note;
}