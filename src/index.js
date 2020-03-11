import amf from './amf';
import constants from './constants';
import prepareOptions, {
  prepareCredentials,
  prepareUrl
} from './prepare_options';
import crossfetch from 'cross-fetch';
import {backOff} from 'exponential-backoff';

const buildInterceptorHandler = passedInterceptors => {
  return (method, additionalInterceptors, args) => {
    const interceptors = (passedInterceptors || []).concat(additionalInterceptors||[]);
    if (typeof interceptors === 'undefined' || interceptors.length === 0) {
      return;
    }
    const nextInterceptor = (index, args) => {
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

const init = interceptors => {

  const invokeInterceptors = buildInterceptorHandler(interceptors);

  const ajaxServiceInstance = {
    constants: constants,
    get(opts) {
      opts['method'] = 'GET';
      return this.send(opts);
    },
    post(opts) {
      opts['method'] = 'POST';
      return this.send(opts);
    },
    "delete"(opts) {
      opts['method'] = 'DELETE';
      return this.send(opts);
    },
    send(opts) {
      const fetchOpts = prepareOptions(opts);
      invokeInterceptors('onRequest', opts.interceptors, [fetchOpts]);
      prepareUrl(fetchOpts);
      prepareCredentials(fetchOpts);
      let isCancelled = false;
      const sendFetch = () => {
        let cancellableResolve;
        let cancellableReject;
        const cancellablePromise = new Promise((resolveFromPromise, rejectFromPromise) => {
          cancellableResolve = resolveFromPromise;
          cancellableReject = rejectFromPromise;
        });
        crossfetch(fetchOpts.url, fetchOpts)
          .then(res => {
            const responseContentType = res.headers.get(constants.content_type) || '';
            let resPromise;
            if (responseContentType.indexOf(constants.application_json) > -1) {
              resPromise = res.json().then(wrapResponse(res));
            } else if (responseContentType.indexOf(constants.application_amf) > -1) {
              resPromise = res.arrayBuffer().then(buffer => {
                return wrapResponse(res)(new amf.Deserializer(new Uint8Array(buffer)).readObject());
              });
            } else {
              resPromise = res.text().then(wrapResponse(res));
            }
            resPromise = resPromise.then(resp => {
              const cancelFunc = () => {
                isCancelled = true;
                invokeInterceptors('onCancel', opts.interceptors, [fetchOpts, resp]);
              };
              invokeInterceptors('onResult', opts.interceptors, [resp, cancelFunc]);
              return resp;
            });
            if (res.status < 200 || res.status >= 400) {
              return resPromise
                .then(resp => {
                  const err = new Error(`${res.status}`);
                  err.status = res.status;
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
      return backOff(sendFetch, {
        numOfAttempts: opts.numOfAttempts,
        retry: (e, attemptNumber) => {
          invokeInterceptors('onRetry', opts.interceptors, [e, attemptNumber, opts.numOfAttempts, fetchOpts]);
          e.retryAttemptNumber = attemptNumber;
          return e.status === 503
            || /network request failed/i.test(e.message)
            || /^request to.*failed, reason:/i.test(e.message)
            || /^failed to fetch$/i.test(e.message);
        }
      });
    }
  };
  return ajaxServiceInstance;
};
init.constants = constants;

const wrapResponse = (res) => {
  return body => ({
    status: res.status,
    data: body,
    headers: headersToMap(res.headers)
  });
};

const headersToMap = (headers) => {
  return JSON.parse(JSON.stringify([...headers]))
    .reduce((map, cur, idx, arr) => {
      map[cur[0]] = cur[1];
      return map;
    }, {});
};

export default init;
