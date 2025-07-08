
import { Injectable } from '@angular/core';
import { KeycloakService } from '../../../utils/keycloak/keycloak.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserRole } from '../../../shared/enums/UserRole';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // BehaviorSubject per i ruoli dell'utente, inizializzato con un array vuoto
  private _currentUserRoles = new BehaviorSubject<UserRole[]>([]);
  // Observable pubblico per sottoscriversi ai ruoli
  public currentUserRoles$: Observable<UserRole[]> = this._currentUserRoles.asObservable();

  constructor(public keycloak: KeycloakService) {
    // Sottoscriviti ai cambiamenti di autenticazione di Keycloak
    // Questo è un placeholder, il tuo KeycloakService.init() dovrebbe già gestire
    // l'aggiornamento del profilo e dei ruoli dopo l'autenticazione.
    // Potresti voler aggiungere un metodo nel KeycloakService che notifichi quando i ruoli sono pronti.
    // Per ora, chiamiamo updateRoles() all'inizializzazione di AuthService.
    this.updateRoles(); // Popola i ruoli all'avvio del servizio
  }

  /**
   * Aggiorna i ruoli dell'utente e li emette tramite il BehaviorSubject.
   * Questo metodo dovrebbe essere chiamato ogni volta che i ruoli dell'utente potrebbero cambiare (es. dopo login/refresh token).
   */
  private updateRoles(): void {
    const roles = this.keycloak.getUserRoles() as UserRole[]; // Ottieni i ruoli dal KeycloakService
    this._currentUserRoles.next(roles); // Emette i ruoli aggiornati
    console.log('AuthService: Ruoli utente aggiornati:', roles);
  }

  /**
   * Controlla se l'utente ha uno o più ruoli specificati.
   * Utilizza il BehaviorSubject per ottenere i ruoli correnti.
   * @param role Il ruolo o un array di ruoli da controllare.
   */
  hasRole(role: UserRole | UserRole[]): boolean {
    const userRoles = this._currentUserRoles.value; // Ottieni il valore corrente dal BehaviorSubject

    if (Array.isArray(role)) {
      // Se 'role' è un array, controlla se l'utente ha ALMENO UNO di quei ruoli
      return role.some(r => userRoles.includes(r));
    }
    // Se 'role' è una singola UserRole, controlla se l'utente ha quel ruolo
    return userRoles.includes(role);
  }

  /**
   * Restituisce l'ID dell'utente corrente.
   * Delega al KeycloakService.
   */
  getUserId(): string {
    return this.keycloak.userId;
  }

  /**
   * Restituisce l'email dell'utente corrente.
   * Delega al KeycloakService.
   */
  getUserEmail(): string {
    return this.keycloak.userProfile?.email || '';
  }

  /**
   * Restituisce il nome completo dell'utente corrente.
   * Delega al KeycloakService.
   */
  getUserFullName(): string {
    return this.keycloak.fullName;
  }

  // Metodi helper per i ruoli, ora basati su hasRole e UserRole enum
  isUser(): boolean {
    return this.hasRole(UserRole.USER);
  }

  isHelperJunior(): boolean {
    return this.hasRole(UserRole.HELPER_JUNIOR);
  }

  isHelperSenior(): boolean {
    return this.hasRole(UserRole.HELPER_SENIOR);
  }

  isPm(): boolean {
    return this.hasRole(UserRole.PM);
  }

  isAdmin(): boolean {
    return this.hasRole(UserRole.ADMIN);
  }

  isHelperOrPm(): boolean {
    return this.hasRole([UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM]);
  }

  isAdminOrPm(): boolean {
    return this.hasRole([UserRole.ADMIN, UserRole.PM]);
  }

  // Metodo per ottenere tutti i ruoli correnti (utile per debug o visualizzazione)
  getCurrentUserRoles(): UserRole[] {
    return this._currentUserRoles.value;
  }
}

