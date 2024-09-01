import { AxiosInstance } from 'axios';
import { TokenService } from './token.service';

export class CalendarService {
  private tokenService: TokenService;

  private wpsHttpClient: AxiosInstance;

  private calendarUrl = '/kopen/calendar/api';

  constructor(tokenService: TokenService, wpsHttpClient: AxiosInstance) {
    this.tokenService = tokenService;
    this.wpsHttpClient = wpsHttpClient;
  }

  async createCalendar(body: any) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.post(
      `${this.calendarUrl}?company_token=${companyToken}`,
      body,
    );
    return resp.data;
  }
}
