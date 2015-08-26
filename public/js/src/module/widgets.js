/**
 * This file is used to override the default widgets in enketo-core. 
 */

'use strict';
var widgets = [
    require( '../../../../node_modules/enketo-core/src/widget/note/notewidget' ),
    require( '../../../../node_modules/enketo-core/src/widget/select-desktop/selectpicker' ),
    require( '../../../../node_modules/enketo-core/src/widget/select-mobile/selectpicker' ),
    require( '../../../../node_modules/enketo-core/src/widget/geo/geopicker' ),
    require( '../../../../node_modules/enketo-core/src/widget/table/tablewidget' ),
    require( '../../../../node_modules/enketo-core/src/widget/radio/radiopicker' ),
    require( '../../../../node_modules/enketo-core/src/widget/date/datepicker-extended' ),
    require( '../../../../node_modules/enketo-core/src/widget/time/timepicker-extended' ),
    require( '../../../../node_modules/enketo-core/src/widget/datetime/datetimepicker-extended' ),
    require( '../../../../node_modules/enketo-core/src/widget/mediagrid/mediagridpicker' ),
    require( '../../../../node_modules/enketo-core/src/widget/file/filepicker' ),
    require( '../../../../node_modules/enketo-core/src/widget/select-likert/likertitem' ),
    require( '../../../../node_modules/enketo-core/src/widget/distress/distresspicker' ),
    require( '../../../../node_modules/enketo-core/src/widget/horizontal-choices/horizontalchoices' ),
];

module.exports = widgets;
