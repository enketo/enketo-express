import { _PRIVATE_TEST_ONLY_ } from './fixtures/private-imports';

it('imports private functions and variables in test', () => {
    expect(typeof _PRIVATE_TEST_ONLY_).to.equal('object');
    expect(Object.keys(_PRIVATE_TEST_ONLY_)).to.deep.equal([ '_foo', '_x' ]);
    expect(typeof _PRIVATE_TEST_ONLY_._foo).to.equal('function');
    expect(_PRIVATE_TEST_ONLY_._foo()).to.equal(42);
    expect(typeof _PRIVATE_TEST_ONLY_._x).to.equal('object');
    expect(_PRIVATE_TEST_ONLY_._x).to.deep.equal({ y: 1, z: 2 });
});
