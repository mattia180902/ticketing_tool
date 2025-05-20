package com.sincon.ticketing_app.notification;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDTO {

    private Long id;
    private String message;
    private Boolean isRead;
    private Long userId;
    private Long ticketId;
}