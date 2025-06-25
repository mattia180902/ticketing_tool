package com.sincon.ticketing_app.ticketHistory;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ticket-history")
@RequiredArgsConstructor
@Tag(name = "Ticket History")
public class TicketHistoryController {

    private final TicketHistoryService service;

    @GetMapping("/{ticketId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM')")
    public ResponseEntity<List<TicketHistoryDTO>> getHistoryByTicket(@PathVariable Long ticketId) {
        return ResponseEntity.ok(service.getHistoryByTicket(ticketId));
    }
}
