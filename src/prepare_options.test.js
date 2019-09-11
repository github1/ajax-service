import prepareOptions from './prepare_options';

describe('prepareOptions', () => {
  describe('urls', () => {
    it('appends the origin if no base url provided', () => {
      expect(prepareOptions({url: '/foo'}).url).toMatch(/http:\/\/localhost:[^/]+\/foo/);
    });
    it('uses fully qualified urls', () => {
      expect(prepareOptions({url: 'http://foo.com/foo'}).url).toBe('http://foo.com/foo');
    });
  });
  describe('headers', () => {
    const defaultHeaders = {
      accept: 'application/json',
      'content-type': 'application/json'
    };
    it('sets default accept and content-type headers', () => {
      expect(prepareOptions({url: '/'}).headers).toEqual(defaultHeaders);
      expect(prepareOptions({url: '/', accept: 'something'}).headers).toEqual({
        ...defaultHeaders,
        accept: 'something'
      });
    });
    it('accepts contentType for content-type', () => {
      expect(prepareOptions({
        url: '/',
        contentType: 'something'
      }).headers).toEqual({
        ...defaultHeaders,
        'content-type': 'something'
      });
    });
  });
  describe('body', () => {
    it('injects the request origin into the body', () => {
      expect(JSON.parse(prepareOptions({
        url: '/',
        data: {}
      }).body)['request.origin']).toMatch(/http:\/\/localhost:[^/]+/);
    });
    it('serializes amf content', () => {
      expect(prepareOptions({
        url: '/',
        data: {},
        contentType: 'application/x-amf'
      }).body[0]).toBe(10);
    });
  });
});
