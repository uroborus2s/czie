import { type AxiosInstance, AxiosRequestConfig } from 'axios';
import dayjs from 'dayjs';

interface Token {
  token: string;
  timeOut: number;
}

export class TokenService {
  private _companyToken?: Token;

  private readonly appid: string;

  private readonly wpsHttpClient: AxiosInstance;

  constructor(appid: string, wpsHttpClient: AxiosInstance) {
    this.wpsHttpClient = wpsHttpClient;
    this.appid = appid;
  }

  public async getToken() {
    const now = dayjs().unix();
    const res = await this.wpsHttpClient.get(
      `/oauthapi/v3/inner/company/token?app_id=${this.appid}`,
    );
    this._companyToken = {
      token: res.data.company_token,
      timeOut: now + res.data['expires_in'] - 300,
    };
    return this._companyToken.token;
  }

  public async getCompanyId() {
    const companyToken = await this.companyToken();
    const res = await this.wpsHttpClient.get(
      `/plus/v1/company?company_token=${companyToken}`,
    );
    return res.data;
  }

  // curl "https://openapi.wps.cn/oauthapi/v3/inner/company/token?app_id=AK20231102XMBQDP" -H 'Accept: application/json, text/plain, */*' -H 'Content-Type:application/json' -H 'Content-Md5: d41d8cd98f00b204e9800998ecf8427e' -H 'Date: Thu, 02 Nov 2023 03:04:26 GMT' -H 'X-Auth: WPS-3:AK20231102XMBQDP:743db41195d0094104ef769e2ee6561c11fc6c27' -H 'User-Agent: axios/1.4.0'
  public async refreshToken() {
    const now = dayjs().unix();
    if (
      this._companyToken === undefined ||
      now - this._companyToken.timeOut >= 0
    ) {
      const res = await this.wpsHttpClient.get(
        `/oauthapi/v3/inner/company/token?app_id=${this.appid}`,
      );
      this._companyToken = {
        token: res.data.company_token,
        timeOut: now + res.data['expires_in'] - 300,
      };
    }
    return this._companyToken.token;
  }

  public async companyToken() {
    await this.refreshToken();
    return this._companyToken?.token;
  }

  public async wpsApiRequest(
    buildUrl: (token: string) => string,
    config: AxiosRequestConfig,
  ) {
    const token = await this.refreshToken();
    const url = buildUrl(token!);
    const resp = await this.wpsHttpClient(url, config);
    return resp.data;
  }
}
