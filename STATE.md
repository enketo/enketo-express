This document covers the state of Enketo Express as well as the Enketo libraries it is using (Enketo Core, Enketo Transformer).


### Where we are

- We have a logically separated set of Enketo libraries to facilitate the development of both hybrid mobile apps and web applications. The extra effort this requires (vs. one repo for everything), is probably worth it. Examples of hybrid mobile apps are Medic Mobile's app and Survey123.
- We have a relatively new enketo-core widget structure that is easy to extend, test and ensures consistency between widgets.
- We have a recently developed new XPath evaluator that is blazing fast.
-

### Where we are going

- Complete the replacement of jQuery with native JS and utility functions in dom-utils.js (in Enketo Core)
- Removing asynchronous constraint validation (in Enketo Core) and simplify the test specs would be wonderful. It is currently asynchronous to facilitate a need (extension) by Medic Mobile to validate phone numbers with an external service.
- Rewriting/refactoring very old code in ........,  ....., ... ., .....
- Simplify enketo-transformer by completely changing the way translations are handled and simply copy the `<itext>` block in the model to be passed to Enketo Core. Translation lookups would be done on the client using XPath (rewriting itext queries to native XPath).
- The XSL stylesheets in Enketo Transformer could probably be much improved in terms of readability and perhaps performance (after moving itext handling to the client)
- The node-libxslt library is repeatedly preventing Enketo from adopting the latest node or npm versions, sometimes for years. It would be good if we have the expertise and ability to take over managing that tool. I believe the owner would be open to that.
- Switch to latest official Sass tool (Dart sass but the node version of that).
- Tests in Enketo Core should be able to run much faster with some work.
- The events.js module in Enketo Core (used in Enketo Express too) might need a redesign. The API just doesn't look attractive (rewrite affects OpenClinica fork).
- Expand testing coverage in Enketo Express, and perhaps figure out a better way to test XForms.
