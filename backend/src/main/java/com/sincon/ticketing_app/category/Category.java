package com.sincon.ticketing_app.category;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.sincon.ticketing_app.ticket.Ticket;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "categories")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 100)
    private String name;
    
    @Column(length = 500)
    private String description;

    // Relazione bidirezionale con Ticket
    @OneToMany(mappedBy = "category", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore // evita ricorsione infinita se restituito via API
    private List<Ticket> tickets = new ArrayList<>();

    // Metodo di utilità per aggiungere un ticket alla categoria
    public void addTicket(Ticket ticket) {
        tickets.add(ticket);
        ticket.setCategory(this);
    }

    // Metodo di utilità per rimuovere un ticket dalla categoria
    public void removeTicket(Ticket ticket) {
        tickets.remove(ticket);
        ticket.setCategory(null);
    }
}