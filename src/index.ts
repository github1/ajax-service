import {
  InterceptorPhases,
  Interceptor,
  AjaxServiceRequestOptions,
  AjaxServiceResponse,
} from './types';
import constants from './constants';
import prepareOptions, {
  prepareCredentials,
  prepareUrl,
} from './prepare_options';
import crossfetch from 'cross-fetch';
import { backOff } from 'exponential-backoff';
const amf = require('./amf');

const buildInterceptorHandler = (passedInterceptors: Interceptor[]) => {
  return (
    method: InterceptorPhases,
    additionalInterceptors: Interceptor[],
    args: any[]
  ) => {
    const interceptors = (passedInterceptors || []).concat(
      additionalInterceptors || []
    );
    if (typeof interceptors === 'undefined' || interceptors.length === 0) {
      return;
    }
    const nextInterceptor = (index: number, args: any[]) => {
      return () => {
        if (index > interceptors.length - 1) {
          return;
        }
        const next = nextInterceptor(index + 1, args);
        if (!interceptors[index].hasOwnProperty(method)) {
          next();
        } else {
          const sc = args.slice();
          sc.push(next);
          interceptors[index][method].apply(interceptors[index], sc);
        }
      };
    };
    nextInterceptor(0, args)();
  };
};

export { AjaxServiceRequestOptions, AjaxServiceResponse } from './types';

export type AjaxService = {
  constants: typeof constants;
  get(opts: Partial<AjaxServiceRequestOptions>): Promise<AjaxServiceResponse>;
  post(opts: Partial<AjaxServiceRequestOptions>): Promise<AjaxServiceResponse>;
  delete(
    opts: Partial<AjaxServiceRequestOptions>
  ): Promise<AjaxServiceResponse>;
  send(opts: AjaxServiceRequestOptions): Promise<AjaxServiceResponse>;
};

export type AjaxServiceInitializer = ((
  interceptors?: Interceptor[]
) => AjaxService) & { constants: typeof constants };

const init: AjaxServiceInitializer = (interceptors: Interceptor[] = []) => {
  const invokeInterceptors = buildInterceptorHandler(interceptors);

  const ajaxServiceInstance: AjaxService = {
    constants,
    get(opts: Omit<AjaxServiceRequestOptions, 'method'>) {
      return this.send({ ...opts, method: 'GET' });
    },
    post(opts: Omit<AjaxServiceRequestOptions, 'method'>) {
      return this.send({ ...opts, method: 'POST' });
    },
    delete(opts: Omit<AjaxServiceRequestOptions, 'method'>) {
      return this.send({ ...opts, method: 'DELETE' });
    },
    send(opts: AjaxServiceRequestOptions) {
      const fetchOpts = prepareOptions(opts);
      invokeInterceptors('onRequest', opts.interceptors, [fetchOpts]);
      prepareUrl(fetchOpts);
      prepareCredentials(fetchOpts);
      let isCancelled = false;
      const sendFetch = async () => {
        let cancellableResolve: (
          response: AjaxServiceResponse | PromiseLike<AjaxServiceResponse>
        ) => void;
        let cancellableReject: (reason?: any) => void;
        const cancellablePromise = new Promise<AjaxServiceResponse>(
          (resolveFromPromise, rejectFromPromise) => {
            cancellableResolve = resolveFromPromise;
            cancellableReject = rejectFromPromise;
          }
        );
        crossfetch(fetchOpts.url, fetchOpts)
          .then((fetchResponse: Response) => {
            const responseContentType =
              fetchResponse.headers.get(constants.content_type) || '';
            let resPromise: Promise<AjaxServiceResponse>;
            if (responseContentType.indexOf(constants.application_json) > -1) {
              resPromise = fetchResponse
                .json()
                .then(wrapResponse(fetchResponse));
            } else if (
              responseContentType.indexOf(constants.application_amf) > -1
            ) {
              resPromise = fetchResponse.arrayBuffer().then((buffer) => {
                return wrapResponse(fetchResponse)(
                  new amf.Deserializer(new Uint8Array(buffer)).readObject()
                );
              });
            } else {
              resPromise = fetchResponse
                .text()
                .then(wrapResponse(fetchResponse));
            }
            resPromise = resPromise.then((resp: AjaxServiceResponse) => {
              const cancelFunc = () => {
                isCancelled = true;
                invokeInterceptors('onCancel', opts.interceptors, [
                  fetchOpts,
                  resp,
                ]);
              };
              invokeInterceptors('onResult', opts.interceptors, [
                resp,
                cancelFunc,
              ]);
              return resp;
            });
            if (fetchResponse.status < 200 || fetchResponse.status >= 400) {
              return resPromise.then((resp) => {
                const err: Error & {
                  status?: number;
                  response?: AjaxServiceResponse;
                } = new Error(`${fetchResponse.status}`);
                err.status = resp.status;
                err.response = resp;
                throw err;
              });
            }
            return resPromise;
          })
          .then((resp) => {
            if (!isCancelled) {
              cancellableResolve(resp);
            }
          })
          .catch((err) => {
            if (!isCancelled) {
              cancellableReject(err);
            }
          });
        return cancellablePromise;
      };
      const numOfAttempts = opts.numOfAttempts || 10;
      return backOff(sendFetch, {
        numOfAttempts: numOfAttempts,
        retry: (e, attemptNumber) => {
          let retryCancelled = false;
          const cancelRetry = () => {
            retryCancelled = true;
          };
          invokeInterceptors('onRetry', opts.interceptors, [
            e,
            attemptNumber,
            numOfAttempts,
            fetchOpts,
            cancelRetry,
          ]);
          if (retryCancelled) {
            return false;
          }
          e.retryAttemptNumber = attemptNumber;
          return (
            e.status === 503 ||
            /network request failed/i.test(e.message) ||
            /^request to.*failed, reason:/i.test(e.message) ||
            /^failed to fetch$/i.test(e.message)
          );
        },
      });
    },
  };
  return ajaxServiceInstance;
};
init.constants = constants;

function wrapResponse(
  fetchResponse: Response
): (body: any) => AjaxServiceResponse {
  return (body: any): AjaxServiceResponse => ({
    status: fetchResponse.status,
    data: body,
    headers: convertHeaders(fetchResponse.headers),
  });
}

function convertHeaders(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((v, k) => {
    obj[k] = v;
  });
  return obj;
}

export default init;
