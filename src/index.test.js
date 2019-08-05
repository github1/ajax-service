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
        });
    });
    it('supports amf ajaxService calls', () => {
        return ajaxService().post({
            url: 'echo',
            accept: ajaxService.constants.application_amf,
            contentType: ajaxService.constants.application_amf,
            data: {hello: 'world'}
        }).then(res => {
            expect(res.data.headers.accept).toBe(ajaxService.constants.application_amf);
            expect(res.data.headers['content-type']).toBe(ajaxService.constants.application_amf);
            expect(res.data.body.hello).toBe('world');
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
});