const esprima = require( 'recast/parsers/esprima' );
const { builders, namedTypes } = require( 'ast-types' );
const { parse, print } = require( 'recast' );
const createPipeablePlugin = require( './esbuild-pipeable-plugin' );

/** @typedef {import('estree').Node} ASTNode */

/**
 * @typedef ASTProgram
 * @property {Node[]} body
 */

/**
 * @typedef RecastAST
 * @property {ASTProgram} program
 */

/**
 * @param {ASTNode | null} [node]
 * @return {string[]}
 */
const resolveIdentifierNames = ( node ) => {
    if ( node == null ) {
        return [];
    }

    if ( namedTypes.Identifier.check( node ) ) {
        return [ node.name ];
    }

    if ( namedTypes.ExportSpecifier.check( node ) ) {
        return resolveIdentifierNames( node.local );
    }

    if ( namedTypes.FunctionDeclaration.check( node ) ) {
        return resolveIdentifierNames( node.id );
    }

    if ( namedTypes.ArrayPattern.check( node ) ) {
        return node.elements.flatMap( resolveIdentifierNames );
    }

    if (
        namedTypes.ObjectExpression.check( node ) ||
        namedTypes.ObjectPattern.check( node )
    ) {
        return node.properties.flatMap( resolveIdentifierNames );
    }

    if ( namedTypes.Property.check( node ) ) {
        if ( node.kind === 'init' && node.value.type === 'Identifier' ) {
            return resolveIdentifierNames( node.value );
        }

        return [];
    }

    if ( namedTypes.VariableDeclaration.check( node ) ) {
        return node.declarations.flatMap( resolveIdentifierNames );
    }

    if ( namedTypes.VariableDeclarator.check( node ) ) {
        return resolveIdentifierNames( node.id );
    }

    throw new Error( `Unexpected AST Node: ${JSON.stringify( node )}` );
};

const exportPrivate = createPipeablePlugin(
    'export-private',
    async ( { args, contents } ) => {
        const { path } = args;

        /** @type {RecastAST} */
        let ast = parse( contents, {
            parser: esprima,
        } );

        /** @type {string[]} */
        let declarations = [];

        /** @type {Set<string>} */
        let exports = new Set();

        for ( const node of ast.program.body ) {
            if (
                namedTypes.FunctionDeclaration.check( node ) ||
                namedTypes.VariableDeclaration.check( node )
            ) {
                declarations.push( ...resolveIdentifierNames( node ) );
            } else if ( namedTypes.ExportNamedDeclaration.check( node ) ) {
                const names = [
                    ...resolveIdentifierNames( node.declaration ),
                    ...node.specifiers.flatMap( resolveIdentifierNames ),
                ];

                names.forEach( name => {
                    exports.add( name );
                } );
            } else if ( namedTypes.ExportDefaultDeclaration.check( node ) ) {
                resolveIdentifierNames( node.declaration ).forEach( name => {
                    exports.add( name );
                } );
            }
        }

        const privateDeclarations = declarations.filter( declaration => (
            !exports.has( declaration )
        ) );

        if ( privateDeclarations.length === 0 ) {
            return { contents: contents };
        }

        const privateExport = builders.exportNamedDeclaration(
            builders.variableDeclaration(
                'const',
                [ builders.variableDeclarator(
                    builders.identifier( '_PRIVATE_TEST_ONLY_' ),
                    builders.objectExpression(
                        privateDeclarations.map( declaration => {
                            const identifier = builders.identifier( declaration );

                            return builders.property( 'init', identifier, identifier  );
                        } )
                    )
                ) ]
            )
        );

        ast.program.body.push( privateExport );

        const { code } = print( ast, {
            sourceFileName: path,
        } );

        return { contents: code };
    }
);

module.exports = exportPrivate;
