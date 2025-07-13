/* eslint-disable @typescript-eslint/no-inferrable-types */

import { Injectable, NgZone } from '@angular/core';
import { KeycloakService } from '../../../utils/keycloak/keycloak.service';
import { BehaviorSubject, catchError, from, Observable, of, tap, throwError } from 'rxjs';
import { UserRole } from '../../../shared/enums/UserRole';
import { UserProfile } from '../../../utils/keycloak/user-profile';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // BehaviorSubject per i ruoli dell'utente, inizializzato con un array vuoto
  private _currentUserRoles = new BehaviorSubject<UserRole[]>([]);
  // Observable pubblico per sottoscriversi ai ruoli
  public currentUserRoles$: Observable<UserRole[]> = this._currentUserRoles.asObservable();

  // BehaviorSubject per il profilo utente
  private _userProfile = new BehaviorSubject<UserProfile | null>(null);
  public userProfile$: Observable<UserProfile | null> = this._userProfile.asObservable();

  constructor(
    public customKeycloakService: KeycloakService, 
    private router: Router,
    private zone: NgZone 
  ) {
    // Inizializza i ruoli e il profilo utente se Keycloak è già autenticato.
    // Questo è cruciale dato che l'APP_INITIALIZER avvia Keycloak prima del costruttore.
    // Potrebbe essere necessario un piccolo ritardo o una garanzia che keycloak sia inizializzato.
    // Una buona pratica è chiamare updateRolesAndProfile() dopo che keycloak.init() è completo.
    // L'APP_INITIALIZER garantisce che keycloak.init() sia chiamato, ma potresti voler
    // aggiungere un listener per essere sicuro quando l'istanza è completamente pronta e il profilo caricato.

    // Poiché Keycloak.init() è asincrono e gestito da APP_INITIALIZER,
    // i dati potrebbero non essere immediatamente disponibili qui.
    // Potremmo voler chiamare this.updateRolesAndProfile() dopo un certo evento
    // o semplicemente affidarci ai getter che accedono direttamente a customKeycloakService.
    // Per ora, lo chiamiamo nel costruttore, sapendo che potrebbe popolare valori vuoti inizialmente.
    // L'interceptor e i metodi getToken/refreshToken garantiranno che il token sia valido.

    // Esegui la logica che dipende dallo stato di Keycloak all'interno di zone.run
    // per assicurarti che il Change Detection di Angular venga eseguito correttamente.
    this.zone.run(() => {
      // Potresti voler ritardare questo fino a quando Keycloak non è completamente pronto,
      // magari con un event emitter dalla tua CustomKeycloakService.
      // Per semplicità, lo chiamiamo qui, ma tieni presente l'ordine di esecuzione.
      if (this.customKeycloakService.keycloak?.authenticated) {
        this.updateRolesAndProfile();
      }
    });
  }

  /**
   * Aggiorna i ruoli e il profilo dell'utente e li emette tramite i BehaviorSubject.
   * Questo metodo dovrebbe essere chiamato ogni volta che i ruoli o il profilo utente potrebbero cambiare
   * (es. dopo login, refresh token, o caricamento iniziale).
   */
  private updateRolesAndProfile(): void {
    const roles = this.customKeycloakService.getUserRoles() as UserRole[];
    this._currentUserRoles.next(roles);
    console.log('AuthService: Ruoli utente aggiornati:', roles);

    const profile = this.customKeycloakService.userProfile;
    this._userProfile.next(profile || null);
    console.log('AuthService: Profilo utente aggiornato:', profile);
  }

  /**
   * Effettua il login dell'utente.
   */
  login(): Promise<void> {
    return this.customKeycloakService.login();
  }

  /**
   * Effettua il logout dell'utente.
   */
  logout(): Promise<void> {
    return this.customKeycloakService.logout();
  }

  /**
   * Tenta di rinfrescare il token.
   * @param minValidity Secondi minimi di validità richiesti per il token.
   * @returns Observable<boolean> che emette true se il refresh ha avuto successo, false altrimenti.
   */
  refreshToken(minValidity: number = 30): Observable<boolean> {
    console.log(`AuthService: Tentativo di refresh del token. Validità minima richiesta: ${minValidity}s`);
    if (!this.customKeycloakService.keycloak) {
      console.error('AuthService: Keycloak instance non disponibile per il refresh.');
      // Se non c'è l'istanza Keycloak, reindirizza al login
      this.zone.run(() => this.router.navigate(['/login']));
      return of(false);
    }
    return from(this.customKeycloakService.keycloak.updateToken(minValidity)).pipe(
      tap(refreshed => {
        if (refreshed) {
          console.log('AuthService: Token rinfrescato con successo.');
          // Dopo il refresh, ricarica il profilo e i ruoli per assicurare che i BehaviorSubject siano aggiornati
          this.zone.run(() => this.updateRolesAndProfile());
        } else {
          console.warn('AuthService: Token non rinfrescato (ancora valido o refresh non necessario).');
        }
      }),
      catchError(error => {
        console.error('AuthService: Errore durante il refresh del token:', error);
        // Se il refresh fallisce, l'utente deve fare di nuovo il login
        this.zone.run(() => this.router.navigate(['/login']));
        return of(false); // Indica che il refresh non è riuscito
      })
    );
  }

  /**
   * Ottiene il token di accesso corrente.
   * @returns Observable<string> che emette il token di accesso.
   */
  getToken(): Observable<string> {
    const token = this.customKeycloakService.keycloak?.token;
    if (token) {
      return of(token);
    } else {
      console.warn('AuthService: Token non disponibile. Reindirizzamento al login.');
      this.zone.run(() => this.router.navigate(['/login']));
      return throwError(() => new Error('Token non disponibile.'));
    }
  }

  // --- Metodi Esistenti (MANTENUTI E ADATTATI) ---

  /**
   * Controlla se l'utente è autenticato.
   * @returns Observable<boolean> che emette true se l'utente è autenticato, false altrimenti.
   */
  isLoggedIn(): Observable<boolean> {
    // Utilizza la proprietà 'authenticated' dell'istanza keycloak-js
    return of(this.customKeycloakService.keycloak?.authenticated || false);
  }

  /**
   * Controlla se l'utente ha uno o più ruoli specificati.
   * Utilizza il BehaviorSubject per ottenere i ruoli correnti.
   * @param role Il ruolo o un array di ruoli da controllare.
   */
  hasRole(role: UserRole | UserRole[]): boolean {
    const userRoles = this._currentUserRoles.value; // Ottieni il valore corrente dal BehaviorSubject

    if (Array.isArray(role)) {
      return role.some(r => userRoles.includes(r));
    }
    return userRoles.includes(role);
  }

  /**
   * Restituisce l'ID dell'utente corrente.
   * Delega al CustomKeycloakService.
   */
  getUserId(): string {
    return this.customKeycloakService.userId;
  }

  /**
   * Restituisce l'email dell'utente corrente.
   * Delega al CustomKeycloakService.
   */
  getUserEmail(): string {
    return this.customKeycloakService.userProfile?.email || '';
  }

  /**
   * Restituisce il nome completo dell'utente corrente.
   * Delega al CustomKeycloakService.
   */
  getUserFullName(): string {
    return this.customKeycloakService.fullName;
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

  // Nuova proprietà per accedere al profilo utente come Observable
  getUserProfile(): Observable<UserProfile | null> {
    return this.userProfile$;
  }
}

