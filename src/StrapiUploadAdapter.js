import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import FileRepository from '@ckeditor/ckeditor5-upload/src/filerepository';
import { attachLinkToDocumentation } from '@ckeditor/ckeditor5-utils/src/ckeditorerror';

export default class StrapiUploadAdapter extends Plugin {
	static get requires() {
		return [FileRepository];
	}

	static get pluginName() {
		return 'StrapiUploadAdapter';
	}

	init() {
		const options = this.editor.config.get('strapiUpload');

		if (!options) {
			return;
		}

		if (!options.uploadUrl) {
			console.warn(attachLinkToDocumentation(
				'strapi-upload-adapter-missing-uploadUrl: Missing the "uploadUrl" property in the "upload" editor configuration.'
			));

			return;
		}

		this.editor.plugins.get(FileRepository).createUploadAdapter = loader => {
			return new Adapter(loader, options);
		};
	}
}

class Adapter {
	constructor(loader, options) {
		this.loader = loader;

		this.options = options;
	}

	upload() {
		return this.loader.file
			.then(file => new Promise((resolve, reject) => {
				this._initRequest();
				this._initListeners(resolve, reject, file);
				this._sendRequest(file);
			}));
	}

	abort() {
		if ( this.xhr ) {
			this.xhr.abort();
		}
	}

	_initRequest() {
		const xhr = this.xhr = new XMLHttpRequest();

		xhr.open('POST', this.options.uploadUrl, true);
		xhr.responseType = 'json';
	}

	_initListeners(resolve, reject, file) {
		const xhr = this.xhr;
		const loader = this.loader;
		const genericErrorText = `Couldn't upload file: ${file.name}.`;

		xhr.addEventListener('error', () => reject(genericErrorText));
		xhr.addEventListener('abort', () => reject());
		xhr.addEventListener('load', () => {
			const response = xhr.response;

			if (!response || response.error) {
				return reject( response && response.error && response.error.message ? response.error.message : genericErrorText );
			}

			const urls = {};
			if (Array.isArray(response) && response.length > 0) {
				urls.default = response[0].url;
				Object.keys(response[0].formats).forEach(key => {
					urls[response[0].formats[key].width] = response[0].formats[key].url;
				});
			}

			resolve(urls);
		});

		// Upload progress when it is supported.
		/* istanbul ignore else */
		if (xhr.upload) {
			xhr.upload.addEventListener('progress', evt => {
				if (evt.lengthComputable) {
					loader.uploadTotal = evt.total;
					loader.uploaded = evt.loaded;
				}
			});
		}
	}

	_sendRequest( file ) {
		// Set headers if specified.
		const headers = this.options.headers || {};

		// Use the withCredentials flag if specified.
		const withCredentials = this.options.withCredentials || false;

		for (const headerName of Object.keys(headers)) {
			this.xhr.setRequestHeader( headerName, headers[ headerName ] );
		}

		this.xhr.withCredentials = withCredentials;

		// Prepare the form data.
		const data = new FormData();

		data.append('files', file);

		// Send the request.
		this.xhr.send(data);
	}
}
