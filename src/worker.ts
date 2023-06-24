interface Env {
	MY_BUCKET: R2Bucket;
	AUTH_KEY_SECRET: string;
}

function objectNotFound(objectName: string): Response {
	return new Response(`<html><body>R2 object "<b>${objectName}</b>" not found</body></html>`, {
		status: 404,
		headers: {
			'content-type': 'text/html; charset=UTF-8',
		},
	});
}

function authorizeRequest(request: Request, env: Env): boolean {
	return request.headers.get('x-turistikrota-auth') === env.AUTH_KEY_SECRET;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const objectName = url.pathname.slice(1);
		const params = new URLSearchParams(url.search);
		const copy = params.get('copy');

		if (!authorizeRequest(request, env)) {
			return new Response(`Unauthorized`, {
				status: 401,
			});
		}

		if (!!copy && request.method === 'POST') {
			const object = await env.MY_BUCKET.get(objectName);
			if (!object) {
				return objectNotFound(objectName);
			}
			const copyName = copy;
			await env.MY_BUCKET.put(copyName, object.body, {
				httpMetadata: object.httpMetadata,
			});
			return new Response(null, {
				headers: {
					etag: object.httpEtag,
				},
			});
		}

		if (request.method === 'PUT') {
			const object = await env.MY_BUCKET.put(objectName, request.body, {
				httpMetadata: request.headers,
			});
			return new Response(null, {
				status: 201,
				headers: {
					etag: object.httpEtag,
				},
			});
		}
		if (request.method === 'DELETE') {
			await env.MY_BUCKET.delete(url.pathname.slice(1));
			return new Response();
		}

		return new Response(`Unsupported method`, {
			status: 400,
		});
	},
};
