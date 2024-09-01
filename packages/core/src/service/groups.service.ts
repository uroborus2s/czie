import { AxiosInstance } from 'axios';
import { TokenService } from './token.service';

export class GroupsService {
  private tokenService: TokenService;

  private wpsHttpClient: AxiosInstance;

  private groupsUrl = '/kopen/plus/v2/open/dev/groups';

  constructor(tokenService: TokenService, wpsHttpClient: AxiosInstance) {
    this.tokenService = tokenService;
    this.wpsHttpClient = wpsHttpClient;
  }

  async createDeptGroups(operatorId: string, deptId: string) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.post(
      `${this.groupsUrl}?company_token=${companyToken}`,
      {
        operator_id: operatorId,
        dept_id: deptId,
        type: 'corpdep',
      },
    );
    return resp.data;
  }

  async readDeptGroups(deptId: string) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.get(
      `${this.groupsUrl}?company_token=${companyToken}&dept_id=${deptId}`,
    );
    return resp.data;
  }

  async deleteDeptGroups(operatorId: string, groupId: string) {
    const companyToken = await this.tokenService.companyToken();
    const resp = await this.wpsHttpClient.delete(
      `${this.groupsUrl}/${groupId}?company_token=${companyToken}&operator_id=${operatorId}`,
    );
    return resp.data;
  }
}
