package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketPriority;
import com.sincon.ticketing_app.enums.TicketStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TicketRequestDTO {

    @NotBlank(message = "Il titolo del ticket è obbligatorio.")
    private String title;

    @NotBlank(message = "La descrizione del ticket è obbligatoria.")
    private String description;

    @NotNull(message = "La priorità del ticket è obbligatoria.")
    private TicketPriority priority;

    private String email;

    @NotNull(message = "Il numero di telefono è obbligatorio.")
    private String phoneNumber;

    @NotNull(message = "Il codide fiscale è obbligatorio.")
    private String fiscalCode;

    @NotNull(message = "È obbligatorio selezionare una categoria.")
    private Long categoryId;

    @NotNull(message = "È obbligatorio selezionare un servizio di supporto.")
    private Long supportServiceId;

    // opzionale se USER, obbligatorio solo in certe condizioni (validazione a livello di service/controller)
    private String assignedToId;

    // opzionale, di default verrà impostato a OPEN o DRAFT se non fornito
    private TicketStatus status;
}
