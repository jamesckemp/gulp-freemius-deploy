/**
 * Deploy to Freemius.
 *
 * The `args` param should contain values for developer_id, plugin_id, secret_key, public_key, zip_name, zip_path, add_contributor.
 *
 * @param gulp
 * @param args
 */
module.exports = function( gulp, args ) {
	/**
	 * Deps.
	 */
	var notifier = require( 'node-notifier' ),
		needle = require( 'needle' ),
		fs = require( 'fs' ),
		cryptojs = require( 'crypto-js' );

	/**
	 * Base 64 URL encode.
	 *
	 * @param str
	 * @return string
	 */
	var base64_url_encode = function( str ) {
		str = new Buffer( str ).toString( 'base64' );
		// str = strtr(base64_encode($input), '+/', '-_');
		str = str.replace( /=/g, '' );

		return str;
	};

	gulp.task( 'freemius-deploy', function() {
		if( ! Number.isInteger( args.plugin_id ) ) {
			return;
		}

		var resource_url = '/v1/developers/' + args.developer_id + '/plugins/' + args.plugin_id + '/tags.json',
			boundary = '----' + (new Date().getTime()).toString( 16 ),
			content_md5 = '',
			date = new Date().toUTCString(),
			string_to_sign = [
				'POST',
				content_md5,
				'multipart/form-data; boundary=' + boundary,
				date,
				resource_url
			].join( "\n" ),
			hash = cryptojs.HmacSHA256( string_to_sign, args.secret_key ),
			auth = 'FS ' + args.developer_id + ':' + args.public_key + ':' + base64_url_encode( hash.toString() ),
			buffer = fs.readFileSync( args.zip_path + args.zip_name ),
			data = {
				add_contributor: args.add_contributor,
				file: {
					buffer: buffer,
					filename: args.zip_name,
					content_type: 'application/zip'
				}
			},
			options = {
				multipart: true,
				boundary: boundary,
				headers: {
					"Content-MD5": content_md5,
					"Date": date,
					"Authorization": auth
				}
			};

		needle.post( 'https://api.freemius.com' + resource_url, data, options, function( error, response, body ) {
			var message;

			if ( response.statusCode == 500 ) {
				message = 'Try deploying to Freemius again in a minute.';
				notifier.notify( { message: message } );
				console.log( '\x1b[33m%s\x1b[0m', message );
				return
			}

			if ( error || response.statusCode != 201 ) {
				message = 'Error deploying to Freemius.';
				if ( body.error && body.error.message ) message += '\n' + body.error.message;
				notifier.notify( { message: message } );
				console.log( '\x1b[31m%s\x1b[0m', message );
				return;
			}

			if ( typeof body === 'object' ) {
				if ( typeof body.error !== 'undefined' ) {
					message = 'Error: ' + body.error.message;
					notifier.notify( { message: message } );
					console.log( '\x1b[31m%s\x1b[0m', message );
					return;
				}

				message = 'Successfully deployed v' + body.version + ' to Freemius. Go and release it: https://dashboard.freemius.com/#!/live/plugins/' + args.plugin_id + '/deployment/';
				notifier.notify( { message: message } );
				console.log( '\x1b[32m%s\x1b[0m', message );
				return;
			}

		} );
	} );
};