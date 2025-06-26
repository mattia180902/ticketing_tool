package com.sincon.ticketing_app.user;

import com.sincon.ticketing_app.enums.UserRole;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User{

        @Id
        private String id; //preso da keycloak
        
        @Column(nullable = false)
        private String firstName;

        @Column(nullable = false)
        private String lastName;

        @Column(unique = true, nullable = false)
        private String email;
    
        @Enumerated(EnumType.STRING)
        @Column(nullable = false)
        private UserRole role;
    
        @Column(length = 16)
        private String fiscalCode;
    
        @Column
        private String phoneNumber;

        public String getFullName() {
                return this.firstName + " " + this.lastName;
        }
}