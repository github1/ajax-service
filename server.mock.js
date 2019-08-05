module.exports = app => {
    app.post('/echo', (req, res) => {
        res.type('application/json');
        res.send(Object.assign({},
            {headers: req.headers},
            {body: req.body}));
    });
};