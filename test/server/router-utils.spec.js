const chai = require( 'chai' );
const sinon = require( 'sinon' );
const sinonChai = require( 'sinon-chai' );
chai.should();
chai.use(sinonChai);
const expect = chai.expect;
const chaiAsPromised = require( 'chai-as-promised' );

const routerUtils = require( '../../app/lib/router-utils' );
const config = require( '../../app/models/config-model' ).server;

chai.use( chaiAsPromised );

describe( 'Router utilities', () => {

    describe( 'enketoIdParam function', () => {
        it( 'should assign enketoId to request object', () => {
            const req = {};
            const res = {};
            const next = sinon.fake();
            const id = '::aA12bB34';
            routerUtils.enketoId( req, res, next, id );
            expect( req.enketoId ).to.equal( 'aA12bB34' );
            expect( next ).to.have.been.calledWith();
        } );

        it( 'should pass "route" when id is invalid', () => {
            const req = {};
            const res = {};
            const next = sinon.fake();
            const id = '::1';
            routerUtils.enketoId( req, res, next, id );
            expect( req ).should.not.have.property( 'enketoId' );
            expect( next ).to.have.been.calledWith( 'route' );
        } );
    } );

} );
