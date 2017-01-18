'use strict';

var Widget = require( '../../../node_modules/enketo-core/src/js/Widget' );
var $ = require( 'jquery' );
var t = require( 'translator' ).t;
var settings = require( '../../js/src/module/settings' );
var users;

/**
 * Visually transforms a question into a comment modal that can be shown on its linked question.
 *
 * @constructor
 * @param {Element}                       element   Element to apply widget to.
 * @param {(boolean|{touch: boolean})}    options   options
 * @param {*=}                            event     event
 */
function Comment( element, options, event, pluginName ) {
    this.namespace = pluginName;
    Widget.call( this, element, options );
    this._init();
}

Comment.prototype = Object.create( Widget.prototype );
Comment.prototype.constructor = Comment;

Comment.prototype._init = function() {
    this.$linkedQuestion = this._getLinkedQuestion( this.element );
    this.$commentQuestion = $( this.element ).closest( '.question' );
    this.ordinal = 0;

    if ( this.$linkedQuestion.length === 1 ) {
        this.notes = this._parseModelFromString( this.element.value );
        this.$commentQuestion.addClass( 'hide' ).attr( 'role', 'comment' );
        // Any <button> inside a <label> receives click events if the <label> is clicked!
        // See http://codepen.io/MartijnR/pen/rWJeOG?editors=1111
        this.$commentButton = $( '<a class="btn-icon-only btn-comment btn-dn" type="button" href="#"><i class="icon"> </i></a>' );
        this._setCommentButtonState( this.element.value, '', this._getCurrentStatus( this.notes ) );
        this.$linkedQuestion.find( '.question-label' ).last().after( this.$commentButton );
        this._setCommentButtonHandler();
        this._setValidationHandler();
        this._setDisabledHandler();
        this._setValueChangeHandler();
    }
};

Comment.prototype._getLinkedQuestion = function( element ) {
    var $input = $( element );
    var contextPath = this.options.helpers.input.getName( $input );
    var targetPath = element.dataset.for.trim();
    var absoluteTargetPath = this.options.helpers.pathToAbsolute( targetPath, contextPath );
    // The root is nearest repeat or otherwise nearest form. This avoids having to calculate indices, without
    // diminishing the flexibility in any meaningful way, 
    // as it e.g. wouldn't make sense to place a comment node for a top-level question, inside a repeat.
    var $root = $( element ).closest( 'form.or, .or-repeat' );

    return this.options.helpers.input
        .getWrapNodes( $root.find( '[name="' + absoluteTargetPath + '"], [data-name="' + absoluteTargetPath + '"]' ) )
        .eq( 0 );
};

Comment.prototype._setCommentButtonState = function( value, error, state ) {
    state = state || '';
    if ( !state && typeof value == 'string' && value.trim() ) {
        state = 'new';
    }
    this.$commentButton
        .toggleClass( 'new', state === 'new' )
        .toggleClass( 'closed', state === 'closed' )
        .toggleClass( 'updated', state === 'updated' )
        .toggleClass( 'invalid', !!error );
};

Comment.prototype._commentHasError = function() {
    return this.$commentQuestion.hasClass( 'invalid-required' ) || this.$commentQuestion.hasClass( 'invalid-constraint' );
};

Comment.prototype._setCommentButtonHandler = function() {
    var that = this;
    this.$commentButton.click( function() {
        if ( that._isCommentModalShown( that.$linkedQuestion ) ) {
            that._hideCommentModal( that.$linkedQuestion );
        } else {
            var errorMsg = that._getCurrentErrorMsg();
            that._showCommentModal( errorMsg );
        }
        return false;
    } );
};

Comment.prototype._setValidationHandler = function() {
    var that = this;
    $( 'form.or' ).on( 'validated.enketo', function( evt ) {
        var error = that._commentHasError();
        var value = that.element.value;
        that._setCommentButtonState( value, error );
    } );
};

/**
 * Observes the disabled state of the linked question, and automatically generates
 * an audit log if:
 * 1. The question gets disabled and the query is currently 'open'.
 * 2. The form was loaded with a value for the linked question, but the question was disabled (upon load).s
 */
Comment.prototype._setDisabledHandler = function() {
    var observer;
    var comment;
    var status;
    var currentStatus;
    var linkedVal;
    var open;
    var that = this;
    var target = this.$linkedQuestion.get( 0 ).querySelector( 'input, select, textarea' );
    var $target = $( target );

    if ( this.options.helpers.input.getRelevant( $target ) ) {
        observer = new MutationObserver( function( mutations ) {
            mutations.forEach( function( mutation ) {
                currentStatus = that._getCurrentStatus( that.notes );
                open = currentStatus === 'updated' || currentStatus === 'new';

                if ( target.disabled ) {
                    // getVal() can return an empty array.
                    linkedVal = that.options.helpers.input.getVal( $target );
                    // If clearIrrelevantImmediately is true, this condition can only occur upon form loading if a form is loaded
                    // with a value for an irrelevant question and no open queries.
                    if ( !open && linkedVal.length > 0 ) {
                        comment = t( 'widget.dn.containsdatahidden' );
                        status = 'updated'; //TODO: properly determine status of added audit log
                    } else if ( open && linkedVal.length === 0 ) {
                        // This will not be triggered if a form is loaded with a value for an irrelevant question and an open query.
                        comment = t( 'widget.dn.autoclosed' );
                        status = 'closed';
                    }
                    if ( comment ) {
                        that._addQuery( 'comment', comment, status, '', false );
                    }
                }
            } );
        } );

        observer.observe( target, {
            attributes: true,
            attributeFilter: [ 'disabled' ]
        } );
    }
};

/**
 * Listens to a value change of the linked question and generates an audit log if
 * the value is valid.
 */
Comment.prototype._setValueChangeHandler = function() {
    var that = this;
    var previousValue = this.options.helpers.input.getVal( $( this.$linkedQuestion.get( 0 ).querySelector( 'input, select, textarea' ) ) );

    this.$linkedQuestion.on( 'valuechange.enketo', function( evt, valid ) {
        previousValue = ( Array.isArray( previousValue ) ) ? previousValue.join( ', ' ) : previousValue;
        if ( valid ) {
            var comment;
            var currentValue = that.options.helpers.input.getVal( $( evt.target ) );
            currentValue = ( Array.isArray( currentValue ) ) ? currentValue.join( ', ' ) : currentValue;

            comment = t( 'widget.dn.valuechange', {
                'new': '"' + currentValue + '"',
                'previous': '"' + previousValue + '"'
            } );

            that._addLog( 'audit', comment, '', false );
            previousValue = currentValue;
        }
    } );
};

Comment.prototype._isCommentModalShown = function( $linkedQuestion ) {
    return $linkedQuestion.find( '.or-comment-widget' ).length === 1;
};

Comment.prototype._showCommentModal = function( linkedQuestionErrorMsg ) {
    var $widget;
    var $content;
    var $assignee;
    var $notify;
    var $user;
    var $input;
    var $overlay;
    var that = this;
    var $queryButtons = $( '<div class="or-comment-widget__content__query-btns">' );
    var $comment = $( this.element ).closest( '.question' ).clone( false );
    var noClose = settings.dnCloseButton === false;
    var submitText = t( 'formfooter.submit.btn' ) || 'Submit';
    var updateText = t( 'widget.comment.update' ) || 'Update';
    var closeText = t( 'widget.dn.closeQueryText' ) || 'Close Query';
    var assignText = t( 'widget.dn.assignto' ) || 'Assign To'; // TODO: add string to kobotoolbox/enketo-express
    var notifyText = t( 'widget.dn.notifyText' ) || 'Email?'; // TODO: add string to kobotoolbox/enketo-express
    var historyText = t( 'widget.dn.historyText' ) || 'History'; // TODO: add string to kobotoolbox/enketo-express
    var $closeButton = $( '<button class="btn-icon-only or-comment-widget__content__btn-close-x" type="button">&times;</button>' );
    var $newQueryButton = $( '<button name="new" class="btn btn-primary or-comment-widget__content__btn-submit" type="button">' +
        submitText + '</button>' );
    var $updateQueryButton = $( '<button name="updated" class="btn btn-primary or-comment-widget__content__btn-submit" type="button">' +
        updateText + '</button>' );
    var $closeQueryButton = ( noClose ) ? $() : $( '<button name="closed" class="btn btn-default or-comment-widget__content__btn-submit" type="button">' +
        closeText + '</button>' );
    var $flag = this.$linkedQuestion.find( '.btn-dn' ).clone( false );
    var status = this._getCurrentStatus( this.notes );

    if ( status === 'new' || status === 'updated' ) {
        $queryButtons.append( $updateQueryButton ).append( $closeQueryButton );
    } else if ( status === 'closed' ) {
        $queryButtons.append( $updateQueryButton );
    } else {
        $queryButtons.append( $newQueryButton );
    }

    $input = $comment
        .removeClass( 'hide' )
        .removeAttr( 'role' )
        .find( 'input, textarea' )
        .addClass( 'ignore' )
        .removeAttr( 'name data-for data-type-xml' )
        .removeData()
        .val( linkedQuestionErrorMsg );

    $overlay = $( '<div class="or-comment-widget__overlay"></div>' );
    $assignee = $( '<label class="or-comment-widget__content__user__dn-assignee"><span>' + assignText +
        '</span><select name="dn-assignee" class="ignore">' + this._getUserOptions() + '</select>' );
    $notify = $( '<div class="or-comment-widget__content__user__dn-notify option-wrapper"><label><input name="dn-notify" ' +
        'class="ignore" value="true" type="checkbox"/><span class="option-label">' + notifyText + '</span></label></div>' );
    this.$history = $( '<div class="or-comment-widget__content__history closed"><p>' + historyText + '</p><table></table></div>' );
    $user = $( '<div class="or-comment-widget__content__user">' ).append( $assignee ).append( $notify );

    $content = $( '<form onsubmit="return false;" class="or-comment-widget__content" autocomplete="off"></form>' )
        .append( $comment )
        .append( $user )
        .append( $closeButton )
        .append( $queryButtons )
        .append( this.$history );

    $widget = $(
        '<section class="widget or-comment-widget"></section>'
    ).append( $overlay ).append( $content );

    this.$linkedQuestion
        .find( '.or-comment-widget' ).remove().end()
        .prepend( $widget )
        .before( $overlay.clone( false ) );

    this._renderHistory();

    $input
        .on( 'input', function() {
            $queryButtons.find( '.btn' ).prop( 'disabled', !$input.val() );
        } )
        .trigger( 'input' )
        .focus();

    $widget
        .find( 'form.or-comment-widget__content' ).on( 'submit', function() {
            $updateQueryButton.add( $newQueryButton ).click();
        } ).end()
        .get( 0 ).scrollIntoView( false );

    $queryButtons.find( '.btn' ).on( 'click', function() {
        if ( $input.val() ) {
            var comment = $input.val();
            var status = this.getAttribute( 'name' );
            var assignee = $assignee.find( 'select' ).val();
            var notify = $notify.find( 'input:checked' ).val() === 'true';
            that._addQuery( 'comment', comment, status, assignee, notify );
            $input.val( '' );
            that._hideCommentModal( that.$linkedQuestion );
            /*
             * Any current error state shown in the linked question will not automatically update.
             * It only updates when its **own** value changes.
             * See https://github.com/kobotoolbox/enketo-express/issues/608
             * Since a linked question and a comment belong so closely together, and likely have 
             * a `required` or `constraint` dependency, it makes sense to 
             * separately call a validate method on the linked question to update the error state if necessary.
             */
            that.options.helpers.input.validate( $( that.$linkedQuestion.get( 0 ).querySelector( 'input, select, textarea' ) ) );
        }

        return false;
    } );

    $closeButton.add( $overlay ).on( 'click', function() {
        that._hideCommentModal( that.$linkedQuestion );
        return false;
    } );
};

Comment.prototype._hideCommentModal = function( $linkedQuestion ) {
    $linkedQuestion
        .find( '.or-comment-widget' ).remove().end()
        .prev( '.or-comment-widget__overlay' ).remove();
};

Comment.prototype._getUserOptions = function() {
    var userNodes;
    var lastQuery = this.notes.queries.concat( this.notes.logs )[ 0 ];
    var lastAssignee = ( lastQuery && lastQuery.assigned_to ) ? lastQuery.assigned_to : '';

    if ( !users ) {
        try {
            userNodes = this.options.helpers.evaluate( 'instance("_users")/root/item', 'nodes', null, null, true );
            users = userNodes.map( function( item ) {
                return item.querySelector( 'first_name' ).textContent + ' ' +
                    item.querySelector( 'last_name' ).textContent +
                    ' (' + item.querySelector( 'user_name' ).textContent + ')';
            } );
        } catch ( e ) {
            users = [];
            console.error( e );
        }
    }

    return '<option value=""></option>' +
        users.map( function( user ) {
            return '<option value="' + user + '"' + ( user === lastAssignee ? ' selected' : '' ) + '>' + user + '</option>';
        } );
};

Comment.prototype._getCurrentErrorMsg = function() {
    if ( this.$linkedQuestion.hasClass( 'invalid-required' ) ) {
        return this.$linkedQuestion.find( '.or-required-msg.active' ).text();
    } else if ( this.$linkedQuestion.hasClass( 'invalid-constraint' ) ) {
        return this.$linkedQuestion.find( '.or-constraint-msg.active' ).text();
    } else {
        return '';
    }
};

Comment.prototype._parseModelFromString = function( str ) {
    try {
        if ( str.trim().length > 0 ) {
            var model = JSON.parse( str );
            if ( typeof model !== 'object' || Array.isArray( model ) ) {
                throw new Error( 'Parsed JSON is not an object.' );
            }
            if ( typeof model.queries === 'undefined' ) {
                model.queries = [];
            }
            if ( typeof model.logs === 'undefined' ) {
                model.logs = [];
            }
            return model;
        } else {
            return {
                queries: [],
                logs: []
            };
        }
    } catch ( e ) {
        console.error( e );
        throw new Error( 'Failed to parse discrepancy notes.' );
    }
};

Comment.prototype._datetimeDesc = function( a, b ) {
    var aDate = new Date( this._getIsoDatetimeStr( a.date_time ) );
    var bDate = new Date( this._getIsoDatetimeStr( b.date_time ) );
    if ( bDate.toString() === 'Invalid Date' || aDate > bDate ) {
        return -1;
    }
    if ( aDate.toString() === 'Invalid Date' || aDate < bDate ) {
        return 1;
    }
    return 0;
};

Comment.prototype._getParsedElapsedTime = function( datetimeStr ) {
    var dt = new Date( this._getIsoDatetimeStr( datetimeStr ) );
    if ( typeof datetimeStr !== 'string' || dt.toString() === 'Invalid Date' ) {
        return 'error';
    }
    return this._parseElapsedTime( new Date() - dt );
};

Comment.prototype._parseElapsedTime = function( elapsedMilliseconds ) {
    var months;
    var days;
    var hours;
    var minutes;

    if ( isNaN( elapsedMilliseconds ) || elapsedMilliseconds < 0 ) {
        return 'error';
    }
    minutes = elapsedMilliseconds / ( 1000 * 60 );
    // TODO: translateable strings with plural?
    if ( minutes < 59.5 ) {
        return Math.round( minutes ) + ' minute(s)';
    }
    hours = minutes / 60;
    if ( hours < 23.5 ) {
        return Math.round( hours ) + ' hour(s)';
    }
    days = hours / 24;
    if ( days < ( 5 / 12 + 30 - 0.5 ) ) {
        return Math.round( days ) + ' day(s)';
    }
    months = days / ( 5 / 12 + 30 );
    if ( months < 11.5 ) {
        return Math.round( months ) + ' month(s)';
    }
    return Math.round( months / 12 ) + ' year(s)';
};

Comment.prototype._addQuery = function( type, comment, status, assignee, notify ) {
    var that = this;
    var error;
    var modelDataStr;
    this.notes.queries.unshift( {
        type: type || 'comment',
        id: ( ++this.ordinal ).toString(),
        date_time: this._getFormattedCurrentDatetimeStr(),
        comment: comment,
        status: status,
        assigned_to: assignee,
        notify: notify
    } );

    // strip logs from model
    modelDataStr = JSON.stringify( {
        queries: that.notes.queries
    } );

    // update XML Model
    $( this.element ).val( modelDataStr ).trigger( 'change' );
    error = this._commentHasError();
    that._setCommentButtonState( that.element.value, error, status );
};

Comment.prototype._addLog = function( type, comment, assignee, notify ) {
    this.notes.logs.unshift( {
        type: type || 'audit',
        date_time: this._getFormattedCurrentDatetimeStr(),
        comment: comment,
        assigned_to: assignee,
        notify: notify
    } );
};

Comment.prototype._getCurrentStatus = function( notes ) {
    var status = '';

    notes.queries.concat( notes.logs ).some( function( item ) {
        if ( item.status ) {
            status = item.status;
            return true;
        }
        return false;
    } );
    return status;
};

Comment.prototype._getFormattedCurrentDatetimeStr = function() {
    var now = new Date();
    var offset = {};
    var pad2 = function( x ) {
        return ( x < 10 ) ? '0' + x : x;
    };

    offset.minstotal = now.getTimezoneOffset();
    offset.direction = ( offset.minstotal < 0 ) ? '+' : '-';
    offset.hrspart = pad2( Math.abs( Math.floor( offset.minstotal / 60 ) ) );
    offset.minspart = pad2( Math.abs( Math.floor( offset.minstotal % 60 ) ) );

    return new Date( now.getTime() - ( offset.minstotal * 60 * 1000 ) ).toISOString()
        .replace( 'T', ' ' )
        .replace( /(\.[0-9]{0,3})Z$/, 'Z' )
        .replace( 'Z', ' ' + offset.direction + offset.hrspart + ':' + offset.minspart );
};

Comment.prototype._getIsoDatetimeStr = function( dateTimeStr ) {
    var parts;
    if ( typeof dateTimeStr === 'string' ) {
        parts = dateTimeStr.split( ' ' );
        return parts[ 0 ] + 'T' + parts[ 1 ] + parts[ 2 ];
    }
    return dateTimeStr;
};

Comment.prototype._renderHistory = function() {
    var that = this;
    var emptyText = t( 'widget.dn.emptyHistoryText' ) || 'No History';
    var user = '<span class="icon fa-user"> </span>';
    var clock = '<span class="icon fa-clock-o"> </span>';

    var over3 = this.notes.queries.concat( this.notes.logs ).length - 3;
    var $more = over3 > 0 ? $( '<tr><td colspan="4"><span class="over">+' + over3 + '</span>' +
        '<button class="btn-icon-only btn-more-history"><i class="icon"> </i></button></td></tr>' ) : $();
    this.$history.find( 'table' ).empty()
        .append( '<thead><tr><td></td><td></td><td>' + user + '</td><td>' + clock + '</td></tr></thead>' )
        .append( '<tbody>' +
            ( this.notes.queries.concat( this.notes.logs ).sort( this._datetimeDesc.bind( this ) ).map( function( item ) {
                    return that._getRows( item, true );
                } )
                .join( '' ) || '<tr><td colspan="2">' + emptyText + '</td><td></td><td></td></tr>' ) +
            '</tbody>'
        )
        .find( 'tbody' )
        .append( $more );

    this.$history.on( 'click', 'tbody td', function() {
        $( this ).toggleClass( 'wrap' );
    } );

    $more.find( '.btn-more-history' ).on( 'click', function() {
        that.$history.toggleClass( 'closed' );
    } );
};

Comment.prototype._getRows = function( item ) {
    var msg;
    var elapsed;
    var fullName;
    var me;
    var types = {
        comment: '<span class="icon tooltip fa-comment-o" data-title="Query/Comment"> </span>',
        audit: '<span class="icon tooltip fa-edit" data-title="Audit Event"> </span>'
    };
    me = typeof item.user === 'undefined' ? t( 'widget.dn.me' ) : '';
    msg = item.comment || item.message;
    elapsed = this._getParsedElapsedTime( item.date_time );
    fullName = this._parseFullName( item.user ) || me;
    return '<tr><td>' + ( types[ item.type ] || '' ) + '</td><td>' + msg + '</td><td>' + fullName + '</td><td>' + elapsed + '</td></tr>';
};

Comment.prototype._parseFullName = function( user ) {
    var matches;

    if ( !user ) {
        return '';
    }

    matches = user.match( /^(.+)\((.+)\)$/ );
    return ( matches && matches.length > 0 ) ? matches[ 1 ] : user;
};

Comment.prototype.destroy = function( element ) {
    var $linkedQuestion = this._getLinkedQuestion( element );
    var $commentButton = $linkedQuestion.find( '.btn-comment' );

    this._hideCommentModal( $linkedQuestion );
    $commentButton.remove();

    $( element )
        .removeData( this.namespace )
        .off( '.' + this.namespace )
        .closest( '.question' ).removeClass( 'hide' );
};

module.exports = Comment;
