package com.sincon.ticketing_app.notification;

import com.sincon.ticketing_app.auditable.Auditable;
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
public class Notification extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String message;

    private Boolean isRead;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;  // destinatario della notifica

    @ManyToOne
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;  // ticket a cui si riferisce la notifica
}