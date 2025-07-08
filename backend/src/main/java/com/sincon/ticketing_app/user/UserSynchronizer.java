package com.sincon.ticketing_app.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

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
            Map<String, Object> attributes = token.getClaims();

            User mappedUser = userMapper.fromTokenAttributes(attributes);

            User userToPersist = optUser.map(existing -> {
                existing.setId(mappedUser.getId());
                existing.setFirstName(mappedUser.getFirstName());
                existing.setLastName(mappedUser.getLastName());
                existing.setEmail(mappedUser.getEmail());
                existing.setRole(mappedUser.getRole());
                return existing;
            }).orElse(mappedUser);

            userRepository.save(userToPersist);
        });
    }

    private Optional<String> getUserEmail(Jwt token) {
        return Optional.ofNullable(token.getClaims().get("email"))
                .map(Object::toString);
    }
}

