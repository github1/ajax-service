const retryState = {};
module.exports = app => {
    app.post('/echo', (req, res) => {
        res.type('application/json');
        res.header('access-control-allow-origin', req.body['request.origin']);
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
      res.type('application/json');
      if (retryState[req.body.id].attempts >= retryState[req.body.id].respondIn) {
        res.status(200);
        res.send({ status: 'success' });
      } else {
        res.status(503);
        res.send({});
      }
    });
};
