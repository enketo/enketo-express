## Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

[Unreleased]
------------------
##### Added
- Index-repeat() support

##### Fixed
- Calculations on select_one inside a repeat clone throws an exception.

[1.8.9] - 2015-05-08
------------------
##### Added 
- Enable print script for themes based on Grid Theme that include "grid" in the theme name.

##### Changed
- Do not attempt to load table/radio/likert/media grid widgets when they are not required.
- Even faster validation for some forms.
- Better performance of large default repeat creation with jr:repeat-count.

##### Fixed
- Screen view remaining at full screen width after printing form with Grid Theme.
- Print dialog buttons not visible with Grid Theme (Enketo Express).
- Sequential notes overlapping each other with Grid Theme.
- Exception occuring in some specific cases when loading an existing record.
- Click lag (especially on mobile) due to slow progress bar update.

[1.8.8] - 2015-04-23
-------------------
##### Changed
- Branch update performance
- Calculate update performance 
- Widget loading performance, **WARNING: remove triggerwidget, add horizontal choices widget, see [default-config](./config/default-config.json)**

##### Fixed
- Top border missing and margin too small when a visible note is preceded by a hidden note.
- Any branch containing a geoshape widget caused an exception to occur when it was made irrelevant.
- Appearance 'horizontal' no longer displays with evenly-spaced columns.
- Some buttons in Safari have border and background when they shouldn't have.
- Side bar in Safari is not stretching to bottom.

[1.8.7] - 2015-04-17
------------------
##### Added
- Italian language
- Romanian language

##### Fixed
- All forms with logic broken in Internet Explorer.
- When existing instance with multiple repeats is loaded, only the first repeat is created and populated.
- XML nodenames ending with hyphen or underscore failed to be found.

[1.8.6] - 2015-04-15
---------------
#### Fixed
- Broken submissions.

[1.8.5] - 2015-04-15
---------------------
##### Added
- Arabic language (left-to-right still).

##### Changed
- Text and number inputs in Grid Theme now displayed in full cell width.
- Updated Greek, German, and Dutch language.

##### Fixed
- Geowidget not displayed displayed in full width in pages mode with Grid Theme.
- Hide/show input fields button in Geo Widgets in Grid Theme not clickable after clicking show.
- Remove existing content form external instances to enable ODK Validate hack.
- Reliance on .csv extension for external data broke broke Aggregate support.

[1.8.4] - 2015-04-09
---------------
##### Changed
- Allow empty Google Analytics domain in configuration.

##### Fixed
- Authentication not working on https (reverse proxy).
- API URLs not returning https (reverse proxy).

[1.8.3] - 2015-04-08
---------------
##### Added
- German language
- Greek language

##### Changed
- Much faster form validation.

##### Fixed
- Not showing 'save as draft' in pages mode.

[1.8.2] - 2015-03-23
---------------
##### Added
- Show supported languages on front page.

##### Fixed
- Media files not submitted in offline-enabled views.

[1.8.1] - 2015-03-17
------------
##### Fixed
- Installation with Vagrant failed.
- Local Redis configuration was ignored.

[1.8.0] - 2015-03-09
-----------
##### Added
- Support for external instance sources, CSV and XML
- Spanish language

[1.7.1] - 2015-02-27
-----------
##### Changed
- Configuration now done with local config.json that overrides default (rename existing config/config.json before updating!).
- Dutch translation
- Authentication documentation

##### Fixed
- Installation with Vagrant.
- In media input widget, when media is too large, record is still populated with file name.
- Broken form retrieval with formhub servers.
- Error message 'ECONNREFUSED' not correctly changed to human-readable message. 

[1.7.0] - 2015-02-19
-----------
##### Added
- Meta data for username
- Meta data for deviceid
- OpenRosa authentication
- Change log

##### Changed
- API v2 documentation

##### Fixed
- Form cache on server would not update if XForm content (only) changed

[1.6.1] - 2015-02-19
-----------
##### Added
- Panic button to clear browser database

##### Fixed
- Redirect IE9 and less to Modern Browsers page
- Manifest taking over all error pages and redirecting to 'offline' page.

[1.6.0] - 2015-02-12
-----------
##### Added
- Full offline capability
- Grid Theme
- Temporary API v2 documentation

##### Changed
- API access of parameters using a modern method.

##### Fixed
- Grid theme in pages mode shows all questions at full width.
- File inputs keep shows file name after input is emptied.

[1.5.1] - 2014-12-31
-----------
##### Fixed
- Repeat groups not working when they have no \<group\> wrapper.
- Multipe markdown links in a note are merged into one.

[1.5.0] - 2014-12-30
-----------
##### Added
- Internationalization of user interface
- Dutch language
- Populate page title with name of form

##### Fixed
- False 'edited' event firing.
- Multipe markdown links in a note are merged into one.
- Select minimal in first repeat not working right.

[1.4.0] - 2014-12-18
-----------
##### Added
- Support for multipe themes.
- Theme switching via API (v2)

##### Changed
- Styling of 'Pages mode' buttons

##### Fixed
- Stretch short forms and short pages to full height of screen.
- KoBo/Formhub themes occassionaly print in screen style when print button is used.
- Incorrect dialog positioning.

[1.3.1] - 2014-12-16
-----------
##### Fixed
- App breaks when form is loaded with a default value for geopoint/geotrace/geoshape.

[1.3.0] - 2014-12-12
-----------
##### Added
- Ability to paste KML coordinates in geoshape widgets.
- Ability to add Google Maps layers for geo widgets.

[1.2.1] - 2014-12-05
-----------
##### Added 
- Ability to print from iframe views.

#### Fixed
- Send X-OpenRosa-Version header to comply with OpenRosa specs.

[1.2.0] - 2014-11-11
-----------
Added
- External authentication support.

[1.1.1] - 2014-11-08
-----------
Fixed
- Instance API endpoint does not add return URL to response.

[1.1.0] - 2014-11-08
-----------
##### Added
- Ability for iframed view to post message to parent window.

##### Changed
- Hide print button in iframe views

##### Fixed
- Crash in Internet Explorer 10 (due to use of console.time).
- Various iframe issues.
- Issue with reporting edit status of current form.

[1.0.3] - 2014-11-07
-----------
##### Fixed
- Various issues with modal dialogs

[1.0.2] - 2014-11-06
-----------
##### Fixed
- Time, date and datetimepickers are reset when user clicks Enter elsewhere in form

