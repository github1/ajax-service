const retryState = {};
module.exports = app => {
    app.use((req, res, next) => {
      console.log('test-server', req.url, req.headers);
      next();
    });
    app.post('/echo', (req, res) => {
        res.type('application/json');
        res.header('access-control-allow-origin', req.headers['x-request-origin']);
        res.header('access-control-allow-headers', '*');
        res.send(Object.assign({},
            {headers: req.headers},
            {body: req.body}));
    });
    app.post('/retry', (req, res) => {
      if (retryState[req.body.id]) {
        retryState[req.body.id].attempts++;
      } else {
        retryState[req.body.id] = req.body;
        retryState[req.body.id].attempts = 0;
      }
      const isSuccess = retryState[req.body.id].attempts >= retryState[req.body.id].respondIn;
      res.header('x-should-be-success', isSuccess);
      if (req.header('accept') === 'application/x-amf') {
        res.type('application/x-amf');
        if (isSuccess) {
          res.status(200);
          res.send({ status: 'success' });
        } else {
          if (req.body.badResponseSerialization) {
            // Intentionally send unserializable data
            res.status(200);
            res.send(new Uint8Array(Buffer.from('A', 'base64')).buffer);
          } else {
            res.status(503);
            res.send({});
          }
        }
      } else {
        res.type('application/json');
        if (isSuccess) {
          res.status(200);
          res.send({ status: 'success' });
        } else {
          res.status(503);
          res.send({});
        }
      }
    });
};
