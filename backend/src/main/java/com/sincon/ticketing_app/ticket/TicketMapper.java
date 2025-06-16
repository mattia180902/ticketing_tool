package com.sincon.ticketing_app.ticket;

import org.springframework.stereotype.Service;

@Service
public class TicketMapper {

    /* @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "creator.id", target = "createdByUserId")
    @Mapping(source = "assignedTo.id", target = "assignedToUserId")
    TicketDTO toDTO(Ticket ticket);

    @Mapping(source = "categoryId", target = "category.id")
    @Mapping(source = "createdByUserId", target = "creator.id")
    @Mapping(source = "assignedToUserId", target = "assignedTo.id")
    Ticket toEntity(TicketDTO ticketDTO); */


    public Ticket toTicket(TicketDTO dto) {
        return Ticket.builder()
            .id(dto.id())
            .title(dto.title())
            .description(dto.description())
            .priority(dto.priority())
            .status(dto.status())
            .build();
    }

    public TicketResponse toTicketResponse(Ticket ticket) {
        return TicketResponse.builder()
            .id(ticket.getId())
            .title(ticket.getTitle())
            .description(ticket.getDescription())
            .priority(ticket.getPriority())
            .status(ticket.getStatus())
            .build();
    }
}


