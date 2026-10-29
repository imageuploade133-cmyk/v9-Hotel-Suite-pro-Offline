try {
  Object.defineProperty(process.versions, 'node', {
    value: '20.18.0',
    writable: false,
    configurable: true,
  });
  Object.defineProperty(process, 'version', {
    value: 'v20.18.0',
    writable: false,
    configurable: true,
  });
} catch (e) {}

if (typeof globalThis.Headers === 'undefined') {
  class Headers {
    constructor(init) {
      this._map = new Map();
      if (init) {
        if (init instanceof Headers) {
          init.forEach((v, k) => this.append(k, v));
        } else if (Array.isArray(init)) {
          init.forEach(([k, v]) => this.append(k, v));
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([k, v]) => this.append(k, String(v)));
        }
      }
    }
    append(name, value) {
      const key = String(name).toLowerCase();
      const existing = this._map.get(key);
      this._map.set(key, existing ? `${existing}, ${value}` : String(value));
    }
    delete(name) {
      this._map.delete(String(name).toLowerCase());
    }
    get(name) {
      return this._map.get(String(name).toLowerCase()) || null;
    }
    has(name) {
      return this._map.has(String(name).toLowerCase());
    }
    set(name, value) {
      this._map.set(String(name).toLowerCase(), String(value));
    }
    forEach(callback, thisArg) {
      this._map.forEach((value, key) => callback.call(thisArg, value, key, this));
    }
    keys() {
      return this._map.keys();
    }
    values() {
      return this._map.values();
    }
    entries() {
      return this._map.entries();
    }
    [Symbol.iterator]() {
      return this._map.entries();
    }
  }
  globalThis.Headers = Headers;
}

if (typeof globalThis.Request === 'undefined') {
  class Request {
    constructor(input, options = {}) {
      this.url = typeof input === 'string' ? input : (input && input.url) || '';
      this.method = options.method || (input && input.method) || 'GET';
      this.headers = new globalThis.Headers(options.headers || (input && input.headers));
      this.body = options.body || (input && input.body) || null;
    }
  }
  globalThis.Request = Request;
}

if (typeof globalThis.Response === 'undefined') {
  class Response {
    constructor(body = null, options = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.statusText = options.statusText || 'OK';
      this.headers = new globalThis.Headers(options.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }
    async text() {
      if (typeof this.body === 'string') return this.body;
      if (this.body instanceof Buffer) return this.body.toString('utf-8');
      return String(this.body || '');
    }
    async json() {
      const txt = await this.text();
      return JSON.parse(txt);
    }
  }
  globalThis.Response = Response;
}

if (typeof globalThis.fetch === 'undefined') {
  const http = require('http');
  const https = require('https');
  const { URL } = require('url');

  globalThis.fetch = function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const reqHeaders = {};
      if (options.headers) {
        new globalThis.Headers(options.headers).forEach((v, k) => {
          reqHeaders[k] = v;
        });
      }

      const req = transport.request(
        parsedUrl,
        {
          method: options.method || 'GET',
          headers: reqHeaders,
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const bodyBuffer = Buffer.concat(chunks);
            const responseHeaders = new globalThis.Headers(res.headers);
            const response = new globalThis.Response(bodyBuffer, {
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: responseHeaders,
            });
            resolve(response);
          });
        }
      );

      req.on('error', reject);

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  };
}
