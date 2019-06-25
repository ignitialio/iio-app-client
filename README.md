# IgnitialIO web application client library

This library allows an web app to take advantage of the
[IIOS](https://github.com/ignitialio/iio-services) services framework.  
It implements several concepts:
- web socket communication using [socket.io](https://www.npmjs.com/package/socket.io)
- unified services: these are services defined server-side that can be called
browser side as if they were seamlesly local to browser. They use web sockets to
do so.
- modules: these are services (you can see this as server app plugins) implemented
server-side and eventually available browser side. If so, unlikely unified
services, they are defined with one instance per all web socket clients (e.g.
connection), while unified services provide one instance per client
- API gateway: is providing an unified service for each available IIO
micro-service. In this way, any micro-service can be used locally to the browser.
- static configuration management for the web app
- static file serve
- REST API capabilities thanks to [connect-rest](https://www.npmjs.com/package/connect-rest)
- AWS S3 or compliant (e.g. Minio S3) file storage
- i18n

## Architecture

### _i18n_  

It provides internationalization features allowing to use transparent translation
for any string.

### _modules_

Base class for implementing client side plugin (for example VueJS plugin) to
remotely access server modules.

### _services_

Base class for implementing client side plugin (for example VueJS plugin) to
remotely access server services (unified services + IIO micro-services).

### _utils_

Base class for implementing utility plugin (for example VueJS plugin).

## Tests  

Tests are mainly done trough the full application. For example:
[IgnitialIO application template](https://github.com/ignitialio/iio-app-template)
