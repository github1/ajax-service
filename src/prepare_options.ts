import { AjaxServiceRequestOptions, RequestInitWithUrl } from './types';
import * as amf from './amf';
import constants from './constants';
import normalizeURL from 'normalize-url';

const windowOrGlobal: any =
  (typeof self === 'object' && self.self === self && self) ||
  (typeof global === 'object' && global.global === global && global) ||
  this;

const resolveOrigin = () => {
  return windowOrGlobal && windowOrGlobal.location
    ? `${windowOrGlobal.location.protocol}//${
        windowOrGlobal.location.hostname
      }${
        windowOrGlobal.location.port ? ':' + windowOrGlobal.location.port : ''
      }`
    : '';
};

export const prepareUrl = (opts: RequestInitWithUrl) => {
  const resolvedOrigin = opts.origin || resolveOrigin();
  opts.url = /^[a-z0-9]+:\/\//i.test(opts.url)
    ? normalizeURL(opts.url)
    : normalizeURL(`${resolvedOrigin}/${opts.url}`);
  return opts;
};

const regPrivNet = /^(localhost$|127\.|192\.168|10\.)([0-9.]+)?$/;

export const prepareCredentials = (opts: Partial<RequestInitWithUrl>) => {
  if (!opts.credentials) {
    const resolvedOrigin = opts.origin || resolveOrigin();
    opts.credentials = 'same-origin';
    const urlHostname = extractHostname(opts.url);
    if (regPrivNet.test(urlHostname)) {
      opts.credentials = 'include';
    } else if (resolvedOrigin) {
      if (
        stripSubdomain(extractHostname(resolvedOrigin)) ===
        stripSubdomain(urlHostname)
      ) {
        opts.credentials = 'include';
      }
    }
  }
  return opts;
};

export default (
  opts: Partial<AjaxServiceRequestOptions>
): RequestInitWithUrl => {
  const resolvedOrigin = opts.origin || resolveOrigin();
  opts.headers = opts.headers || {};
  const fetchOpts: RequestInitWithUrl = {
    url: opts.url,
    method: opts['method'],
    body: opts['data'],
    credentials: opts.credentials,
    headers: {
      ...opts['headers'],
      [constants.content_type]:
        opts.headers[constants.content_type] ||
        opts[constants.content_type] ||
        opts['contentType'] ||
        constants.application_json,
      [constants.accept]:
        opts.headers[constants.accept] ||
        opts[constants.accept] ||
        constants.application_json,
    },
  };
  const hasBodyData = fetchOpts.body && typeof fetchOpts.body === 'object';
  if (hasBodyData) {
    fetchOpts.body['request.origin'] = resolvedOrigin;
  }
  switch (fetchOpts.headers[constants.content_type]) {
    case constants.application_amf: {
      const serializer = new amf.Serializer();
      serializer.writeObject(fetchOpts.body);
      fetchOpts.body = new Uint8Array(serializer.writer.data);
      fetchOpts.method = 'POST';
      break;
    }
    case constants.application_json: {
      if (hasBodyData) {
        fetchOpts.body = JSON.stringify(fetchOpts.body);
      }
      break;
    }
  }
  return fetchOpts;
};

const regHostname = /^(https?:\/\/)([^:\/]+)/i;
const extractHostname = (url) => {
  const result = regHostname.exec(url);
  return result === null || result.length < 3 ? '_' : result[2];
};

const stripSubdomain = (hostname) => {
  const parts = hostname.split('.');
  while (parts.length > 2) {
    parts.shift();
  }
  return parts.join('.');
};
