package com.sincon.ticketing_app.ticketHistory;

import com.sincon.ticketing_app.enums.*;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketHistoryDTO {

    private Long id;

    private Long ticketId;

    private Long changedByUserId;

    private TicketStatus oldStatus;

    private TicketStatus newStatus;

    private String comment;
}