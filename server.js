/*jslint node: true */
'use strict';

var winston = require('winston'),
    express = require('express'),
    expressJoi = require('express-joi-validator'),
    expressWinston = require('express-winston'),
    bodyparser = require('body-parser'),
    mqtt = require('mqtt'),
    async = require('async'),
    path = require('path'),
    joi = require('joi'),
    yaml = require('js-yaml'),
    jsonfile = require('jsonfile'),
    fs = require('fs'),
    request = require('request');

var config = yaml.safeLoad(fs.readFileSync('config.yml')),
    app = express(),
    client,
    subscription,
    history = {};

/**
 * Handle Device Change/Push event from SmartThings
 *
 * @method handlePushEvent
 * @param  {Request} req
 * @param  {Object}  req.body
 * @param  {String}  req.body.name  Device Name (e.g. "Bedroom Light")
 * @param  {String}  req.body.type  Device Property (e.g. "state")
 * @param  {String}  req.body.value Value of device (e.g. "on")
 * @param  {Result}  res            Result Object
 */
function handlePushEvent(req, res) {
    var topic = ['', 'smartthings', req.body.name, req.body.type].join('/'),
        value = req.body.value;

    winston.info('Incoming message from SmartThings to ' + topic + ' ' + value);

    if (history[topic] === value) {
        winston.info('Skipping duplicate message');

        return res.send({
            'status': 'DUPLICATE'
        });
    }
    history[topic] = value;

    client.publish(topic, value, {
        retain: true
    }, function () {
        res.send({
            'status': 'OK'
        });
    });
}

/**
 * Handle Subscribe event from SmartThings
 *
 * @method handleSubscribeEvent
 * @param  {Request} req
 * @param  {Object}  req.body
 * @param  {Object}  req.body.devices  List of properties => device names
 * @param  {String}  req.body.callback Host and port for SmartThings Hub
 * @param  {Result}  res               Result Object
 */
function handleSubscribeEvent(req, res) {
    subscription = {
        topics: [],
        callback: ''
    };

    // Subscribe to all events
    Object.keys(req.body.devices).forEach(function (type) {
        req.body.devices[type].forEach(function (device) {
            subscription.topics.push(['', 'smartthings', device, type].join('/'));
        });
    });

    // Store callback
    subscription.callback = req.body.callback;

    // Store config on disk
    jsonfile.writeFile('subscription.json', subscription, function () {
        // Turtles
        winston.info('Subscribing to ' + subscription.topics.join(', '));
        client.subscribe(subscription.topics, function () {
            // All the way down
            res.send({
                'status': 'OK'
            });
        });
    });
}

/**
 * Parse incoming message from MQTT
 * @method parseMQTTMessage
 * @param  {String} topic   Topic channel the event came from
 * @param  {String} message Contents of the event
 */
function parseMQTTMessage (topic, message) {
    winston.info('Incoming message from: ' + topic, message.toString());

    if (history[topic] === message.toString()) {
        winston.info('Skipping duplicate message');
        return;
    }
    history[topic] = message.toString();

    var pieces = topic.split('/'),
        name = pieces[2],
        type = pieces[3];

    request.post({
        url: 'http://' + subscription.callback,
        json: {
            name: name,
            type: type,
            value: message.toString()
        }
    }, function (error, resp) {
        // @TODO handle the response from SmartThings
        winston.log(error, resp.statusCode);
    });
}

// Main flow
async.series([
    function connectToMQTT(next) {
        winston.info('Connecting to MQTT');
        client = mqtt.connect('mqtt://' + config.mqtt.host);
        client.on('connect', function () {
            next();
            // @TODO Not call this twice if we get disconnected
            next = function () {};
        });
        client.on('message', parseMQTTMessage);
    },
    function loadSavedSubscriptions(next) {
        winston.info('Loading Saved Subscriptions');
        jsonfile.readFile('subscription.json', function (error, config) {
            if (error) {
                winston.warn('No stored subscription found');
                return next();
            }
            subscription = config;
            client.subscribe(subscription.topics, next);
        });
    },
    function setupApp(next) {
        winston.info('Configuring API');
        // Accept JSON
        app.use(bodyparser.json());

        // Log all requests to disk
        app.use(expressWinston.logger({
            transports: [
                new winston.transports.File({
                    filename: path.join(process.cwd(), 'access.log'),
                    json: false
                })
            ]
        }));

        // Push event from SmartThings
        app.post('/push',
            expressJoi({
                body: {
                    //   "name": "Energy Meter",
                    name: joi.string().required(),
                    //   "value": "873",
                    value: joi.string().required(),
                    //   "type": "power",
                    type: joi.string().required()
                }
            }), handlePushEvent);

        // Subscribe event from SmartThings
        app.post('/subscribe',
            expressJoi({
                body: {
                    devices: joi.object().required(),
                    callback: joi.string().required()
                }
            }), handleSubscribeEvent);

        // Log all errors to disk
        app.use(expressWinston.errorLogger({
            transports: [
                new winston.transports.File({
                    filename: path.join(process.cwd(), 'error.log'),
                    json: false
                })
            ]
        }));

        // Proper error messages with Joi
        app.use(function (err, req, res, next) {
            if (err.isBoom) {
                 return res.status(err.output.statusCode).json(err.output.payload);
            }
        });

        app.listen(config.port, next);
    }
], function (error) {
    if (error) {
        return winston.error(error);
    }
    winston.info('Listening at http://localhost:%s', config.port);
});
