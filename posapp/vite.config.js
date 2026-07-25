import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa';
import proxyOptions from './proxyOptions';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			strategies: 'generateSW',
			registerType: 'prompt',
			injectRegister: false,
			devOptions: {
				enabled: false,
			},
			// The manifest is a static public/manifest.webmanifest file (linked
			// directly from index.html) instead of plugin-generated: the plugin
			// auto-adds manifest.webmanifest + its icons to the Workbox precache
			// list with plain relative URLs that only resolve correctly when
			// sw.js is served from its default build-output location. Ours is
			// deliberately re-served from an API endpoint instead (see the
			// modifyURLPrefix comment below), which breaks those relative
			// lookups - so precaching them isn't worth the plugin's automatic
			// (broken) wiring here; the manifest/icons are still reachable by
			// normal HTTP fetch for the install prompt, which doesn't go
			// through the service worker at all.
			manifest: false,
			workbox: {
				cleanupOutdatedCaches: true,
				// clientsClaim (without skipWaiting) lets the waiting worker's
				// activation control already-open tabs once the user confirms
				// the "update available" prompt (see src/pwa/PwaUpdateBanner.jsx),
				// firing the 'controlling' event workbox-window listens for.
				clientsClaim: true,
				// sw.js is re-served from an API endpoint (see easy_pos/api/pwa.py)
				// so it can carry a Service-Worker-Allowed header wide enough to
				// control /posapp/*. Workbox resolves relative precache/runtime
				// URLs against the SW script's own location, which would then be
				// wrong (/api/method/...) - inline the runtime and rewrite every
				// precache URL to the real absolute asset path so lookups work
				// regardless of where the SW script itself is fetched from.
				inlineWorkboxRuntime: true,
				modifyURLPrefix: {
					'': '/assets/easy_pos/posapp/',
				},
				navigateFallback: '/assets/easy_pos/posapp/index.html',
				runtimeCaching: [
					{
						// Never cache Frappe API calls - auth is cookie-based and
						// responses must always be fetched fresh (see CLAUDE.md).
						urlPattern: /\/api\//,
						handler: 'NetworkOnly',
					},
				],
			},
		}),
	],
	server: {
		port: 8080,
		host: '0.0.0.0',
		proxy: proxyOptions
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src')
		}
	},
	build: {
		outDir: '../easy_pos/public/posapp',
		emptyOutDir: true,
		target: 'es2015',
	},
});