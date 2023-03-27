export interface AjaxServiceRequestOptionsBase {
  method: string;
  url: string;
  id?: string;
  headers?: Record<string, string>;
  data?: any;
  accept?: string;
  contentType?: string;
  credentials?: RequestCredentials;
  origin?: string;
  numOfAttempts?: number;
}

export interface AjaxServiceResponse {
  status: number;
  headers: Record<string, string>;
  data: any;
}

export type InterceptorPhases =
  | 'onRequest'
  | 'onRetry'
  | 'onResult'
  | 'onCancel';

export type Interceptor<TPhase extends InterceptorPhases = InterceptorPhases> =
  {
    [k in TPhase]?: k extends 'onRequest'
      ? (req: AjaxServiceRequestOptionsBase) => void
      : k extends 'onRetry'
      ? (
          e: Error & { status: number; response: AjaxServiceResponse },
          attemptNumber: number,
          numOfAttempts: number,
          fetchOpts: AjaxServiceRequestOptionsBase,
          cancelRetry: () => void,
          next?: () => void
        ) => void
      : k extends 'onResult'
      ? (res: AjaxServiceResponse, cancel: () => void, next: () => void) => void
      : k extends 'onCancel'
      ? (
          req: AjaxServiceRequestOptionsBase,
          res: AjaxServiceResponse,
          next?: () => void
        ) => void
      : never;
  };

export type AjaxServiceRequestOptions = AjaxServiceRequestOptionsBase & {
  interceptors?: Interceptor[];
};

export type RequestInitWithUrl = RequestInit & { url: string; origin?: string };
