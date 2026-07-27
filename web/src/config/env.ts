function obrigatoria(chave: string, valor: string | undefined): string {
  if (valor === undefined || valor.trim() === '') {
    throw new Error(
      `Variavel de ambiente ${chave} nao definida. Copie web/.env.example para web/.env.`,
    );
  }
  return valor.replace(/\/+$/, '');
}

export const env = {
  authUrl: obrigatoria('VITE_AUTH_URL', import.meta.env.VITE_AUTH_URL),
  apiUrl: obrigatoria('VITE_API_URL', import.meta.env.VITE_API_URL),
} as const;
