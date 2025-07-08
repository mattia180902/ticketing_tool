import { HttpInterceptorFn, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api'; // Importa MessageService
import { KeycloakService } from '../keycloak/keycloak.service';

export const keycloakHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloakService = inject(KeycloakService);
  const router = inject(Router);
  const messageService = inject(MessageService); // Inietta MessageService

  const token = keycloakService.keycloak.token;

  let authReq = req;
  if (token) {
    authReq = req.clone({
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
      }),
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.error('Errore 401: Token scaduto o non valido. Reindirizzamento alla pagina di login.');
        messageService.add({
          severity: 'error',
          summary: 'Sessione Scaduta',
          detail: 'La tua sessione è scaduta. Effettua nuovamente il login.',
          life: 5000
        });
        // Reindirizza l'utente alla pagina di login
        //keycloakService.logout();
        router.navigate(['']); 
      }
      return throwError(() => error);
    })
  );
};