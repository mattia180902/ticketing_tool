package com.sincon.ticketing_app.user;


import org.springframework.stereotype.Service;

import com.sincon.ticketing_app.enums.UserRole;

import java.util.List;
import java.util.Map;

@Service
public class UserMapper {

    public User fromTokenAttributes(Map<String, Object> attributes) {
        User user = new User();
        user.setId((String) attributes.getOrDefault("sub", null));
        user.setFirstName((String) attributes.getOrDefault("given_name", attributes.get("nickname")));
        user.setLastName((String) attributes.getOrDefault("family_name", null));
        user.setEmail((String) attributes.getOrDefault("email", null));
        user.setRole(resolveUserRole(attributes));
        return user;
    }

    private UserRole resolveUserRole(Map<String, Object> attributes) {
        if (attributes.containsKey("realm_access")) {
            Map<String, Object> realmAccess = (Map<String, Object>) attributes.get("realm_access");
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles.contains("ADMIN")) return UserRole.ADMIN;
            if (roles.contains("HELPER_JUNIOR")) return UserRole.HELPER_JUNIOR;
            if (roles.contains("HELPER_SENIOR")) return UserRole.HELPER_SENIOR;
            if (roles.contains("PM")) return UserRole.PM;
        }
        return UserRole.USER;
    }

    public UserDTO toUserDTO(User user) {
        if (user == null) {
            return null;
        }
        return UserDTO.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .role(user.getRole())
                .phoneNumber(user.getPhoneNumber())
                .fiscalCode(user.getFiscalCode())
                .fullName(user.getFullName())
                .build();
    }
}

