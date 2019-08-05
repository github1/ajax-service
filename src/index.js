import amf from './amf';
import normalizeURL from 'normalize-url-es5';

const windowOrGlobal = (typeof self === 'object' && self.self === self && self) ||
    (typeof global === 'object' && global.global === global && global) ||
    this;

const constants = {
    application_x_www_form_urlencoded: 'application/x-www-form-urlencoded',
    application_amf: 'application/x-amf',
    application_json: 'application/json',
    application_octet_stream: 'application/octet-stream',
    text_plain: 'text/plain',
    origin: 'Origin',
    authorization: 'Authorization',
    content_type: 'content-type',
    accept: 'accept'
};

const ajaxSend = (options, headers, completeCallback) => {
    const xhr = new XMLHttpRequest();
    let url = options.url || windowOrGlobal.location.href;
    const method = options.method || 'GET';
    const dataType = options.dataType || 'text';
    const data = options.data || null;
    const async = options.async || true;
    url = url + (url.indexOf('?') < 0 ? '?' : '&' ) + 'b=' + guid();
    try {
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) {
                return;
            }
            const res = {};
            res[dataType] = xhr.response;
            completeCallback(xhr.status, xhr.statusText, res, (header, defaultValue) => {
                const value = xhr.getResponseHeader(header);
                return typeof value !== 'undefined' && value !== null ? value : defaultValue;
            });
        };
        xhr.open(method, url, async);
        xhr.withCredentials = true;
        for (var header in headers) {
            if (headers.hasOwnProperty(header)) {
                xhr.setRequestHeader(header, headers[header]);
            }
        }
        xhr.responseType = dataType;
        xhr.send(data);
    } catch (e) {
        console.log(e);
    }
};

const guidS4 = () => Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);

const guid = () => guidS4() + guidS4() + '-' + guidS4() + '-' + guidS4() + '-' + guidS4() + '-' + guidS4() + guidS4() + guidS4();

const init = interceptors => {

    const invokeInterceptors = (method, args) => {
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

    return {
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
            if (windowOrGlobal.location) {
                const resolvedOrigin = windowOrGlobal.location.protocol + '//' + windowOrGlobal.location.hostname + (windowOrGlobal.location.port ? ':' + windowOrGlobal.location.port : '');
                if (opts['data'] && typeof opts['data'] === 'object') {
                    opts['data']['request.origin'] = resolvedOrigin;
                }
            }
            return new Promise((resolve, reject) => {
                const ajaxOpts = {
                    url: /^[a-z0-9]+:\/\//i.test(opts['url']) ? normalizeURL(opts['url']) : '/' + opts['url'],
                    method: opts['method'],
                    data: opts['data'],
                    processData: false,
                    use_buffer: false
                };
                const ajaxHeaders = opts['headers'] || {};
                ajaxHeaders[constants.content_type] = opts['contentType'] || constants.application_json;
                ajaxHeaders[constants.accept] = opts[constants.accept] || constants.application_json;
                const ajaxResultProcessor = (status, statusText, res, responseHeaders, resolve, reject) => {
                    let data = {},
                        result,
                        cancelled = false,
                        cancel = () => {
                            cancelled = true;
                        };
                    if (responseHeaders(constants.content_type).indexOf(constants.application_amf) > -1) {
                        //const b = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(res['arraybuffer'])));
                        //data = new amf.Deserializer(new Uint8Array(b)).readObject();
                        if (typeof res['arraybuffer'] !== 'undefined') {
                            data = new amf.Deserializer(new Uint8Array(res['arraybuffer'])).readObject();
                        } else {
                            throw new Error('excepting arraybuffer');
                        }
                    } else if (responseHeaders(constants.content_type).indexOf(constants.application_json) > -1) {
                        data = JSON.parse(res['text']);
                    } else {
                        data = res + '';
                    }
                    invokeInterceptors('onResult', [data, status, statusText, res, responseHeaders, cancel]);
                    if (cancelled) {
                        return;
                    }
                    result = {
                        status: status,
                        headers: responseHeaders,
                        data: data
                    };
                    if (status >= 200 && status < 400) {
                        resolve(result);
                    } else {
                        const error = new Error(status + '');
                        error.status = status;
                        error.result = result;
                        reject(error);
                    }
                };
                if (opts['contentType'] === constants.application_amf) {
                    ajaxHeaders[constants.content_type] = constants.application_amf;
                    const serializer = new amf.Serializer();
                    serializer.writeObject(opts['data']);
                    ajaxOpts['data'] = ajaxOpts['use_buffer'] ? new Uint8Array(serializer.writer.data).buffer
                        : new Uint8Array(serializer.writer.data);
                    ajaxOpts['method'] = 'POST';
                } else if (opts['contentType'] === constants.application_json) {
                    ajaxHeaders[constants.content_type] = constants.application_json;
                    if (typeof ajaxOpts['data'] === 'object') {
                        ajaxOpts['data'] = JSON.stringify(ajaxOpts['data']);
                    }
                }
                if (opts['accept'] === constants.application_amf) {
                    ajaxHeaders[constants.accept] = constants.application_amf;
                    ajaxOpts['dataType'] = 'arraybuffer';
                }
                invokeInterceptors('onRequest', [ajaxOpts, ajaxHeaders]);
                ajaxSend(ajaxOpts, ajaxHeaders, (status, statusText, res, responseHeaders) => {
                    ajaxResultProcessor(status, statusText, res, (headerName, defaultValue) => {
                        defaultValue = typeof defaultValue === 'undefined' ? '' : defaultValue;
                        const value = responseHeaders(headerName);
                        return typeof value === 'undefined' ? defaultValue : value;
                    }, resolve, reject);
                });
            });
        }
    };
};
init.constants = constants;

const str2ab = (str) => {
    var buf = new ArrayBuffer(str.length); // 2 bytes for each char
    var bufView = new Uint8Array(buf);
    for (var i=0, strLen=str.length; i<strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
};

export default init;
