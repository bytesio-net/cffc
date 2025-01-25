export default {
  '.{json,yaml,yml}': ['prettier --write'],
  '.{css,scss}': ['prettier --write', 'stylelint --fix'],
  '*.{mjs,js,jsx,ts,tsx}': ['prettier --write', 'eslint --fix'],
};
