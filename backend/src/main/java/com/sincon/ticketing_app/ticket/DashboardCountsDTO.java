package com.sincon.ticketing_app.ticket;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardCountsDTO {
    private long totalTickets;
    private long openTickets;
    private long answeredTickets;
    private long solvedTickets;
    private long draftTickets;
}
