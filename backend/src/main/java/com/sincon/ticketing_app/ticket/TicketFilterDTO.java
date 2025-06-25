package com.sincon.ticketing_app.ticket;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;

import com.sincon.ticketing_app.enums.TicketPriority;
import com.sincon.ticketing_app.enums.TicketStatus; 

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TicketFilterDTO {
    private String title;
    private String description; // Utile per ricerca full-text
    private TicketStatus status;
    private TicketPriority priority;
    private Long categoryId;
    private Long supportServiceId;
    private String ownerId; // ID dell'utente proprietario
    private String assignedToId; // ID dell'helper assegnato

    // Campi per filtri basati su intervallo di date
    private LocalDate createdOnFrom;
    private LocalDate createdOnTo;
    private LocalDate updatedOnFrom;
    private LocalDate updatedOnTo;
    private LocalDate solvedOnFrom;
    private LocalDate solvedOnTo;
}