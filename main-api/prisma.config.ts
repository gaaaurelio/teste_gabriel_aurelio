import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// A partir do Prisma 7 a URL do banco nao fica mais no schema.prisma: ela e
// resolvida aqui, o que permite ler a env var de qualquer fonte (arquivo .env
// localmente, variavel injetada pelo docker-compose no container).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
