/* tslint:disable */
/* eslint-disable */
/* Code generated by ng-openapi-gen DO NOT EDIT. */

import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';

import { TicketResponseDto } from '../../models/ticket-response-dto';

export interface GetMyTickets$Params {
}

export function getMyTickets(http: HttpClient, rootUrl: string, params?: GetMyTickets$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<TicketResponseDto>>> {
  const rb = new RequestBuilder(rootUrl, getMyTickets.PATH, 'get');
  if (params) {
  }

  return http.request(
    rb.build({ responseType: 'json', accept: 'application/json', context })
  ).pipe(
    filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
    map((r: HttpResponse<any>) => {
      return r as StrictHttpResponse<Array<TicketResponseDto>>;
    })
  );
}

getMyTickets.PATH = '/api/v1/tickets/my-tickets';
