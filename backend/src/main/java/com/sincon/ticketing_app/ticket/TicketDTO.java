package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.*;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record TicketDTO(
        Long id,

        @NotNull(message = "100") @NotEmpty(message = "100")
        String title,

        String description,

        @NotNull(message = "100")
        TicketPriority priority,

        @NotNull(message = "100")
        TicketStatus status
) {
}