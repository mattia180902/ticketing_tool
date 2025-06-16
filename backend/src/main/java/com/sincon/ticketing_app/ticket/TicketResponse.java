package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketPriority;
import com.sincon.ticketing_app.enums.TicketStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TicketResponse {

    private Long id;
    private String title;
    private String description;
    private TicketPriority priority;
    private TicketStatus status;
}
