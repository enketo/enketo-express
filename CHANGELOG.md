## Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

[1.18.1] - 2015-10-07
-----------------------
##### Fixed
- Vagrant build failing due to npm version.
- Markdown lists generated if first item was not preceded by newline character.

[1.18.0] - 2015-10-06
-----------------------
##### Added
- Analog Scale picker

##### Changed
- Form footer styling.
- Location of required * now on left of question (in LTR language).

[1.17.0] - 2015-09-10
-----------------------
##### Added
- More comprehensive markdown support and now activated in all labels and hints.

##### Fixed
- If theme changed via API, offline view does not update.
- Edit view form injection fails with certain characters.

[1.16.0] - 2015-09-05
------------------------
##### Added
- Ability to disable themes in config.json.
- Support for pulldata function in XForms that contain a reference to the external data in the model.

##### Fixed
- Form initialization issue in Android (enketo-core 4.0.2)

[1.15.0] - 2015-08-28
------------------------
##### Changed
- Switched to CommonJS modules (**WARNING: forks with custom client scripts, tests need to be updated).

##### Fixed
- HTML titles not populated

[1.14.4] - 2015-08-26 
------------------------
##### Fixed
- Repeat buttons missing in Grid theme.
- Pulldowns get cut off when the extend beyond form border.
- Formfooter buttons in pages mode overlap form border.

[1.14.3] - 2015-08-13
------------------------
##### Changed
- Reduce space between border and form on small screens.

##### Fixed
- Loading a record with multiple repeats with missing nodes fails with error message.
- Select minimal widgets in Grid theme overlap other text in print view.

[1.14.2] - 2015-08-05
------------------------
##### Changed
- Repeat background color in Grid theme.
- Background color of selected radiobutton/checkbox on touchscreen in non-Grid themes.

##### Fixed
- Repeat button location in Grid theme.
- Radio buttons inside cloned repeat, require 2 clicks if the master was selected.
- Radio button and checkbox default values not populated correctly in cloned repeat. Overriding values in first repeat. 
- Indexed-repeat() result incorrect if expression is inside 2+ repeat.
- Webform not responsive when used in full-size iframe.

[1.14.1] - 2015-07-30
------------------------
##### Fixed
- In pages mode, an exception occurs after submission showing empty page.
- In pulldown select radiobuttons/checkboxes not aligned properly.

[1.14.0] - 2015-07-29
------------------------
##### Added
- Appearance "compact-n" support for media grid pickers.

##### Fixed
- Indexed-repeat() expressions not working if the position is dynamic.
- Page navigation buttons messed up on small screen in pages-mode.
- Top-level (non-grouped) questions on first row do not have a top border.
- Language options in form language selector oddly aligned when mix of rtl and ltr languages is used (FF).
- Title directionality is not displayed according to script used in Grid theme.

[1.13.0] - 2015-07-27
-----------------------
##### Added
- Right-to-left form language directionality support.

##### Changed 
- Made page-swipe less sensitive on touchscreens in pages-mode.

[1.12.2] - 2015-07-24
-----------------------
##### Fixed
- Error message is not useful when formList is found to be empty.
- Form injection fails with certain arabic characters.

[1.12.1] - 2015-07-20 
------------------------
##### Fixed
- Nested branches do not get evaluated when the parent is enabled.

[1.12.0] - 2015-07-08
------------------------
##### Added
- Right-to-left UI language directionality support.

##### Changed
- Vagrant setup script updated.

##### Fixed
- Validation error dialog message not translated.
- Fallback (english) language not cached in offline views.
- Geo Widget map tiles only partially loaded if widget not visible upon initial form load.

##### Removed
- Non-functional export button removed until the functionality can be added.

[1.11.1] - 2015-06-29
------------------------
##### Fixed
- API endpoint /surveys/list does not include server_url property in each survey item.
- Formhub authentication regression. **WARNING: Formhub users, see additional config.json setting to work around formhub bug.**
- Media for protected forms cannot be retrieved (on strict compliant OpenRosa servers).

[1.11.0] - 2015-06-25
------------------------
##### Added
- Auto-save unsaved data in offline-capable webform views
- API endpoint /surveys/list

##### Fixed
- A note preceding a traditional table is formatted as a group label.
- A note following a traditional table is formatted as a group label.
- Incorrect error message shown when loading a record with a file in the edit view.

[1.10.0] - 2015-06-18 
------------------------
##### Changed
- OpenRosa Form ID is now case-sensitive. **WARNING: any existing forms that have a form ID that included a capitalized letter, will get a new Enketo ID. Existing Enketo IDs will keep working though.**

##### Fixed
- Groups and repeats missing from print view in pages mode.
- Sidebar handle is shown up in print view.
- Back button in pages shows merged pages after form reset.
- Incorrectly capitalized form IDs result in unlaunchable forms. 
- First page in pages mode is shown if it is disabled.
- Existing trigger value not populated in form.

[1.9.1] - 2015-06-16
------------------
##### Added
- Swahili language

##### Changed
- Improved performance in logic evaluation.

##### Fixed
- Firefox only prints first page.
- Failing to load record.
- Records with nested repeats loaded incorrectly and completely corrupting model.

[1.9.0] - 2015-05-28
------------------
##### Added
- Index-repeat() support

##### Changed
- Faster loading

##### Fixed
- Calculations on select_one inside a repeat clone throw an exception.
- Irrelevant questions inside a repeat clone are shown but should be hidden.
- Calculations inside repeat clones are not evaluated upon form load.

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

