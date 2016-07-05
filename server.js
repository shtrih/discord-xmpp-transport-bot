var http = require('http'),
    fs = require('fs');

exports.start = function (port, ip) {
    port = port || process.env.OPENSHIFT_NODEJS_PORT || 8080;
    ip = ip || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

    http.createServer(function (request, response) {
        response.writeHead(200);
        fs.createReadStream('./index.html').pipe(response);
    }).listen(port, ip, function() {
        console.log('%s: Node server started on %s:%d ...', Date(Date.now()), ip, port);
    });
};
