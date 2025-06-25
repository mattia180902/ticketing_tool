package com.sincon.ticketing_app.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import com.sincon.ticketing_app.enums.UserRole;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserSynchronizer {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    public void synchronizeWithIdp(Jwt token) {
        log.info("Synchronizing user with IDP");
        getUserEmail(token).ifPresent(userEmail -> {
            log.info("Synchronizing user having email {}", userEmail);
            Optional<User> optUser = userRepository.findByEmail(userEmail);

            if (optUser.isPresent()) {
                // Utente esistente → aggiorno solo i campi presi da Keycloak
                User existingUser = optUser.get();
                Map<String, Object> attributes = token.getClaims();

                if (attributes.containsKey("sub")) {
                    existingUser.setId(attributes.get("sub").toString());
                }
                if (attributes.containsKey("given_name")) {
                    existingUser.setFirstName(attributes.get("given_name").toString());
                } else if (attributes.containsKey("nickname")) {
                    existingUser.setFirstName(attributes.get("nickname").toString());
                }
                if (attributes.containsKey("family_name")) {
                    existingUser.setLastName(attributes.get("family_name").toString());
                }
                if (attributes.containsKey("email")) {
                    existingUser.setEmail(attributes.get("email").toString());
                }

                if (attributes.containsKey("realm_access")) {
                    Map<String, Object> realmAccess = (Map<String, Object>) attributes.get("realm_access");
                    List<String> roles = (List<String>) realmAccess.get("roles");
                    if (roles.contains("ADMIN")) {
                        existingUser.setRole(UserRole.ADMIN);
                    } else if (roles.contains("HELPER_JUNIOR")) {
                        existingUser.setRole(UserRole.HELPER_JUNIOR);
                    } else if (roles.contains("HELPER_SENIOR")) {
                        existingUser.setRole(UserRole.HELPER_SENIOR);
                    } else if (roles.contains("PM")) {
                        existingUser.setRole(UserRole.PM);
                    } else {
                        existingUser.setRole(UserRole.USER);
                    }
                } else {
                    existingUser.setRole(UserRole.USER);
                }

                userRepository.save(existingUser);

            } else {
                // Utente non trovato → lo creo nuovo con i dati da Keycloak
                User newUser = userMapper.fromTokenAttributes(token.getClaims());
                userRepository.save(newUser);
            }
        });
    }

    private Optional<String> getUserEmail(Jwt token) {
        Map<String, Object> attributes = token.getClaims();
        return Optional.ofNullable(attributes.get("email")).map(Object::toString);
    }
}

