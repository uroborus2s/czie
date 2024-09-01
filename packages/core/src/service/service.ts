import {
  ContextService,
  RemoteDeptBaseInfo,
  RemoteDeptInfo,
  RemoteUserInfo,
} from '@wps/types-context';
import Router from '@koa/router';
import { CloudOrgService } from './cloudorg.service';
import { CloudUserService, UserMode } from './clouduser.service';
import { TokenService } from './token.service';
import { SpacesService } from './spaces.service';
import { GroupsService } from './groups.service';
import { CalendarService } from "./calendar.service";

export interface WpsService extends ContextService {
  cloudOrgService: CloudOrgService;
  cloudUserService: CloudUserService;
  tokenService: TokenService;
  spacesService: SpacesService;
  groupsService: GroupsService;
  calendarService: CalendarService;

  readAllUsers(status?: string): Promise<UserMode[]>;

  readAllDepts(): Promise<RemoteDeptInfo>;

  addUsers(users: RemoteUserInfo[]): Promise<unknown>;

  addUser(user: RemoteUserInfo): Promise<string>;

  activateUser(
    userId: string,
    userName?: string,
    version?: string,
  ): Promise<void>;

  editUsers(users: RemoteUserInfo[], wpsUsers: UserMode[]): Promise<unknown>;

  addDept(
    fatherNode: RemoteDeptInfo,
    department: RemoteDeptInfo,
    order: number,
  ): Promise<void>;

  deleteDept(restDept: RemoteDeptInfo): Promise<void>;

  editDept(
    fatherNode: RemoteDeptInfo,
    oldDept: RemoteDeptInfo,
    newDept: RemoteDeptInfo,
  ): Promise<void>;

  deleteUser(id: string): Promise<void>;

  syncDepartmentOfUser(
    user: RemoteUserInfo,
    wpsUser: UserMode,
  ): Promise<{ add: any[]; dele: any[] }>;
}

export interface ErrorService extends ContextService {
  catchLog(msg: string, error: any): Promise<void>;
}

export interface RemoteService extends ContextService {
  rootId: string | null;

  readAllOrg?: () => Promise<RemoteDeptInfo | undefined>;

  readAllUsers(): Promise<RemoteUserInfo[]>;

  readAllOrgArray?: () => Promise<RemoteDeptBaseInfo[]>;
}

export interface ExpandRouterService extends ContextService {
  getRouter(): Router;
}
