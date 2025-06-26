package com.sincon.ticketing_app.user;

import com.sincon.ticketing_app.enums.UserRole;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
    private String id;
    private String firstName;
    private String lastName;
    private String email;
    private UserRole role;
    private String fiscalCode;
    private String phoneNumber;
    private String fullName;
}
