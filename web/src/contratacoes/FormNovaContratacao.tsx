import { useState } from 'react';
import { PRODUTOS, type NovaContratacao } from './tipos';

interface Props {
  onEnviar: (dados: NovaContratacao) => void;
  enviando: boolean;
}

const VAZIO: NovaContratacao = {
  nomeCliente: '',
  email: '',
  produto: PRODUTOS[0],
};

export function FormNovaContratacao({ onEnviar, enviando }: Props) {
  const [dados, setDados] = useState<NovaContratacao>(VAZIO);

  function alterar<C extends keyof NovaContratacao>(
    campo: C,
    valor: NovaContratacao[C],
  ) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    onEnviar(dados);
  }

  return (
    <form className="cartao form-nova" onSubmit={aoEnviar}>
      <h2>Nova contratacao</h2>

      <div className="form-nova__campos">
        <label className="campo">
          <span>Nome do cliente</span>
          <input
            type="text"
            value={dados.nomeCliente}
            onChange={(evento) => alterar('nomeCliente', evento.target.value)}
            minLength={3}
            maxLength={120}
            placeholder="Ex.: Maria Souza"
            required
          />
        </label>

        <label className="campo">
          <span>E-mail</span>
          <input
            type="email"
            value={dados.email}
            onChange={(evento) => alterar('email', evento.target.value)}
            placeholder="maria@empresa.com"
            required
          />
        </label>

        <label className="campo">
          <span>Produto</span>
          <select
            value={dados.produto}
            onChange={(evento) => alterar('produto', evento.target.value)}
          >
            {PRODUTOS.map((produto) => (
              <option key={produto} value={produto}>
                {produto}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button type="submit" className="botao botao--primario" disabled={enviando}>
        {enviando ? 'Criando...' : 'Criar contratacao'}
      </button>

      <p className="texto-secundario">
        Toda contratacao nasce com status <strong>solicitado</strong> — quem
        define isso e o servidor, nao o formulario.
      </p>
    </form>
  );
}
