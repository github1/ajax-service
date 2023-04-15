import { init as ajaxService } from './index';

type EchoData = {
  headers: Record<string, string>;
  body: any;
  status: number;
};

describe('ajax-service', () => {
  it('supports json ajaxService calls', () => {
    expect.assertions(4);
    return ajaxService()
      .post<EchoData>({
        url: 'echo',
        accept: ajaxService.constants.application_json,
        contentType: ajaxService.constants.application_json,
        data: { hello: 'world' },
      })
      .then((res) => {
        expect(res.data.headers.accept).toBe(
          ajaxService.constants.application_json
        );
        expect(res.data.headers['content-type']).toBe(
          ajaxService.constants.application_json
        );
        expect(res.data.body.hello).toBe('world');
        expect(res.headers['content-type']).toMatch(/^application\/json;.*$/);
      });
  });
  it('supports amf ajaxService calls', () => {
    expect.assertions(3);
    return ajaxService()
      .post<EchoData>({
        url: 'echo',
        accept: ajaxService.constants.application_amf,
        contentType: ajaxService.constants.application_amf,
        data: { hello: 'amf' },
      })
      .then((res) => {
        expect(res.data.headers.accept).toBe(
          ajaxService.constants.application_amf
        );
        expect(res.data.headers['content-type']).toBe(
          ajaxService.constants.application_amf
        );
        expect(res.data.body.hello).toBe('amf');
      });
  });
  it('supports text/plain ajaxService calls', () => {
    expect.assertions(2);
    return ajaxService()
      .post<EchoData>({
        url: 'echo',
        accept: ajaxService.constants.application_json,
        contentType: ajaxService.constants.text_plain,
        data: 'this is some text',
      })
      .then((res) => {
        expect(res.data.headers['content-type']).toBe(
          ajaxService.constants.text_plain
        );
        expect(res.data.body).toBe('this is some text');
      });
  });
  it('it uses the accept type from headers', () => {
    expect.assertions(3);
    return ajaxService()
      .post<EchoData>({
        url: 'echo',
        contentType: ajaxService.constants.application_amf,
        data: {
          hello: 'world',
        },
        headers: {
          accept: ajaxService.constants.application_json,
        },
      })
      .then((res) => {
        expect(res.data.headers.accept).toBe(
          ajaxService.constants.application_json
        );
        expect(res.data.headers['content-type']).toBe(
          ajaxService.constants.application_amf
        );
        expect(res.data.body.hello).toBe('world');
      });
  });
  describe('retries with exponential back-off', () => {
    it('eventually succeeds', () => {
      expect.assertions(2);
      const requestId = `testSucceeds${Math.floor(Math.random() * 1000)}`;
      return ajaxService()
        .post<EchoData>({
          url: 'retry',
          contentType: ajaxService.constants.application_amf,
          data: {
            id: requestId,
            respondIn: 2,
          },
          headers: {
            accept: ajaxService.constants.application_json,
          },
        })
        .then((res) => {
          expect(res.status).toBe(200);
          expect(res.data.status).toBe('success');
        });
    });
    it('does not retry for amf deserialization errors', () => {
      expect.assertions(1);
      const requestId = `testAmfDeserializationError${Math.floor(
        Math.random() * 1000
      )}`;
      return ajaxService()
        .post({
          url: 'retry',
          contentType: ajaxService.constants.application_amf,
          data: {
            id: requestId,
            respondIn: 2,
            badResponseSerialization: true,
          },
          headers: {
            accept: ajaxService.constants.application_amf,
          },
        })
        .catch((err) => {
          expect(err.message).toMatch(/AMF/i);
        });
    });
    it('retries for dns resolution errors', () => {
      expect.assertions(2);
      return ajaxService()
        .post({
          url: 'http://expectthisdoesnexist',
          contentType: ajaxService.constants.application_amf,
          retry: {
            attempts: 2,
          },
          data: {},
          headers: {
            accept: ajaxService.constants.application_json,
          },
        })
        .catch((err) => {
          expect(err.code).toBe('ENOTFOUND');
          expect(err.retryAttemptNumber).toBe(2);
        });
    });
    it('retries for connect errors', () => {
      expect.assertions(2);
      return ajaxService()
        .post({
          url: 'http://localhost:9009',
          contentType: ajaxService.constants.application_amf,
          retry: {
            attempts: 2,
          },
          data: {},
          headers: {
            accept: ajaxService.constants.application_json,
          },
        })
        .catch((err) => {
          expect(err.code).toBe('ECONNREFUSED');
          expect(err.retryAttemptNumber).toBe(2);
        });
    });
    it('does not retry for 404', () => {
      expect.assertions(2);
      return ajaxService()
        .post({
          url: '/notfound',
          retry: {
            attempts: 2,
          },
          data: {},
        })
        .catch((err) => {
          // should be 'tryAttemptNumber' maybe?
          expect(err.retryAttemptNumber).toBe(1);
          expect(err.status).toBe(404);
        });
    });
    it('fails if numOfAttempts is exceeded', () => {
      expect.assertions(1);
      const requestId = `testFails${Math.floor(Math.random() * 1000)}`;
      return ajaxService()
        .post({
          url: 'retry',
          contentType: ajaxService.constants.application_amf,
          retry: {
            attempts: 2,
          },
          data: {
            id: requestId,
            respondIn: 3,
          },
          headers: {
            accept: ajaxService.constants.application_json,
          },
        })
        .catch((err) => {
          expect(err.status).toBe(503);
        });
    });
  });
  describe('interceptors', () => {
    it('can intercept before the request', () => {
      expect.assertions(1);
      let counter = 0;
      return ajaxService([
        {
          onRequest: (opts, { next }) => {
            opts.url = opts.url.replace(/notecho/, 'echo');
            counter++;
            return next(opts);
          },
        },
      ])
        .post({ url: '/notecho' })
        .then(() => {
          expect(counter).toBe(1);
        });
    });
    it('can intercept the response', () => {
      expect.assertions(2);
      let counter = 0;
      return ajaxService([
        {
          onResponse: ({ res }) => {
            expect(res).toBeDefined();
            counter++;
          },
        },
      ])
        .post({ url: '/echo' })
        .then(() => {
          expect(counter).toBe(1);
        });
    });
    it('can cancel requests', () => {
      expect.assertions(3);
      let ranProm = false;
      let caughtErr = null;
      let cancelFn = jest.fn();
      ajaxService([
        {
          onRequest: (req, { cancel }) => {
            return cancel();
          },
          onCancel: cancelFn,
        },
      ])
        .post({ url: '/echo' })
        .then(() => {
          ranProm = true;
        })
        .catch((err) => {
          caughtErr = err;
        });
      return delay(100).then(() => {
        expect(cancelFn).toHaveBeenCalled();
        expect(ranProm).toBe(false);
        expect(caughtErr.message).toBe('cancelled');
      });
    });
    it('can cancel responses while retrying', () => {
      expect.assertions(2);
      const requestId = `testRetryCancel${Math.floor(Math.random() * 1000)}`;
      let ranProm = null;
      let caughtErr = null;
      let attempts = 0;
      ajaxService([
        {
          onRequest: (req, { cancel, next }) => {
            attempts++;
            ranProm = false;
            if (attempts === 2) {
              return cancel();
            }
            return next(req);
          },
        },
      ])
        .post({
          url: '/retry',
          data: {
            id: requestId,
            respondIn: 4,
          },
          retry: {
            attempts: 3,
          },
        })
        .then(() => {
          ranProm = true;
        })
        .catch((err) => {
          caughtErr = err;
        });
      return delay(200).then(() => {
        expect(ranProm).toBe(false);
        expect(caughtErr.message).toBe('cancelled');
      });
    });
    it('can cancel retry attempts', () => {
      expect.assertions(2);
      const requestId = `testRetryCancelAttempt${Math.floor(
        Math.random() * 1000
      )}`;
      let cancelledOnAttempt = 0;
      return ajaxService([
        {
          onRetry: ({ attemptNumber, cancelRetry }) => {
            cancelledOnAttempt = attemptNumber;
            if (attemptNumber === 2) {
              cancelRetry();
            }
          },
        },
      ])
        .post({
          url: '/retry',
          data: {
            id: requestId,
            respondIn: 4,
          },
          retry: {
            attempts: 3,
          },
        })
        .catch((err) => {
          expect(cancelledOnAttempt).toBe(2);
          expect(err).toBeDefined();
        });
    });
    it('accepts interceptors from the request opts', () => {
      expect.assertions(2);
      let counterFromInstanceLevel = 0;
      let counter = 0;
      return ajaxService([
        {
          onRequest: async (req, { next }) => {
            const res = next(req);
            counterFromInstanceLevel++;
            return res;
          },
        },
      ])
        .post({
          url: '/echo',
          configs: [
            {
              onRequest: async (req, { next }) => {
                const res = next(req);
                counter++;
                return res;
              },
            },
          ],
        })
        .then(() => {
          expect(counter).toBe(1);
          expect(counterFromInstanceLevel).toBe(1);
        });
    });
    it('intercepts requests', async () => {
      const capture = [];
      let counter = 0;
      await ajaxService([
        {
          onRequest: async (opts, { next }) => {
            try {
              capture.push(`before:${counter++}`);
              return next(opts);
            } finally {
              capture.push(`after:${counter++}`);
            }
          },
        },
      ]).post({
        url: '/echo',
      });
      console.log(capture);
    });
    it('can return promise from interceptor', () => {
      expect.assertions(2);
      let initTime = new Date().getTime();
      const interceptorTimeoutRan: Record<string, number> = {};
      const timeout1 = 50;
      const timeout2 = 50;
      return ajaxService([
        {
          onRequest: (opts, { next }) => {
            return new Promise<void>((resolve) => {
              setTimeout(() => {
                interceptorTimeoutRan['1'] = new Date().getTime();
                resolve();
              }, timeout1);
            }).then(() => next(opts));
          },
        },
        {
          onRequest: (opts, { next }) => {
            return new Promise<void>((resolve) => {
              setTimeout(() => {
                interceptorTimeoutRan['2'] = new Date().getTime();
                resolve();
              }, timeout2);
            }).then(() => next(opts));
          },
        },
      ])
        .post({
          url: '/echo',
        })
        .then(() => {
          const timeNow = new Date().getTime();
          expect(
            interceptorTimeoutRan['2'] - interceptorTimeoutRan['1']
          ).toBeGreaterThan(timeout1);
          expect(timeNow - initTime).toBeGreaterThan(timeout1 + timeout2);
        });
    });
  });
});

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
