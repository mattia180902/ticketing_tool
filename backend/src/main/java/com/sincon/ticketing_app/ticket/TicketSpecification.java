package com.sincon.ticketing_app.ticket;

import org.springframework.data.jpa.domain.Specification;

public class TicketSpecification {
    public static Specification<Ticket> withOwnerId(String ownerId) {
        return (root, query, criteriaBuilder) -> criteriaBuilder.equal(root.get("createdBy"), ownerId);
    }
}
