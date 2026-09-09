const fs = require("fs");
const path = require("path");

const appJson = require("./app.json");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(__dirname, ".env.local"));

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  "";

module.exports = () => {
  const expoConfig = appJson.expo;

  return {
    ...expoConfig,
    android: {
      ...expoConfig.android,
      config: {
        ...expoConfig.android?.config,
        ...(googleMapsApiKey
          ? {
              googleMaps: {
                ...expoConfig.android?.config?.googleMaps,
                apiKey: googleMapsApiKey,
              },
            }
          : {}),
      },
    },
  };
};
