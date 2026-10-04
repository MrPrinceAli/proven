module.exports = {
  overrides: [
    {
      // The toolkit runs in the browser (independent verification, W7): no Node built-ins.
      files: ["src/**/*.ts"],
      excludedFiles: ["src/**/*.test.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          { patterns: ["node:*", "crypto", "fs", "path", "buffer", "stream", "util"] },
        ],
      },
    },
  ],
};
