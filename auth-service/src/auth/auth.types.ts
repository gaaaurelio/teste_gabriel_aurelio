/** Conteudo que assinamos dentro do JWT do usuario. */
export interface JwtUserPayload {
  sub: string;
  email: string;
  name: string;
}

/** Payload decodificado, ja com os campos que o proprio JWT acrescenta. */
export interface DecodedJwtUserPayload extends JwtUserPayload {
  iat: number;
  exp: number;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface ValidateTokenResponse {
  valid: true;
  payload: DecodedJwtUserPayload;
  /** Repetido em formato amigavel para facilitar debug manual via curl. */
  expiresAt: string;
}
