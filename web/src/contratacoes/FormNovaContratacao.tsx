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
    <form className="form-nova" onSubmit={aoEnviar}>
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

      <p className="texto-secundario" style={{ margin: 0 }}>
        Toda contratação nasce com status <strong>solicitado</strong> — o
        servidor define isso, não o formulário.
      </p>

      <button
        type="submit"
        className="botao botao--primario"
        disabled={enviando}
        style={{ alignSelf: 'flex-end', marginTop: '0.25rem' }}
      >
        {enviando ? 'Criando...' : 'Criar contratação'}
      </button>
    </form>
  );
}
