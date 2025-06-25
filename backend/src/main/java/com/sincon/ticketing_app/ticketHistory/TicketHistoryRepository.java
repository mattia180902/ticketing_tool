package com.sincon.ticketing_app.ticketHistory;

import com.sincon.ticketing_app.ticket.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketHistoryRepository extends JpaRepository<TicketHistory, Long> {

    List<TicketHistory> findByTicket(Ticket ticket);

}
