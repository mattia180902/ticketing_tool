package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketPriority;
import com.sincon.ticketing_app.enums.TicketStatus;
import lombok.*;

import java.util.Date;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TicketResponseDTO {

    private Long id;

    private String title;
    private String description;
    private TicketStatus status;
    private TicketPriority priority;

    private String userId;
    private String userFirstName;
    private String userLastName;
    private String userEmail;
    private String userPhoneNumber;
    private String userFiscalCode;

    private Long categoryId;
    private String categoryName;

    private Long supportServiceId;
    private String supportServiceName;

    private String assignedToId;
    private String assignedToName;

    private Date createdOn;
    private Date updatedOn;
    private Date solvedOn;
}
