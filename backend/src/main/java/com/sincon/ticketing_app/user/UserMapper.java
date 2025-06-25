package com.sincon.ticketing_app.user;


import org.springframework.stereotype.Service;

import com.sincon.ticketing_app.enums.UserRole;

import java.util.List;
import java.util.Map;

@Service
public class UserMapper {

    public User fromTokenAttributes(Map<String, Object> attributes) {
        User user = new User();

        if (attributes.containsKey("sub")) {
            user.setId(attributes.get("sub").toString());
        }

        if (attributes.containsKey("given_name")) {
            user.setFirstName(attributes.get("given_name").toString());
        } else if (attributes.containsKey("nickname")) {
            user.setFirstName(attributes.get("nickname").toString());
        }

        if (attributes.containsKey("family_name")) {
            user.setLastName(attributes.get("family_name").toString());
        }

        if (attributes.containsKey("email")) {
            user.setEmail(attributes.get("email").toString());
        }

        // Recupero ruolo da realm_access
        if (attributes.containsKey("realm_access")) {
            Map<String, Object> realmAccess = (Map<String, Object>) attributes.get("realm_access");
            List<String> roles = (List<String>) realmAccess.get("roles");

            if (roles.contains("ADMIN")) {
                user.setRole(UserRole.ADMIN);
            } else if (roles.contains("HELPER_JUNIOR")) {
                user.setRole(UserRole.HELPER_JUNIOR);
            } else if (roles.contains("HELPER_SENIOR")) {
                user.setRole(UserRole.HELPER_SENIOR);
            } else if (roles.contains("PM")) {
                user.setRole(UserRole.PM);
            } else {
                user.setRole(UserRole.USER);
            }
        } else {
            user.setRole(UserRole.USER); // fallback di sicurezza
        }

        return user;
    }

    public UserDTO toUserDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }
}


