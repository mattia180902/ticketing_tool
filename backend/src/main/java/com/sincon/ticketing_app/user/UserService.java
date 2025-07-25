package com.sincon.ticketing_app.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sincon.ticketing_app.enums.UserRole;
import com.sincon.ticketing_app.exception.UserProfileNotFoundException;
import com.sincon.ticketing_app.ticket.TicketRepository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final TicketRepository ticketRepository; // Mantenuto per la logica di deleteUser

    // Metodo per ottenere l'ID dell'utente corrente dall'autenticazione JWT
    public String getCurrentUserId(Authentication auth) {
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            String subject = jwtAuth.getToken().getSubject();
            log.debug("getCurrentUserId: JWT Subject (ID): {}", subject);
            return subject;
        }
        log.warn("getCurrentUserId: Authentication is not JwtAuthenticationToken. Using auth.getName() as user ID. Type: {}",
                auth.getClass().getName());
        return auth.getName();
    }

    public Optional<User> findUserById(String id) {
        return userRepository.findById(id);
    }

    public Optional<User> findUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    @Transactional
    public User save(User user) {
        return userRepository.save(user);
    }

    /**
     * Recupera una lista di utenti (entità) in base a una lista di ruoli specifici.
     * Utilizzato per l'assegnazione automatica e altre logiche interne.
     *
     * @param roles La lista di ruoli da cercare.
     * @return Una lista di entità User.
     */
    public List<User> getUsersEntitiesByRoles(List<UserRole> roles) {
        log.info("Fetching user entities with roles: {}", roles);
        return userRepository.findByRoleIn(roles);
    }

    /**
     * Recupera tutti gli utenti, escluso l'utente corrente.
     *
     * @param authentication Dettagli dell'utente autenticato.
     * @return Lista di UserResponseDTO.
     */
    public List<UserDTO> getAllUsersExceptSelf(Authentication authentication) {
        String currentUserId = getCurrentUserId(authentication);
        return userRepository.findAllUsersExceptSelf(currentUserId).stream()
                .map(userMapper::toUserDTO) // Assicurati che UserMapper abbia toResponseDTO
                .toList();
    }

    /**
     * Recupera gli utenti in base a una lista di ruoli specifici.
     *
     * @param roles Lista dei ruoli da cercare.
     * @return Lista di UserResponseDTO.
     */
    public List<UserDTO> getUsersByRoles(List<UserRole> roles) {
        log.info("Fetching users with roles: {}", roles);
        return userRepository.findByRoleIn(roles).stream()
                .map(userMapper::toUserDTO) // Assicurati che UserMapper abbia toResponseDTO
                .toList();
    }

    /**
     * Recupera la lista di utenti con ruolo Helper_Junior, Helper_Senior, PM o Admin.
     *
     * @return Lista di UserResponseDTO.
     */
    public List<UserDTO> getHelpersAndAdmins() {
        log.info("Fetching list of helpers and admins.");
        return userRepository.findByRoleIn(List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN))
                .stream()
                .map(userMapper::toUserDTO)
                .collect(Collectors.toList());
    }

    /**
     * NUOVO METODO: Recupera una lista di DTO di utenti in base a un singolo ruolo specificato.
     * Utile per popolare dropdown nel frontend (es. lista di utenti con ruolo USER).
     * @param role Il ruolo da cercare.
     * @return Una lista di UserResponseDTO.
     */
    public List<UserDTO> getUsersByRole(UserRole role) {
        log.info("Fetching users with role: {}", role);
        return userRepository.findByRole(role).stream()
                             .map(userMapper::toUserDTO)
                             .collect(Collectors.toList());
    }

    /**
     * Recupera i dettagli dell'utente corrente.
     *
     * @param authentication Dettagli dell'utente autenticato.
     * @return UserResponseDTO dell'utente corrente.
     */
    public UserDTO getMe(Authentication authentication) {
        String userId = getCurrentUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserProfileNotFoundException("Utente autenticato non trovato nel DB: " + userId)); // Usata UserProfileNotFoundException
        return userMapper.toUserDTO(user);
    }

    /**
     * Aggiorna le informazioni di contatto (numero di telefono, codice fiscale) di un utente.
     *
     * @param userId ID dell'utente da aggiornare.
     * @param request DTO con le informazioni di contatto.
     * @return UserResponseDTO aggiornato.
     */
    @Transactional
    public UserDTO updateContactInfo(String userId, UserContactUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserProfileNotFoundException("Utente non trovato: " + userId)); // Usata UserProfileNotFoundException

        boolean updated = false;
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isEmpty() && !request.getPhoneNumber().equals(user.getPhoneNumber())) {
            user.setPhoneNumber(request.getPhoneNumber());
            updated = true;
        }
        if (request.getFiscalCode() != null && !request.getFiscalCode().isEmpty() && !request.getFiscalCode().equals(user.getFiscalCode())) {
            user.setFiscalCode(request.getFiscalCode());
            updated = true;
        }

        if (updated) {
            User savedUser = userRepository.save(user);
            log.info("Contact info updated for user: {}", savedUser.getEmail());
            return userMapper.toUserDTO(savedUser);
        }
        log.info("No contact info changes for user: {}", user.getEmail());
        return userMapper.toUserDTO(user); // Ritorna il DTO anche se non ci sono stati cambiamenti
    }

    /**
     * Aggiorna il ruolo di un utente esistente.
     * Solo Admin può modificare i ruoli, e non può modificare altri Admin.
     * Non può assegnare lo stesso ruolo già presente.
     *
     * @param userId ID dell'utente da modificare.
     * @param newRole Il nuovo ruolo da assegnare.
     * @param currentAdminId L'ID dell'Admin che sta eseguendo l'operazione.
     * @return L'utente aggiornato.
     */
    @Transactional
    public UserDTO updateUserRole(String userId, UserRole newRole, String currentAdminId) {
        User userToUpdate = userRepository.findById(userId)
                .orElseThrow(() -> new UserProfileNotFoundException("Utente non trovato con ID: " + userId)); // Usata UserProfileNotFoundException

        // Controllo per impedire a un Admin di modificare un altro Admin
        if (userToUpdate.getRole() == UserRole.ADMIN && !userId.equals(currentAdminId)) {
            throw new SecurityException("Non puoi modificare il ruolo di un altro Admin.");
        }
        // Controllo per impedire l'assegnazione dello stesso ruolo
        if (userToUpdate.getRole() == newRole) {
            throw new IllegalArgumentException("L'utente ha già il ruolo " + newRole.name() + ".");
        }

        userToUpdate.setRole(newRole);
        User savedUser = userRepository.save(userToUpdate);
        log.info("User {} role updated to {}", savedUser.getEmail(), savedUser.getRole());
        return userMapper.toUserDTO(savedUser);
    }

    /**
     * Elimina un account utente e tutti i ticket associati.
     * Solo Admin può eliminare account, e non può eliminare altri Admin.
     *
     * @param userId ID dell'utente da eliminare.
     * @param currentAdminId L'ID dell'Admin che sta eseguendo l'operazione.
     */
    @Transactional
    public void deleteUser(String userId, String currentAdminId) {
        User userToDelete = userRepository.findById(userId)
                .orElseThrow(() -> new UserProfileNotFoundException("Utente non trovato con ID: " + userId)); // Usata UserProfileNotFoundException

        // Controllo per impedire a un Admin di eliminare un altro Admin
        if (userToDelete.getRole() == UserRole.ADMIN && !userId.equals(currentAdminId)) {
            throw new SecurityException("Non puoi eliminare un altro Admin.");
        }
        // Elimina tutti i ticket associati all'utente (sia come owner che come assignedTo)
        ticketRepository.deleteByOwner_Id(userId);
        ticketRepository.deleteByAssignedTo_Id(userId);
        log.info("Deleted all tickets associated with user ID: {}", userId);

        userRepository.delete(userToDelete);
        log.info("User {} (ID: {}) deleted successfully.", userToDelete.getEmail(), userId);
    }
}