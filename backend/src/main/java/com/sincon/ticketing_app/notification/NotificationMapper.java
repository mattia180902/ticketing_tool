package com.sincon.ticketing_app.notification;

import org.mapstruct.*;

@Mapper(componentModel = "spring")
public interface NotificationMapper {

    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "ticket.id", target = "ticketId")
    NotificationDTO toDTO(Notification entity);

    @Mapping(source = "userId", target = "user.id")
    @Mapping(source = "ticketId", target = "ticket.id")
    Notification toEntity(NotificationDTO dto);
}