import {
  Interceptor,
  AjaxServiceRequestOptions,
  AjaxServiceResponse,
  AjaxServiceInitializer,
  AjaxService,
  AjaxServiceConfig,
  AjaxServiceRequestOptionsBase,
  ResponseListener,
  CancelListener,
  RetryState,
  RequestState,
} from './types';
import constants from './constants';
import prepareOptions, {
  prepareCredentials,
  prepareUrl,
} from './prepare_options';
import crossfetch from 'cross-fetch';
import { backOff } from 'exponential-backoff';
import '@github1/amfjs/amf';
export { AjaxServiceRequestOptions, AjaxServiceResponse } from './types';

function createFetch(
  opts: AjaxServiceRequestOptions,
  allConfigs: Partial<AjaxServiceConfig>[],
  abortController: AbortController
) {
  const fetchOpts = prepareOptions(opts);
  prepareUrl(fetchOpts);
  prepareCredentials(fetchOpts);
  const abortSignal = abortController.signal;
  return crossfetch(fetchOpts.url, { ...fetchOpts, signal: abortSignal }).then(
    (fetchResponse: Response) => {
      const responseContentType =
        fetchResponse.headers.get(constants.content_type) || '';
      let resPromise: Promise<AjaxServiceResponse>;
      if (responseContentType.indexOf(constants.application_json) > -1) {
        resPromise = fetchResponse.json().then(wrapResponse(fetchResponse));
      } else if (responseContentType.indexOf(constants.application_amf) > -1) {
        resPromise = fetchResponse
          .arrayBuffer()
          .then((buffer) => {
            const deserialized = new amf.Deserializer(
              new Uint8Array(buffer)
            ).readObject();
            return wrapResponse(fetchResponse)(deserialized);
          })
          .catch((err) => {
            if (typeof err === 'string') {
              // Wrap amf deserialization errors
              err = new Error(err);
            }
            throw err;
          });
      } else {
        resPromise = fetchResponse.text().then(wrapResponse(fetchResponse));
      }
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
    }
  );
}

const ajaxServiceInit: AjaxServiceInitializer = (
  configs: Partial<AjaxServiceConfig>[] = []
) => {
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
    send: async (opts: AjaxServiceRequestOptions) => {
      const retryState: RetryState = {
        attemptNumber: 0,
        numOfAttempts: 0,
        err: undefined,
      };
      const allConfigs = [...(configs || []), ...(opts?.configs || [])];
      function fetchCreator(): Promise<AjaxServiceResponse> {
        const currentOptsRef: AjaxServiceRequestOptionsBase[] = [];
        const abortController: AbortController = new AbortController();
        abortController.signal.addEventListener('abort', () => {
          allConfigs
            .filter((config) => !!config?.onCancel)
            .map((config) => config.onCancel as CancelListener)
            .forEach((onCancel) => {
              onCancel({
                req: currentOptsRef[0],
              });
            });
        });
        // abortController.signal.throwIfAborted();
        const cancelFunc = () => {
          try {
            allConfigs
              .filter((config) => !!config?.onCancel)
              .map((config) => config.onCancel as CancelListener)
              .forEach((onCancel) => {
                onCancel({
                  req: currentOptsRef[0],
                });
              });
            const cancelError = new Error('cancelled');
            (cancelError as any).req = currentOptsRef[0];
            return Promise.reject(cancelError);
          } finally {
            abortController.abort();
          }
        };
        const mainFetchCreator = (o) =>
          createFetch(o, allConfigs, abortController).then((res) => {
            return Promise.all(
              allConfigs
                .filter((config) => !!config?.onResponse)
                .map((config) => config.onResponse as ResponseListener)
                .reduce((a, b) => {
                  return [...a, b({ req: o, res })].filter((item) => !!item);
                }, [])
            ).then(() => res);
          });
        const interceptors = allConfigs
          .filter((config) => !!config?.onRequest)
          .map((config) => config.onRequest as Interceptor);
        let index = 0;
        const reqState: RequestState = {
          cancel: cancelFunc,
          next: null,
          retryState: retryState,
        };
        const theNextInterceptor: Interceptor = (o) => {
          return (interceptors[index++] || mainFetchCreator)(o, {
            ...reqState,
            next: (nReq) => {
              currentOptsRef[0] = nReq;
              return theNextInterceptor(nReq, { ...reqState });
            },
          });
        };
        return theNextInterceptor(opts, reqState);
      }
      const numOfAttempts = opts?.retry?.attempts || 10;
      return backOff(fetchCreator, {
        numOfAttempts: numOfAttempts,
        retry: (e, attemptNumber) => {
          e.retryAttemptNumber = attemptNumber;
          // update retryState
          retryState.attemptNumber = attemptNumber;
          retryState.numOfAttempts = numOfAttempts;
          retryState.err = e;
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
ajaxServiceInit.constants = constants;

export const init = ajaxServiceInit;

function wrapResponse(
  fetchResponse: Response
): (body: any) => AjaxServiceResponse {
  return (body: any): AjaxServiceResponse => {
    return {
      status: fetchResponse.status,
      data: body,
      headers: convertHeaders(fetchResponse.headers),
    };
  };
}

function convertHeaders(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((v, k) => {
    obj[k] = v;
  });
  return obj;
}
