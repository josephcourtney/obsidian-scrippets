import pluginJs from "@eslint/js";

export default [
  pluginJs.configs.recommended,
  { languageOptions: { sourceType: "module" } },
];

