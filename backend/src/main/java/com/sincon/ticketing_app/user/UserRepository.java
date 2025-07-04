package com.sincon.ticketing_app.user;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import com.sincon.ticketing_app.enums.UserRole;

import java.util.*;

public interface UserRepository extends JpaRepository<User, String> {

    @Query("SELECT u FROM User u WHERE u.id <> :excludedId")
    List<User> findAllUsersExceptSelf(@Param("excludedId") String excludedId);

    List<User> findByRole(UserRole role);

    Optional<User> findByEmail(String email);

    //@Query("SELECT u FROM User u WHERE u.role IN :roles")
    //List<User> findByRoleIn(@Param("roles") List<UserRole> roles);

    List<User> findByRoleIn(List<UserRole> roles); // Per getAllHelpers

    Optional<User> findTopByRole(UserRole role); // Metodo per trovare il primo utente con un dato ruolo
}
