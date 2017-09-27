Custom Widgets
================

Since version 1.53.0 it is possible to add your own widgets to Enketo Express without forking Enketo Express by following the steps below.

### 1. Create your widget in its own repo

See [this guidance](https://github.com/enketo/enketo-core#how-to-create-or-extend-widgets) for creating Enketo widgets. The simplest widget has just 1 file, either: a `[NAME}.js` or `[NAME].scss` file. If it has both (a common situation), make sure they have the same file name.

An example of a custom KoBoToolbox widget (for a particular client) is [here](https://github.com/kobotoolbox/enketo-image-customization-widget).


### 2. Install your widget

After installing enketo express, install your custom widget "manually". A convenient way may be to use npm with a github url, e.g.

```bash
npm install https://github.com/kobotoolbox/enketo-image-customization-widget.git
```

Another way would be to publish your widget on npm.

Note that the regular `npm update production` will not update these manually installed widgets!


### 3. Add the widget to the Enketo Express installation

In your config.json `"widgets"` item add your widget using the relative (to the public/js folder) path, e.g.

```json
{
    ...
    "widgets": [......., "../../node_modules/enketo-image-customization-widget/image-customization"]
    ...
}

Use the filename without extension in the path.
