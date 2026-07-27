import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ProvedorAuth } from './auth/contexto-auth';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetch ao voltar para a aba atrapalharia a demonstracao da atualizacao
      // otimista, alem de gerar requests que ninguem pediu.
      refetchOnWindowFocus: false,
    },
  },
});

const elementoRaiz = document.getElementById('root');

if (elementoRaiz === null) {
  throw new Error('Elemento #root nao encontrado em index.html');
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ProvedorAuth>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ProvedorAuth>
    </QueryClientProvider>
  </StrictMode>,
);
