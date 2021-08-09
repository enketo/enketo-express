import pkg from '../../package.json';
import { Form } from 'enketo-core';

describe( 'Build checks: ', () => {
    // TODO[2021-08-15]: This should be restored when Transformer and Core Node upgrades are released
    it.skip( 'Transformer matches Core', () => {
        expect( pkg.dependencies[ 'enketo-transformer' ] ).to.equal( Form.requiredTransformerVersion );
    } );
} );
