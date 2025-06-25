/* eslint-disable @typescript-eslint/no-unused-vars */
import { TicketDto } from "../../../services/models";
import { StatsControllerService, TicketControllerService, TicketHistoryControllerService } from "../../../services/services";

@Injectable({ providedIn: 'root' })
export class TicketService {

  constructor(
    private ticketApi: TicketControllerService,
    private statsApi: StatsControllerService,
    private historyApi: TicketHistoryControllerService
  ) {}

  getDashboardCounts() {
    return this.ticketApi.dashboardCounts();
  }

  getRecentTickets(size = 5) {
    return this.ticketApi.listAll({ page: 0, size });
  }

  getStatsByRole(role: string) {
    switch (role) {
      case 'ADMIN': return this.statsApi.getStatsForAdmin();
      case 'HELPER': return this.statsApi.getStatsForHelper();
      default: return this.statsApi.getStatsForUser();
    }
  }

  getTicketHistory(ticketId: number) {
    return this.historyApi.getTicketHistory({ ticketId });
  }

  updateTicketStatus(
    id: number, 
    status: 'OPEN' | 'CLOSED' | 'ANSWERED' | 'UNANSWERED' | 'SOLVED'
  ) {
    return this.ticketApi.updateStatus({
      id,
      body: { status }
    });
  }

  createTicket(ticketDto: TicketDto) {
    return this.ticketApi.create({ body: ticketDto });
  }

  deleteTicket(id: number) {
    return this.ticketApi.delete({ id });
  }

  getTicket(id: number) {
    return this.ticketApi.getOne({ id });
  }
}
function Injectable(arg0: { providedIn: string; }): (target: typeof TicketService) => void | typeof TicketService {
    throw new Error("Function not implemented.");
}

