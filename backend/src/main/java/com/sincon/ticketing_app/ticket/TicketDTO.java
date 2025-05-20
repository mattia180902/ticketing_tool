package com.sincon.ticketing_app.ticket;

import lombok.*;
import com.sincon.ticketing_app.enums.*;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketDTO {

    private Long id;
    private String title;
    private String description;
    private TicketPriority priority;
    private TicketStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long categoryId;
    private Long createdByUserId;
    private Long assignedToUserId;
}
