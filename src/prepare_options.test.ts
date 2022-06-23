import constants from './constants';
import prepareOptions, {
  prepareCredentials,
  prepareUrl,
} from './prepare_options';

describe('prepareOptions', () => {
  describe('urls', () => {
    it('appends the origin if no base url provided', () => {
      expect(prepareUrl({ url: '/foo' }).url).toMatch(
        /http:\/\/localhost:[^/]+\/foo/
      );
    });
    it('uses fully qualified urls', () => {
      expect(prepareUrl({ url: 'http://foo.com/foo' }).url).toBe(
        'http://foo.com/foo'
      );
    });
  });
  describe('headers', () => {
    const defaultHeaders = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    it('sets default accept and content-type headers', () => {
      expect(prepareOptions({ url: '/' }).headers).toEqual(expect.objectContaining(defaultHeaders));
      expect(
        prepareOptions({ url: '/', headers: { accept: 'something' } }).headers
      ).toEqual(expect.objectContaining({
        ...defaultHeaders,
        accept: 'something',
      }));
    });
    it('accepts contentType for content-type', () => {
      expect(
        prepareOptions({
          url: '/',
          contentType: 'something',
        }).headers
      ).toEqual(expect.objectContaining({
        ...defaultHeaders,
        'content-type': 'something',
      }));
    });
  });
  describe('body', () => {
    it('injects the request origin as a header', () => {
      expect(
        prepareOptions({
          url: '/',
          data: {},
        }).headers[constants.request_origin]
      ).toMatch(/http:\/\/localhost:[^/]+/);
    });
    it('serializes amf content', () => {
      expect(
        prepareOptions({
          url: '/',
          data: {},
          contentType: 'application/x-amf',
        }).body[0]
      ).toBe(10);
    });
  });
  describe('credentials', () => {
    it('can set the credentials option', () => {
      expect(
        prepareCredentials({
          credentials: 'omit',
        }).credentials
      ).toBe('omit');
    });
    it('defaults to include for private network hosts', () => {
      ['localhost', '127.0.0.1', '192.168.1.2', '10.1.2.3'].forEach((host) => {
        expect(
          prepareCredentials({
            url: `http://${host}/something`,
          }).credentials
        ).toBe('include');
      });
      ['foo.foo.com', '178.1.2.3'].forEach((host) => {
        expect(
          prepareCredentials({
            url: `http://${host}/something`,
          }).credentials
        ).toBe('same-origin');
      });
    });
    it('defaults to include for common base domains', () => {
      expect(
        prepareCredentials({
          url: 'http://foo.foo.com/something',
          origin: 'http://www.foo.com',
        }).credentials
      ).toBe('include');
      expect(
        prepareCredentials({
          url: 'http://test.foo.com/something',
          origin: 'http://www.something.foo.com',
        }).credentials
      ).toBe('include');
    });
  });
});
