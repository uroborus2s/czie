import { AxiosInstance } from 'axios';
import { TokenService } from './token.service';

export class SpacesService {
  private tokenService: TokenService;

  private wpsHttpClient: AxiosInstance;

  private spaceUrl = '/kopen/plus/v2/open/dev/spaces';

  constructor(tokenService: TokenService, wpsHttpClient: AxiosInstance) {
    this.tokenService = tokenService;
    this.wpsHttpClient = wpsHttpClient;
  }

  async readSpaceByUserId(companyUid: string) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.get(
      `${this.spaceUrl}/usage/users/${companyUid}?company_token=${companyToken}`,
    );
    return resp.data;
  }

  async readTotalSpace() {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.get(
      `${this.spaceUrl}/quota/company?company_token=${companyToken}`,
    );
    return resp.data;
  }
}
