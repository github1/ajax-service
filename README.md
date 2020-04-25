# @github1/ajax-service

Library for invoking HTTP requests for JSON and AMF media types

[![build status](https://img.shields.io/travis/github1/ajax-service/master.svg?style=flat-square)](https://travis-ci.org/github1/ajax-service)
[![npm version](https://img.shields.io/npm/v/@github1/ajax-service.svg?style=flat-square)](https://www.npmjs.com/package/@github1/ajax-service)
[![npm downloads](https://img.shields.io/npm/dm/@github1/ajax-service.svg?style=flat-square)](https://www.npmjs.com/package/@github1/ajax-service)

## Install
```shell
npm install @github1/ajax-service --save
```

## Usage

```javascript
import ajaxService from '@github1/ajax-service';

const res = await ajaxService().post({
  url: 'echo',
  accept: 'application/json',
  data: {hello: 'world'}
});

console.log('headers', res.data.headers);
console.log('body', res.data.body);
```

## License
[MIT](LICENSE.md)