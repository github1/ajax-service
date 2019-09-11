import amf from './amf';
import constants from './constants';
import normalizeURL from 'normalize-url';

const windowOrGlobal = (typeof self === 'object' && self.self === self && self) ||
  (typeof global === 'object' && global.global === global && global) ||
  this;

const resolveOrigin = () => {
  return windowOrGlobal ? windowOrGlobal.location.protocol + '//' + windowOrGlobal.location.hostname + (windowOrGlobal.location.port ? ':' + windowOrGlobal.location.port : '') : '';
};

export default (opts) => {
  const resolvedOrigin = resolveOrigin();
  const url = /^[a-z0-9]+:\/\//i.test(opts['url']) ? normalizeURL(opts['url']) : normalizeURL(`${resolvedOrigin}/${opts['url']}`);
  const fetchOpts = {
    url,
    method: opts['method'],
    body: opts['data'],
    credentials: 'same-origin',
    headers: {
      ...opts['headers'],
      [constants.content_type]: opts[constants.content_type] || opts['contentType'] || constants.application_json,
      [constants.accept]: opts[constants.accept] || constants.application_json
    }
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
