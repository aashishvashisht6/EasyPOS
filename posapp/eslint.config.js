import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	globalIgnores(["dist"]),
	{
		files: ["**/*.{js,jsx}"],
		extends: [
			js.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			parserOptions: {
				ecmaVersion: "latest",
				ecmaFeatures: { jsx: true },
				sourceType: "module",
			},
		},
		rules: {
			"no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
		},
	},
	{
		// Build-tooling config files run under Node directly (Vite's config
		// loader), not the browser — they need __dirname/require/process, not
		// browser globals, and aren't part of the shipped app bundle.
		files: ["vite.config.js", "proxyOptions.js"],
		languageOptions: {
			globals: globals.node,
		},
	},
]);
