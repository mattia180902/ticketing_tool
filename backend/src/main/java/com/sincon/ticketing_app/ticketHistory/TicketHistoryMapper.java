package com.sincon.ticketing_app.ticketHistory;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface TicketHistoryMapper {

    @Mapping(source = "ticket.id", target = "ticketId")
    @Mapping(source = "changedBy.id", target = "changedByUserId")
    TicketHistoryDTO toDTO(TicketHistory entity);

    @Mapping(source = "ticketId", target = "ticket.id")
    @Mapping(source = "changedByUserId", target = "changedBy.id")
    TicketHistory toEntity(TicketHistoryDTO dto);
}

