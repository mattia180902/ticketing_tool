package com.sincon.ticketing_app.ticketHistory;

import com.sincon.ticketing_app.enums.TicketStatus;
import lombok.*;

import java.util.Date;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TicketHistoryDTO {

    private Long id;
    private Long ticketId;
    private String changedById;
    private String changedByName;
    private TicketStatus previousStatus;
    private TicketStatus newStatus;
    private String note;
    private Date createdOn;
}
