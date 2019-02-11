/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const async = require('async');
const _ = require('lodash');
const request = require('request');
const WebSocket = require('ws');
const debug = require('debug')('ws');
const debugRequests = require('debug')('http:request');
const engineUtil = require('./engine_util');
const template = engineUtil.template;
const Palindrom = require('palindrom');
const jpath = require('json-path');

module.exports = PalindromEngine;

function PalindromEngine(script) {
    this.config = script.config;
}

PalindromEngine.prototype.createScenario = function (scenarioSpec, ee) {
    var self = this;
    let tasks = _.map(scenarioSpec.flow, function (rs) {
        if (rs.think) {
            return engineUtil.createThink(rs, _.get(self.config, 'defaults.think', {}));
        }
        return self.step(rs, ee);
    });

    return self.compile(tasks, scenarioSpec.flow, ee);
};

PalindromEngine.prototype.step = function (requestSpec, ee) {
    let self = this;
    let config = this.config;

    if (requestSpec.loop) {
        let steps = _.map(requestSpec.loop, function (rs) {
            return self.step(rs, ee);
        });

        return engineUtil.createLoopWithCount(
            requestSpec.count || -1,
            steps,
            {
                loopValue: requestSpec.loopValue || '$loopCount',
                overValues: requestSpec.over,
                whileTrue: self.config.processor ?
                    self.config.processor[requestSpec.whileTrue] : undefined
            });
    }

    if (requestSpec.think) {
        return engineUtil.createThink(requestSpec, _.get(self.config, 'defaults.think', {}));
    }

    if (requestSpec.function) {
        return function (context, callback) {
            let processFunc = self.config.processor[requestSpec.function];

            if (!processFunc) {
                throw "Function " + requestSpec.function + " is not defined";
            }

            try {
                processFunc(context, ee, function () {
                    callback(null, context);
                });
            } catch (err) {
                const message = err.message || err.code || err;
                ee.emit("error", message);
                callback(message, context);
            }
        };
    }

    if (requestSpec.updateModelFunction) {
        return function (context, callback) {
            ee.emit("request");

            const processFunc = waitForResponse(context, config, ee, callback, self, requestSpec.updateModelFunction, true)

            try {
                processFunc(context, ee, context.palindrom.obj);
            } catch (err) {
                const message = err.message || err.code || err;
                ee.emit("error", message);
                callback(message, context);
            }
        };
    }

    if (requestSpec.trigger) {
        return function (context, callback) {
            ee.emit("request");

            let query = waitForResponse(context, config, ee, callback, self, requestSpec.trigger, false);

            //console.log(query)
            try {
                let queryPart = query.substr(0, query.lastIndexOf("/"));
                let variablePart = query.substr(query.lastIndexOf("/") + 1);

                let currentViewModel = context.palindrom.obj;

                let matchingArray = jpath.resolve(currentViewModel, queryPart);
                if (matchingArray && matchingArray.length > 0) {
                    matchingArray[0][variablePart]++;
                }
                else {
                    throw "Invalid selector exception: can't find `" + query + "` in Json: " + JSON.stringify(currentViewModel);
                }
            } catch (err) {
                const message = err.message || err.code || err;
                ee.emit("error", message);
                callback(message, context);
            }
        };
    }

    if (requestSpec.update) {
        return function (context, callback) {
            ee.emit("request");

            let obj = waitForResponse(context, config, ee, callback, self, requestSpec.update, false);

            try {
                let currentViewModel = context.palindrom.obj;
                _.each(obj, function (value, key) {
                    let queryPart = key.substr(0, key.lastIndexOf("/"));
                    let variablePart = key.substr(key.lastIndexOf("/") + 1);

                    let matchingArray = jpath.resolve(currentViewModel, queryPart);
                    if (matchingArray && matchingArray.length > 0) {
                        if (value && typeof value === "string" && value.indexOf('{{') !== -1) {
                            value = value.replace(/[{ }]/g, "");
                            value = context.vars[value];
                        }
                        matchingArray[0][variablePart] = value;
                    }
                    else {
                        throw "Invalid selector exception: can't find `" + key + "` in Json: " + JSON.stringify(currentViewModel);
                    }
                });
            } catch (err) {
                const message = err.message || err.code || err;
                ee.emit("error", message);
                callback(message, context);
            }
        };
    }

    if (requestSpec.morphUrl) {
        return function (context, callback) {
            ee.emit("request");

            const originalOnStateReset = context.palindrom.onStateReset;
            const payload = template(requestSpec.morphUrl, context);
            const timeoutMs = config.timeout || _.get(config, "palindrom.timeout") || 500;
            const requestTimeout = setTimeout(function () {
                context.palindrom.onStateReset = originalOnStateReset;

                const err = "Failed to process URL morphing to " + payload + " within timeout of " + timeoutMs + "ms";
                ee.emit("error", err);
                callback(err, context);

                context.palindrom.network._ws.close();
            }, timeoutMs);

            const startedAt = process.hrtime();
            const url = new URL(payload, config.target);

            context.palindrom.onStateReset = function (newObj) {
                clearTimeout(requestTimeout);

                originalOnStateReset(newObj);
                context.palindrom.onStateReset = originalOnStateReset;

                const endedAt = process.hrtime(startedAt);
                const delta = (endedAt[0] * 1e9) + endedAt[1];
                ee.emit("response", delta, 0, context._uid);

                callback(null, context);
            };

            debug("morphUrl: ", url);
            context.palindrom.network.getPatchUsingHTTP(url.toString());
        };
    }

    console.error("Not supported flow item: ", requestSpec);

    return function (context, callback) {
        return callback(null, context);
    };
};

PalindromEngine.prototype.compile = function (tasks, scenarioSpec, ee) {
    let config = this.config;

    return function scenario(initialContext, callback) {
        function zero(callback) {
            const tls = config.tls || {};
            const options = _.extend(tls, config.palindrom);
            const headers = _.get(config, 'palindrom.headers', {});

            ee.emit('started');

            headers.Accept = headers.Accept || "text/html";

            request({ url: config.target, headers: headers }, function (error, response, body) {
                if (error) {
                    const message = error.message || error.code || error;
                    ee.emit("error", message);
                    return callback(message, initialContext);
                }

                const regex = /[<](palindrom|puppet)-client .*?remote-url=["](.*?)["].*?[<][/](palindrom|puppet)-client[>]/gi;
                const regexResult = regex.exec(response.body);

                if (!regexResult || regexResult.length != 4) {
                    const message = "Unable to establish Palindrom connection, <(palindrom|puppet)-client> HTML element was not found";
                    ee.emit("error", message);
                    return callback(message, initialContext);
                }

                const remoteUrl = new URL(regexResult[2], config.target);
                const localVersionPath = options.localVersionPath || '/_ver#c$';
                const remoteVersionPath = options.remoteVersionPath || '/_ver#s';
                const palindrom = new Palindrom({
                    "useWebSocket": true,
                    "debug": false,
                    "localVersionPath": localVersionPath,
                    "remoteVersionPath": remoteVersionPath,
                    "ot": true,
                    "purity": false,
                    "pingIntervalS": options.pingIntervalS || 60,
                    "path": '/',
                    "devToolsOpen": false,
                    remoteUrl: remoteUrl.toString(),
                    onStateReset: function (obj) {
                        debug("Palindrom.onStateReset: " + remoteUrl);
                        initialContext.palindrom = palindrom;
                    },
                    onSocketOpened: function () {
                        debug("Palindrom.onSocketOpened: " + remoteUrl);
                        return callback(null, initialContext);
                    },
                    onError: function (err) {
                        const message = error.message || error.code || error;

                        debug("Palindrom.onError: ", message);
                        ee.emit("error", message);
                        return callback(message, initialContext);
                    },
                    onPatchSent: function () {
                        debug("Palindrom.onPatchSent: ", arguments);
                    },
                    onPatchReceived: function () {
                        debug("Palindrom.onPatchReceived: ", arguments);
                    },
                    onConnectionError: function (err) {
                        if (initialContext.palindromConnectionClosed) {
                            return;
                        }

                        const message = error.message || error.code || error;

                        debug("Palindrom.onConnectionError: ", JSON.stringify(err));
                        ee.emit("error", message);
                        return callback(message, initialContext);
                    }
                });

                initialContext.getPalindromLocalVersion = function () {
                    return palindrom.queue.localVersion;
                };

                initialContext.getPalindromAckLocalVersion = function () {
                    return palindrom.queue.ackLocalVersion;
                };

                initialContext.getPalindromRemoteVersion = function () {
                    return palindrom.queue.remoteVersion;
                };
            });
        }

        initialContext._successCount = 0;

        let steps = _.flatten([
            zero,
            tasks
        ]);

        async.waterfall(
            steps,
            function scenarioWaterfallCb(err, context) {
                if (err) {
                    debug(err);
                }

                if (context && context.palindrom && context.palindrom.network && context.palindrom.network._ws) {
                    context.palindromConnectionClosed = true;
                    context.palindrom.network._ws.close();
                }

                return callback(err, context);
            }
        );
    };
};

function waitForResponse(context, config, ee, callback, self, action, isFunc) {
    const originalOnRemoteChange = context.palindrom.onRemoteChange;
    const timeoutMs = config.timeout || _.get(config, "palindrom.timeout") || 500;
    const requestTimeout = setTimeout(function () {
        context.palindrom.onRemoteChange = originalOnRemoteChange;

        const err = "Failed to process request " + action + " within timeout of " + timeoutMs + "ms";
        ee.emit("error", err);
        callback(err, context);

        context.palindrom.network._ws.close();
    }, timeoutMs);

    const startedAt = process.hrtime();
    const processAction = isFunc === true ? self.config.processor[action] : action;
    if (!processAction) {
        throw action + " not found.";
    }

    context.palindrom.onRemoteChange = function (patches, results) {
        originalOnRemoteChange(patches, results);

        const localVersion = context.getPalindromLocalVersion();
        const ackLocalVersion = context.getPalindromAckLocalVersion();

        if (ackLocalVersion < localVersion) {
            // If the remote local version is yet to reach the local
            // version our model update is yet to be processed.
            return;
        }

        clearTimeout(requestTimeout);

        context.palindrom.onRemoteChange = originalOnRemoteChange;

        const endedAt = process.hrtime(startedAt);
        const delta = (endedAt[0] * 1e9) + endedAt[1];
        ee.emit("response", delta, 0, context._uid);

        callback(null, context);
    };
    return processAction;
}