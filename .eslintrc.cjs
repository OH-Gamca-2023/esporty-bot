module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
	plugins: ['@typescript-eslint'],
	ignorePatterns: ['*.cjs'],
	settings: {},
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2020
	},
	env: {
		browser: true,
		es2017: true,
		node: true
	},
	rules: {
		"prefer-const":"off",
		"@typescript-eslint/no-non-null-assertion":"off",
		"no-fallthrough":"off",
		'no-case-declarations': 'off',
		"@typescript-eslint/no-explicit-any":"off",
		"@typescript-eslint/no-unused-vars":"off",
	}
};
