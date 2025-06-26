package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketPriority;
import com.sincon.ticketing_app.enums.TicketStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TicketRequestDTO {

    @NotBlank(message = "Il titolo del ticket è obbligatorio.")
    private String title;

    private String description;

    private TicketPriority priority;

    // Questi campi sono popolati dal backend per l'utente loggato se il ruolo è USER.
    // Possono essere null se non sono richiesti per una bozza.
    private String email;
    private String phoneNumber;
    private String fiscalCode;

    private Long categoryId;
    private Long supportServiceId;
    private String assignedToId;

    private TicketStatus status;
}
