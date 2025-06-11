import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from '@angular/forms';
import { TicketRoutingModule } from "./ticket-routing.module";

@NgModule({
    declarations: [],
    imports: [
      CommonModule,
      TicketRoutingModule,
      FormsModule
    ]
  })
  export class TicketModule { }