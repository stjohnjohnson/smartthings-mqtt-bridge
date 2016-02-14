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
    semver = require('semver'),
    request = require('request');

var CONFIG_DIR = process.env.CONFIG_DIR || process.cwd(),
    CONFIG_FILE = path.join(CONFIG_DIR, 'config.yml'),
    SAMPLE_FILE = path.join(__dirname, '_config.yml'),
    STATE_FILE = path.join(CONFIG_DIR, 'state.json'),
    EVENTS_LOG = path.join(CONFIG_DIR, 'events.log'),
    ACCESS_LOG = path.join(CONFIG_DIR, 'access.log'),
    ERROR_LOG = path.join(CONFIG_DIR, 'error.log'),
    CURRENT_VERSION = require('./package').version;

var app = express(),
    client,
    subscriptions = [],
    callback = '',
    config = {},
    history = {};

// Write all events to disk as well
winston.add(winston.transports.File, {
    filename: EVENTS_LOG,
    json: false
});

/**
 * Load user configuration (or create it)
 * @method loadConfiguration
 * @return {Object} Configuration
 */
function loadConfiguration () {
    if (!fs.existsSync(CONFIG_FILE)) {
        winston.info('No previous configuration found, creating one');
        fs.writeFileSync(CONFIG_FILE, fs.readFileSync(SAMPLE_FILE));
    }

    return yaml.safeLoad(fs.readFileSync(CONFIG_FILE));
}

/**
 * Load the saved previous state from disk
 * @method loadSavedState
 * @return {Object} Configuration
 */
function loadSavedState () {
    var output;
    try {
        output = jsonfile.readFileSync(STATE_FILE);
    } catch (ex) {
        winston.info('No previous state found, continuing');
        output = {
            subscriptions: [],
            callback: '',
            history: {},
            version: '0.0.0'
        };
    }
    return output;
}

/**
 * Resubscribe on a periodic basis
 * @method saveState
 */
function saveState () {
    winston.info('Saving current state');
    jsonfile.writeFileSync(STATE_FILE, {
        subscriptions: subscriptions,
        callback: callback,
        history: history,
        version: CURRENT_VERSION
    }, {
        spaces: 4
    });
}

/**
 * Migrate the configuration from the current version to the latest version
 * @method migrateState
 * @param  {String}     version Version the state was written in before
 */
function migrateState (version) {
    // This is the previous default, but it's totally wrong
    if (config.mqtt && !config.mqtt.preface) {
        config.mqtt.preface = '/smartthings';
    }

    // Stuff was previously in subscription.json, load that and migrate it
    var SUBSCRIPTION_FILE = path.join(CONFIG_DIR, 'subscription.json');
    if (semver.lt(version, '1.1.0') && fs.existsSync(SUBSCRIPTION_FILE)) {
        var oldState = jsonfile.readFileSync(SUBSCRIPTION_FILE);
        callback = oldState.callback;
        subscriptions = oldState.topics;
    }

    saveState();
}

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
function handlePushEvent (req, res) {
    var topic = getTopicFor(req.body.name, req.body.type),
        value = req.body.value;

    winston.info('Incoming message from SmartThings: %s = %s', topic, value);
    history[topic] = value;

    client.publish(topic, value, {
        retain: true
    }, function () {
        res.send({
            status: 'OK'
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
function handleSubscribeEvent (req, res) {
    // Subscribe to all events
    subscriptions = [];
    Object.keys(req.body.devices).forEach(function (property) {
        req.body.devices[property].forEach(function (device) {
            subscriptions.push(getTopicFor(device, property));
        });
    });

    // Store callback
    callback = req.body.callback;

    // Store current state on disk
    saveState(function (next) {
        // Turtles
        winston.info('Subscribing to ' + subscriptions.join(', '));
        client.subscribe(subscriptions, function () {
            // All the way down
            res.send({
                status: 'OK'
            });
        });
    });
}

/**
 * Get the topic name for a given item
 * @method getTopicFor
 * @param  {String}    device   Device Name
 * @param  {String}    property Property
 * @return {String}             MQTT Topic name
 */
function getTopicFor (device, property) {
    return [config.mqtt.preface, device, property].join('/');
}

/**
 * Parse incoming message from MQTT
 * @method parseMQTTMessage
 * @param  {String} topic   Topic channel the event came from
 * @param  {String} message Contents of the event
 */
function parseMQTTMessage (topic, message) {
    var contents = message.toString();
    if (history[topic] === contents) {
        winston.debug('Skipping duplicate message from: %s = %s', topic, contents);
        return;
    }
    winston.info('Incoming message from MQTT: %s = %s', topic, contents);
    history[topic] = contents;

    // Remove the preface from the topic before splitting it
    var pieces = topic.substr(config.mqtt.preface.length + 1).split('/'),
        device = pieces[0],
        property = pieces[1];


    // If sending level data and the switch is off, don't send anything
    // SmartThings will turn the device on (which is confusing)
    if (property === 'level' && history[getTopicFor(device, 'switch')] === 'off') {
        winston.info('Skipping level set due to device being off');
        return;
    }

    // If sending switch data and there is already a level value, send level instead
    // SmartThings will turn the device on
    if (property === 'switch' && contents === 'on' && history[getTopicFor(device, 'level')] !== undefined) {
        winston.info('Passing level instead of switch on');
        property = 'level';
        contents = history[getTopicFor(device, 'level')];
    }

    request.post({
        url: 'http://' + callback,
        json: {
            name: device,
            type: property,
            value: contents
        }
    }, function (error, resp) {
        if (error) {
            // @TODO handle the response from SmartThings
            winston.error('Error from SmartThings Hub: %s', error.toString());
            winston.error(JSON.stringify(error, null, 4));
            winston.error(JSON.stringify(resp, null, 4));
        }
    });
}

// Main flow
async.series([
    function loadFromDisk (next) {
        var state;

        winston.info('Loading configuration');
        config = loadConfiguration();

        winston.info('Loading previous state');
        state = loadSavedState();
        callback = state.callback;
        subscriptions = state.subscriptions;
        history = state.history;

        winston.info('Perfoming configuration migration');
        migrateState(state.version);

        process.nextTick(next);
    },
    function connectToMQTT (next) {
        winston.info('Connecting to MQTT');

        client = mqtt.connect('mqtt://' + config.mqtt.host);
        client.on('message', parseMQTTMessage);
        client.on('connect', function () {
            client.subscribe(subscriptions);
            next();
            // @TODO Not call this twice if we get disconnected
            next = function () {};
        });
    },
    function configureCron (next) {
        winston.info('Configuring autosave');

        // Save current state every 15 minutes
        setInterval(saveState, 15 * 60 * 1000);

        process.nextTick(next);
    },
    function setupApp (next) {
        winston.info('Configuring API');

        // Accept JSON
        app.use(bodyparser.json());

        // Log all requests to disk
        app.use(expressWinston.logger({
            transports: [
                new winston.transports.File({
                    filename: ACCESS_LOG,
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
                    filename: ERROR_LOG,
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

        app.listen(8080, next);
    }
], function (error) {
    if (error) {
        return winston.error(error);
    }
    winston.info('Listening at http://localhost:8080');
});
