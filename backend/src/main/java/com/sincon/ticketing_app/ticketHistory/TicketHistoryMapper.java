package com.sincon.ticketing_app.ticketHistory;

import org.springframework.stereotype.Service;

@Service
public class TicketHistoryMapper {

    public TicketHistoryDTO toDTO(TicketHistory history) {
        return TicketHistoryDTO.builder()
                .id(history.getId())
                .ticketId(history.getTicket().getId())
                .changedById(history.getChangedBy().getId())
                .changedByName(history.getChangedBy().getFirstName() + " " + history.getChangedBy().getLastName())
                .previousStatus(history.getPreviousStatus())
                .newStatus(history.getNewStatus())
                .note(history.getNote())
                .createdOn(history.getCreatedDate())
                .build();
    }
}
