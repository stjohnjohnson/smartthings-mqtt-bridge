/*global describe, it */
var server;

describe('MQTT Bridge Test Case', function () {
    describe('server', function () {
        it('start the service', function (done) {
            server = require('../server');
            done();
        });
    });
});
