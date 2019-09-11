import ajaxService from './index';

describe('ajax-service', () => {
  it('supports json ajaxService calls', () => {
    return ajaxService().post({
      url: 'echo',
      accept: ajaxService.constants.application_json,
      contentType: ajaxService.constants.application_json,
      data: {hello: 'world'}
    }).then(res => {
      expect(res.data.headers.accept).toBe(ajaxService.constants.application_json);
      expect(res.data.headers['content-type']).toBe(ajaxService.constants.application_json);
      expect(res.data.body.hello).toBe('world');
      expect(res.headers['content-type']).toMatch(/^application\/json;.*$/);
    });
  });
  it('supports amf ajaxService calls', () => {
    return ajaxService().post({
      url: 'echo',
      accept: ajaxService.constants.application_amf,
      contentType: ajaxService.constants.application_amf,
      data: {hello: 'amf'}
    }).then(res => {
      expect(res.data.headers.accept).toBe(ajaxService.constants.application_amf);
      expect(res.data.headers['content-type']).toBe(ajaxService.constants.application_amf);
      expect(res.data.body.hello).toBe('amf');
    });
  });
  it('it uses the accept type from headers', () => {
    return ajaxService().post({
      url: 'echo',
      contentType: ajaxService.constants.application_amf,
      data: {
        hello: 'world'
      },
      headers: {
        accept: ajaxService.constants.application_json
      }
    }).then(res => {
      expect(res.data.headers.accept).toBe(ajaxService.constants.application_json);
      expect(res.data.headers['content-type']).toBe(ajaxService.constants.application_amf);
      expect(res.data.body.hello).toBe('world');
    });
  });
  describe('retries with exponential back-off', () => {
    it('eventually succeeds', () => {
      const requestId = `testSucceeds${Math.floor(Math.random() * 1000)}`;
      return ajaxService().post({
        url: 'retry',
        contentType: ajaxService.constants.application_amf,
        data: {
          id: requestId,
          respondIn: 2
        },
        headers: {
          accept: ajaxService.constants.application_json
        }
      }).then(res => {
        expect(res.status).toBe(200);
        expect(res.data.status).toBe('success');
      });
    });
    it('retries for dns resolution errors', () => {
      return ajaxService().post({
        url: 'http://expectthisdoesnexist',
        contentType: ajaxService.constants.application_amf,
        numOfAttempts: 2,
        data: {},
        headers: {
          accept: ajaxService.constants.application_json
        }
      }).catch((err) => {
        expect(err.code).toBe('ENOTFOUND');
        expect(err.retryAttemptNumber).toBe(2);
      });
    });
    it('retries for connect errors', () => {
      return ajaxService().post({
        url: 'http://localhost:9009',
        contentType: ajaxService.constants.application_amf,
        numOfAttempts: 2,
        data: {},
        headers: {
          accept: ajaxService.constants.application_json
        }
      }).catch((err) => {
        expect(err.code).toBe('ECONNREFUSED');
        expect(err.retryAttemptNumber).toBe(2);
      });
    });
    it('does not retry for 404', () => {
      return ajaxService().post({
        url: '/notfound',
        numOfAttempts: 2,
        data: {}
      }).catch((err) => {
        // should be 'tryAttemptNumber' maybe?
        expect(err.retryAttemptNumber).toBe(1);
        expect(err.status).toBe(404);
      });
    });
    it('fails if numOfAttempts is exceeded', () => {
      const requestId = `testFails${Math.floor(Math.random() * 1000)}`;
      return ajaxService().post({
        url: 'retry',
        contentType: ajaxService.constants.application_amf,
        numOfAttempts: 2,
        data: {
          id: requestId,
          respondIn: 3
        },
        headers: {
          accept: ajaxService.constants.application_json
        }
      }).catch(err => {
        expect(err.status).toBe(503);
      });
    });
  });
  describe('interceptors', () => {
    it('can intercept before the request', () => {
      let counter = 0;
      return ajaxService([{
        onRequest: (opts) => {
          opts.url = opts.url.replace(/notecho/, 'echo');
          counter++;
        }
      }]).post({url: '/notecho'})
        .then(() => {
          expect(counter).toBe(1);
        });
    });
    it('can intercept the response', () => {
      let counter = 0;
      return ajaxService([{
        onResult: (res) => {
          expect(res).toBeDefined();
          counter++;
        }
      }]).post({url: '/echo'})
        .then(() => {
          expect(counter)
            .toBe(1);
        });
    });
    it('can cancel responses', () => {
      let ranProm = false;
      ajaxService([{
        onResult: (res, cancel) => {
          cancel();
        }
      }]).post({url: '/echo'})
        .then(() => {
          ranProm = true;
        });
      return delay(100)
        .then(() => expect(ranProm).toBe(false));
    });
    it('can cancel responses while retrying', () => {
      const requestId = `testRetryCancel${Math.floor(Math.random() * 1000)}`;
      let ranProm = null;
      let attempts = 0;
      ajaxService([{
        onResult: (res, cancel) => {
          attempts++;
          ranProm = false;
          if (attempts === 2) {
            cancel();
          }
        }
      }]).post({
        url: '/retry',
        data: {
          id: requestId,
          respondIn: 4
        },
        numOfAttempts: 3,
      })
        .then(() => {
          ranProm = true;
        })
        .catch(() => {
          ranProm = true;
        });
      return delay(200)
        .then(() => expect(ranProm).toBe(false));
    });
  });
});

const delay = ms => new Promise((resolve) => setTimeout(() => resolve(), ms));
