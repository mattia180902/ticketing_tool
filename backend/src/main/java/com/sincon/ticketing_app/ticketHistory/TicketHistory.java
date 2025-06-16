package com.sincon.ticketing_app.ticketHistory;

import com.sincon.ticketing_app.common.Auditable;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.ticket.Ticket;
import com.sincon.ticketing_app.user.User;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketHistory extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    @ManyToOne
    @JoinColumn(name = "changed_by_user_id")
    private User changedBy;

    @Enumerated(EnumType.STRING)
    private TicketStatus oldStatus;

    @Enumerated(EnumType.STRING)
    private TicketStatus newStatus;

    private String comment;
}