const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const config = require('./.eslintrc.json');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

module.exports = [...compat.config(config)];
