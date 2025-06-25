package com.sincon.ticketing_app.ticketHistory;

import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.ticket.Ticket;
import com.sincon.ticketing_app.ticket.TicketRepository;
import com.sincon.ticketing_app.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketHistoryService {

    private final TicketHistoryRepository historyRepository;
    private final TicketHistoryMapper mapper;
    private final TicketRepository ticketRepository;

    public void recordHistory(Ticket ticket, TicketStatus previousStatus, TicketStatus newStatus, User changedBy, String note) {
        TicketHistory history = TicketHistory.builder()
                .ticket(ticket)
                .previousStatus(previousStatus)
                .newStatus(newStatus)
                .changedBy(changedBy)
                .note(note)
                .build();

        historyRepository.save(history);
    }

    public List<TicketHistoryDTO> getHistoryByTicket(Long ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Ticket not found"));

        return historyRepository.findByTicket(ticket)
                .stream()
                .map(mapper::toDTO)
                .toList();
    }
}
