### Authentication

This app can manage [OpenRosa form authentication](https://bitbucket.org/javarosa/javarosa/wiki/AuthenticationAPI) for protected forms, i.e. it is possible to log in to forms with credentials set in your OpenRosa Server (e.g. Aggregate/KoBo), just like in ODK Collect.

Alternatively, you could make use various _external authentication_ methods, i.e. using the authentication management of your form and data server.

For more information see [this documentation page](https://enketo.org/develop/auth/) and the [configuration documentation](https://github.com/enketo/enketo-express/blob/master/tutorials/10-configuration.md#linked-form-and-data-server).

### Security

There are two major security considerations to be aware of. Both of these result in the need to run this application on **https** with a valid SSL certificate.

_API security_ is mainly arranged by the secret API key set up in config/config.json. This API key is sent in **cleartext** to Enketo by the form/data server (such as ODK Aggregate) and can easily be intercepted and read _if the transport is not secure_. Somebody could start using your Enketo Express installation for their own form/data server, or obtain the URLs of your forms. Using secure (https) transport mitigates against this hazard. Security increases as well by populating the _server url_ in config/config.json. Also, don't forget to change your API key when you start running Enketo Express in production.

_Form authentication_ is only secure when Enketo is running on **https**. To avoid leaking form server credentials, authentication is automatically disabled when the app is accessed in a 'production' environment on 'http'. If you **have to** to run the app on http in a production environment, you can bypass this security by setting `"allow insecure transport": true` in config/config.json. The only use case this would be acceptable in is when running the app on a local protected network (e.g. in the KoBo VM).
