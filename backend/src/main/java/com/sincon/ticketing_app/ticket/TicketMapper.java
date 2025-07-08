package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.supportservice.SupportService;
import com.sincon.ticketing_app.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TicketMapper {

    // Mappa dal DTO di richiesta all'entità Ticket 
    public Ticket fromRequestDTO(TicketRequestDTO dto, User owner, Category category, SupportService service, User assignedTo) {
        return Ticket.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .priority(dto.getPriority())
                .status(dto.getStatus() != null ? dto.getStatus() : TicketStatus.OPEN)
                .owner(owner) 
                .category(category)
                .service(service)
                .assignedTo(assignedTo)
                .email(dto.getEmail()) // Mappa email dal DTO di richiesta
                .phoneNumber(dto.getPhoneNumber()) // Mappa phoneNumber dal DTO di richiesta
                .fiscalCode(dto.getFiscalCode()) // Mappa fiscalCode dal DTO di richiesta
                .build();
    }

    // Mappa dall'entità Ticket al DTO di risposta
    public TicketResponseDTO toResponseDTO(Ticket ticket) {
        return TicketResponseDTO.builder()
                .id(ticket.getId())
                .title(ticket.getTitle())
                .description(ticket.getDescription())
                .status(ticket.getStatus())
                .priority(ticket.getPriority())
                .userId(ticket.getOwner().getId()) // ID dell'utente che HA CREATO il ticket (Owner)
                .userFirstName(ticket.getOwner().getFirstName()) // Nome dell'utente che HA CREATO il ticket
                .userLastName(ticket.getOwner().getLastName()) // Cognome dell'utente che HA CREATO il ticket
                .userEmail(ticket.getEmail()) // EMAIL del ticket (che può essere dell'owner O dell'utente a cui è associato)
                .userPhoneNumber(ticket.getPhoneNumber()) // NUMERO DI TELEFONO del ticket
                .userFiscalCode(ticket.getFiscalCode()) // CODICE FISCALE del ticket
                .categoryId(ticket.getCategory() != null ? ticket.getCategory().getId() : null)
                .categoryName(ticket.getCategory() != null ? ticket.getCategory().getName() : null)
                .supportServiceId(ticket.getService() != null ? ticket.getService().getId() : null)
                .supportServiceName(ticket.getService() != null ? ticket.getService().getTitle() : null)
                .assignedToId(ticket.getAssignedTo() != null ? ticket.getAssignedTo().getId() : null)
                .assignedToName(ticket.getAssignedTo() != null
                        ? ticket.getAssignedTo().getFirstName() + " " + ticket.getAssignedTo().getLastName()
                        : null)
                .createdOn(ticket.getCreatedDate())
                .updatedOn(ticket.getLastModifiedDate())
                .solvedOn(ticket.getSolveDate())
                .build();
    }
}
