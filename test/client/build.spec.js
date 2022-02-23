import { Form } from 'enketo-core';
import pkg from '../../package.json';

describe('Build checks: ', () => {
    it('Transformer matches Core', () => {
        expect(pkg.dependencies['enketo-transformer']).to.equal(
            Form.requiredTransformerVersion
        );
    });
});
