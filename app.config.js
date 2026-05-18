const { expo } = require("./app.json");

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

module.exports = {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      config: {
        ...(expo.android?.config ?? {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...expo.ios,
      config: {
        ...(expo.ios?.config ?? {}),
        googleMapsApiKey,
      },
    },
  },
};
