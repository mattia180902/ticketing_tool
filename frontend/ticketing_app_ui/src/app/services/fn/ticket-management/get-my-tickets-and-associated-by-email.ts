/* tslint:disable */
/* eslint-disable */
/* Code generated by ng-openapi-gen DO NOT EDIT. */

import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';

import { PageTicketResponseDto } from '../../models/page-ticket-response-dto';

export interface GetMyTicketsAndAssociatedByEmail$Params {

/**
 * Zero-based page index (0..N)
 */
  page?: number;

/**
 * The size of the page to be returned
 */
  size?: number;

/**
 * Sorting criteria in the format: property,(asc|desc). Default sort order is ascending. Multiple sort criteria are supported.
 */
  sort?: Array<string>;

/**
 * Filtra per stato del ticket
 */
  status?: 'OPEN' | 'ANSWERED' | 'SOLVED' | 'DRAFT';

/**
 * Filtra per priorità del ticket
 */
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Cerca per titolo, descrizione, nome categoria o nome servizio
 */
  search?: string;
}

export function getMyTicketsAndAssociatedByEmail(http: HttpClient, rootUrl: string, params?: GetMyTicketsAndAssociatedByEmail$Params, context?: HttpContext): Observable<StrictHttpResponse<PageTicketResponseDto>> {
  const rb = new RequestBuilder(rootUrl, getMyTicketsAndAssociatedByEmail.PATH, 'get');
  if (params) {
    rb.query('page', params.page, {});
    rb.query('size', params.size, {});
    rb.query('sort', params.sort, {});
    rb.query('status', params.status, {});
    rb.query('priority', params.priority, {});
    rb.query('search', params.search, {});
  }

  return http.request(
    rb.build({ responseType: 'json', accept: 'application/json', context })
  ).pipe(
    filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
    map((r: HttpResponse<any>) => {
      return r as StrictHttpResponse<PageTicketResponseDto>;
    })
  );
}

getMyTicketsAndAssociatedByEmail.PATH = '/api/v1/tickets/my-tickets-and-associated';
