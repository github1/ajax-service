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
      expect(prepareOptions({ url: '/' }).headers).toEqual(defaultHeaders);
      expect(
        prepareOptions({ url: '/', headers: { accept: 'something' } }).headers
      ).toEqual({
        ...defaultHeaders,
        accept: 'something',
      });
    });
    it('accepts contentType for content-type', () => {
      expect(
        prepareOptions({
          url: '/',
          contentType: 'something',
        }).headers
      ).toEqual({
        ...defaultHeaders,
        'content-type': 'something',
      });
    });
  });
  describe('body', () => {
    it('injects the request origin into the body', () => {
      expect(
        JSON.parse(
          `${
            prepareOptions({
              url: '/',
              data: {},
            }).body
          }`
        )['request.origin']
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
    it('defaults to include for subdomains', () => {
      expect(
        prepareCredentials({
          url: 'http://foo.foo.com/something',
          origin: 'http://www.foo.com',
        }).credentials
      ).toBe('include');
    });
  });
});
