package com.sincon.ticketing_app.ticket;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.factory.Mappers;

@Mapper(componentModel = "spring")
public interface TicketMapper {

    TicketMapper INSTANCE = Mappers.getMapper(TicketMapper.class);

    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(source = "creator.id", target = "createdByUserId")
    @Mapping(source = "assignedTo.id", target = "assignedToUserId")
    TicketDTO toDTO(Ticket ticket);

    @Mapping(source = "categoryId", target = "category.id")
    @Mapping(source = "createdByUserId", target = "creator.id")
    @Mapping(source = "assignedToUserId", target = "assignedTo.id")
    Ticket toEntity(TicketDTO ticketDTO);
}


