// SPDX-License-Identifier: MIT
export default {
  fetch(request) {
    const country =
      request.cf?.country ?? request.headers.get("CF-IPCountry") ?? null;
    return Response.json(
      { region: typeof country === "string" ? country.toUpperCase() : null },
      {
        headers: {
          "cache-control": "private, max-age=300",
          vary: "CF-IPCountry",
        },
      },
    );
  },
};
