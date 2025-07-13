/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpInterceptorFn, HttpHeaders, HttpErrorResponse, HttpInterceptor, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { AuthService } from '../../modules/ticket/service/auth.service';

export const keycloakHttpInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  const authService = inject(AuthService);

  // Escludi le richieste a Keycloak stesso per evitare loop infiniti
  if (request.url.includes('localhost:9090')) { 
      return next(request);
  }

  // Aggiungi il token di autorizzazione se l'utente è loggato
  return authService.isLoggedIn().pipe(
    switchMap(loggedIn => {
      if (loggedIn) {
        // Tenta di rinfrescare il token prima di aggiungere l'header
        return authService.refreshToken(30).pipe( // Richiede almeno 30s di validità
          switchMap(refreshed => {
            // Se il token è stato rinfrescato o era già valido, ottieni il token e aggiungilo
            return authService.getToken().pipe(
              switchMap(token => {
                if (token) {
                  const authRequest = request.clone({
                    setHeaders: {
                      Authorization: `Bearer ${token}`
                    }
                  });
                  return next(authRequest);
                } else {
                  // Se getToken() restituisce un errore (refresh fallito e login chiamato nell'AuthService)
                  // o se il token non è disponibile per qualche motivo, non aggiungere l'header e prosegui.
                  // Il backend risponderà con 401 e il catchError sottostante lo gestirà.
                  return next(request);
                }
              }),
              catchError(tokenError => {
                  console.error('Interceptor: Errore nel recupero del token dopo il refresh:', tokenError);
                  // Se getToken() fallisce, l'AuthService dovrebbe già aver reindirizzato.
                  // Qui possiamo semplicemente ritornare un errore per interrompere il flusso.
                  // Usiamo router.navigate direttamente qui, dato che siamo in un contesto di funzione.
                  authService.logout()
                  return throwError(() => new Error('Recupero token fallito.'));
              })
            );
          }),
          catchError(refreshError => {
            console.error('Interceptor: Errore durante il refresh del token, reindirizzamento al login:', refreshError);
            // Se il refresh fallisce, l'AuthService lo fa già, ma qui per sicurezza.
            authService.logout()
            return throwError(() => new Error('Refresh del token fallito.')); // Interrompi il flusso
          })
        );
      } else {
        // Se l'utente non è loggato, prosegui senza token
        return next(request);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        console.error('Errore 401/403: Token scaduto o non valido. Reindirizzamento alla pagina di login.', error);
        authService.logout()
      }
      return throwError(() => error);
    })
  );
};