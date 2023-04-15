import constants from './constants';
export type AjaxServiceRequestRetryOptions = {
  attempts: number;
};
export type AjaxServiceRequestOptionsBase = {
  method: string;
  url: string;
  id?: string;
  headers?: Record<string, string>;
  data?: any;
  accept?: string;
  contentType?: string;
  credentials?: RequestCredentials;
  origin?: string;
  retry?: AjaxServiceRequestRetryOptions;
};

export type AjaxServiceResponse<T = any> = {
  status: number;
  headers: Record<string, string>;
  data: T;
};

export type RequestState = {
  cancel: () => Promise<AjaxServiceResponse>;
  next: (req: AjaxServiceRequestOptionsBase) => Promise<AjaxServiceResponse>;
};

export type Interceptor = (
  req: AjaxServiceRequestOptionsBase,
  requestState: RequestState
) => Promise<AjaxServiceResponse>;

export type ResponseState = {
  req: AjaxServiceRequestOptionsBase;
  res: AjaxServiceResponse;
};

export type ResponseListener = (
  responseState: ResponseState
) => void | Promise<void>;

export type RetryState = {
  err: Error & { status: number; response: AjaxServiceResponse };
  attemptNumber: number;
  numOfAttempts: number;
  req: AjaxServiceRequestOptionsBase;
  cancelRetry: () => void;
};
export type RetryListener = (retryState: RetryState) => void;

export type CancelState = {
  req: AjaxServiceRequestOptionsBase;
};
export type CancelListener = (cancelState: CancelState) => void;

export type AjaxServiceConfig = {
  onRequest: Interceptor;
  onResponse: ResponseListener;
  onRetry: RetryListener;
  onCancel: CancelListener;
};

export type AjaxServiceRequestOptions = AjaxServiceRequestOptionsBase & {
  configs?: Partial<AjaxServiceConfig>[];
};

export type RequestInitWithUrl = RequestInit & { url: string; origin?: string };

export type AjaxService = {
  constants: typeof constants;
  get<T = any>(opts: Partial<AjaxServiceRequestOptions>): Promise<AjaxServiceResponse<T>>;
  post<T = any>(opts: Partial<AjaxServiceRequestOptions>): Promise<AjaxServiceResponse<T>>;
  delete(
    opts: Partial<AjaxServiceRequestOptions>
  ): Promise<AjaxServiceResponse>;
  send<T>(opts: AjaxServiceRequestOptions): Promise<AjaxServiceResponse<T>>;
};

export type AjaxServiceInitializer = ((
  configs?: Partial<AjaxServiceConfig>[]
) => AjaxService) & { constants: typeof constants };
