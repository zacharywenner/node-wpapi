'use strict';
var chai = require( 'chai' );
// Variable to use as our "success token" in promise assertions
var SUCCESS = 'success';
// Chai-as-promised and the `expect( prom ).to.eventually.equal( SUCCESS ) is
// used to ensure that the assertions running within the promise chains are
// actually run.
chai.use( require( 'chai-as-promised' ) );
chai.use( require( 'sinon-chai' ) );
var expect = chai.expect;
var sinon = require( 'sinon' );

/*jshint -W079 */// Suppress warning about redefiniton of `Promise`
var Promise = require( 'es6-promise' ).Promise;

var WPAPI = require( '../../' );
var WPRequest = require( '../../lib/constructors/wp-request.js' );
var autodiscovery = require( '../../lib/autodiscovery' );

// Inspecting the titles of the returned posts arrays is an easy way to
// validate that the right page of results was returned
var getTitles = require( './helpers/get-rendered-prop' ).bind( null, 'title' );
var credentials = require( './helpers/constants' ).credentials;

// Define some arrays to use ensuring the returned data is what we expect
// it to be (e.g. an array of the titles from posts on the first page)
var expectedResults = {
	firstPostTitle: 'Markup: HTML Tags and Formatting'
};

describe( 'integration: discover()', function() {
	var apiPromise;
	var sinonSandbox;

	beforeEach(function() {
		apiPromise = WPAPI.discover( 'http://wpapi.loc' );
		// Stub warn and error
		sinonSandbox = sinon.sandbox.create();
		sinonSandbox.stub( global.console, 'warn' );
		sinonSandbox.stub( global.console, 'error' );
	});

	afterEach(function() {
		// Restore sandbox
		sinonSandbox.restore();
	});

	it( 'returns a promise', function() {
		expect( apiPromise ).to.be.an.instanceOf( Promise );
	});

	it( 'eventually returns a configured WP instance', function() {
		var prom = apiPromise
			.then(function( result ) {
				expect( result ).to.be.an.instanceOf( WPAPI );
				expect( result.namespace( 'wp/v2' ) ).to.be.an( 'object' );
				expect( result.posts ).to.be.a( 'function' );
				expect( result.posts() ).to.be.an.instanceOf( WPRequest );
				return SUCCESS;
			});
		return expect( prom ).to.eventually.equal( SUCCESS );
	});

	it( 'auto-binds to the detected endpoint on the provided site', function() {
		var prom = apiPromise
			.then(function( site ) {
				expect( site.posts().toString() ).to.equal( 'http://wpapi.loc/wp-json/wp/v2/posts' );
				return SUCCESS;
			});
		return expect( prom ).to.eventually.equal( SUCCESS );
	});

	it( 'can correctly instantiate requests against the detected and bound site', function() {
		var prom = apiPromise
			.then(function( site ) {
				return site.posts();
			})
			.then(function( posts ) {
				expect( getTitles( posts )[ 0 ] ).to.equal( expectedResults.firstPostTitle );
				return SUCCESS;
			});
		return expect( prom ).to.eventually.equal( SUCCESS );
	});

	describe( 'can authenticate', function() {

		it( 'requests against the detected and bound site', function() {
			var prom = apiPromise
				.then(function( site ) {
					return site.auth( credentials );
				})
				.then(function( site ) {
					return site.users().me();
				})
				.then(function( user ) {
					expect( user ).to.be.an( 'object' );
					expect( user.slug ).to.equal( credentials.username );
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

		it( 'one-off requests against the detected and bound site', function() {
			var prom = apiPromise
				.then(function( site ) {
					return site.users()
						.auth( credentials )
						.me();
				})
				.then(function( user ) {
					expect( user ).to.be.an( 'object' );
					expect( user.slug ).to.equal( credentials.username );
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

	});

	describe( 'rejection states', function() {

		beforeEach(function() {
			sinon.stub( autodiscovery, 'getAPIRootFromURL' );
			sinon.stub( autodiscovery, 'locateAPIRootHeader' );
			sinon.stub( autodiscovery, 'getRootResponseJSON' );
		});

		afterEach(function() {
			autodiscovery.getAPIRootFromURL.restore();
			autodiscovery.locateAPIRootHeader.restore();
			autodiscovery.getRootResponseJSON.restore();
		});

		it( 'resolves even if no endpoint is found', function() {
			autodiscovery.getAPIRootFromURL.returns( Promise.reject() );
			var prom = WPAPI.discover( 'http://we.made.it/to/mozarts/house' );
			return expect( prom ).to.eventually.be.fulfilled;
		});

		it( 'resolves to null if no endpoint is found', function() {
			autodiscovery.getAPIRootFromURL.returns( Promise.resolve() );
			var prom = WPAPI.discover( 'http://we.made.it/to/mozarts/house' )
				.then(function( result ) {
					expect( result ).to.equal( null );
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

		it( 'logs a console error if no endpoint is found', function() {
			autodiscovery.getAPIRootFromURL.returns( Promise.reject() );
			var prom = WPAPI.discover( 'http://we.made.it/to/mozarts/house' )
				.then(function() {
					expect( console.error ).to.have.been.calledWith( 'Autodiscovery failed' );
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

		it( 'does not display any warnings if no endpoint is found', function() {
			autodiscovery.getAPIRootFromURL.returns( Promise.reject() );
			var prom = WPAPI.discover( 'http://we.made.it/to/mozarts/house' )
				.then(function() {
					expect( console.warn ).not.to.have.been.called;
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

		it( 'resolves to a WPAPI instance if an endpoint is found but route autodiscovery fails', function() {
			autodiscovery.getAPIRootFromURL.returns( Promise.resolve() );
			autodiscovery.locateAPIRootHeader.returns( 'http://we.made.it/to/mozarts/house' );
			autodiscovery.getRootResponseJSON.throws();
			var prom = WPAPI.discover()
				.then(function( result ) {
					expect( result ).to.be.an.instanceOf( WPAPI );
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

		it( 'binds returned instance to the provided endpoint even if route autodiscovery fails', function() {
			autodiscovery.getAPIRootFromURL.returns( Promise.resolve() );
			autodiscovery.locateAPIRootHeader.returns( 'http://we.made.it/to/mozarts/house' );
			autodiscovery.getRootResponseJSON.throws();
			var prom = WPAPI.discover()
				.then(function( result ) {
					expect( result.root( '' ).toString() ).to.equal( 'http://we.made.it/to/mozarts/house/' );
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

		it( 'logs a console error if an endpoint is found but route autodiscovery fails', function() {
			autodiscovery.getAPIRootFromURL.returns( Promise.resolve() );
			autodiscovery.locateAPIRootHeader.returns( 'http://we.made.it/to/mozarts/house' );
			autodiscovery.getRootResponseJSON.throws();
			var prom = WPAPI.discover()
				.then(function() {
					expect( console.error ).to.have.been.calledWith( 'Autodiscovery failed' );
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

		it( 'displays a warning if an endpoint is detected but route autodiscovery fails', function() {
			autodiscovery.getAPIRootFromURL.returns( Promise.resolve() );
			autodiscovery.locateAPIRootHeader.returns( 'http://we.made.it/to/mozarts/house' );
			autodiscovery.getRootResponseJSON.throws();
			var prom = WPAPI.discover()
				.then(function() {
					expect( console.warn ).to.have.been.calledWith( 'Endpoint detected, proceeding despite error...' );
					expect( console.warn ).to.have.been.calledWith( 'Binding to http://we.made.it/to/mozarts/house and assuming default routes' );
					return SUCCESS;
				});
			return expect( prom ).to.eventually.equal( SUCCESS );
		});

	});

});
