import { type AxiosInstance } from 'axios';
import dayjs from 'dayjs';

interface Token {
  token: string;
  timeOut: number;
}

interface IdConvertPO {
  id_type:
    | 'company_id'
    | 'dept_id'
    | 'group_id'
    | 'file_id'
    | 'union_id'
    | 'open_id'
    | 'company_uid';
  ids: string[];
  company_id?: string;
}

export class TokenService {
  private _companyToken?: Token;

  private readonly appid: string;

  private readonly appSecret: string;

  private readonly wpsHttpClient: AxiosInstance;

  constructor(appid: string, appSecret: string, wpsHttpClient: AxiosInstance) {
    this.wpsHttpClient = wpsHttpClient;
    this.appid = appid;
    this.appSecret = appSecret;
  }

  private async requestToken(now: number) {
    const res = await this.wpsHttpClient.post(
      `/oauth2/token`,
      {
        grant_type: 'client_credentials',
        client_id: this.appid,
        client_secret: this.appSecret,
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    this._companyToken = {
      token: res.data.access_token,
      timeOut: now + res.data['expires_in'] - 300,
    };
  }

  public async idConvert(data: IdConvertPO) {
    const res = await this.wpsHttpClient.post(`/v7/id_convert`, data, {
      headers: { Authorization: `Bearer ${await this.refreshToken()}` },
    });
    return res.data;
  }

  public async getCurrentCompaniesId() {
    const res = await this.wpsHttpClient.get(`/v7/companies/current`,  {
      headers: { Authorization: `Bearer ${await this.refreshToken()}` },
    });
    return res.data;
  }

  // curl "https://openapi.wps.cn/oauthapi/v3/inner/company/token?app_id=AK20231102XMBQDP" -H 'Accept: application/json, text/plain, */*' -H 'Content-Type:application/json' -H 'Content-Md5: d41d8cd98f00b204e9800998ecf8427e' -H 'Date: Thu, 02 Nov 2023 03:04:26 GMT' -H 'X-Auth: WPS-3:AK20231102XMBQDP:743db41195d0094104ef769e2ee6561c11fc6c27' -H 'User-Agent: axios/1.4.0'
  public async refreshToken() {
    const now = dayjs().unix();
    if (
      this._companyToken === undefined ||
      now - this._companyToken.timeOut >= 0
    ) {
      await this.requestToken(now);
    }
    return this._companyToken?.token;
  }

  public async companyToken() {
    await this.refreshToken();
    return this._companyToken?.token;
  }
}
