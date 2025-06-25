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
    
        private String firstName;
        private String lastName;
        private String email;
    
        @Enumerated(EnumType.STRING)
        private UserRole role;
    
        @Column(length = 16)
        private String fiscalCode;
    
        @Column(length = 15)
        private String phoneNumber;

        public String getFullName() {
                return this.firstName + " " + this.lastName;
        }
}