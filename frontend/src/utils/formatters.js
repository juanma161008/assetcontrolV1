const isWhitespaceToken = (token = "") => /^\s+$/.test(token);

export const toProperCase = (value = "") =>
  String(value ?? "")
    .split(/(\s+)/)
    .map((token) => {
      if (!token || isWhitespaceToken(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join("");
