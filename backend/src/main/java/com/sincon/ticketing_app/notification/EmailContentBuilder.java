package com.sincon.ticketing_app.notification;

import com.sincon.ticketing_app.ticket.Ticket;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EmailContentBuilder {

    public String buildTicketCreationEmail(Ticket ticket) {
        return """
                New Ticket Assigned
                Ticket ID: %d
                Title: %s
                Description: %s
                Status: %s
                Assigned To: %s

                Please log in to the Ticketing Tool System to manage this ticket.
                """.formatted(
                ticket.getId(),
                ticket.getTitle(),
                ticket.getDescription(),
                ticket.getStatus(),
                ticket.getAssignedTo().getFullName()
        );
    }

    public String buildStatusUpdateEmail(Ticket ticket) {
        return """
                Ticket Updated
                Ticket ID: %d
                Title: %s
                Status: %s

                Please log in to the Ticketing Tool System to view details.
                """.formatted(
                ticket.getId(),
                ticket.getTitle(),
                ticket.getStatus()
        );
    }
}
