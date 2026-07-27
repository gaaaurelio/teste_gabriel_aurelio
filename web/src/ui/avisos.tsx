import { useCallback, useEffect, useRef, useState } from 'react';

export type TipoAviso = 'erro' | 'sucesso';

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensagem: string;
}

const DURACAO_MS = 6000;

/**
 * Avisos flutuantes. E aqui que a mensagem de erro do rollback aparece: sem
 * isso, desfazer a mudanca otimista seria silencioso e a pessoa veria o status
 * "voltar sozinho" sem explicacao.
 */
export function useAvisos() {
  const [avisos, setAvisos] = useState<readonly Aviso[]>([]);
  const proximoId = useRef(1);
  const temporizadores = useRef<number[]>([]);

  const fechar = useCallback((id: number) => {
    setAvisos((atuais) => atuais.filter((aviso) => aviso.id !== id));
  }, []);

  const mostrar = useCallback(
    (tipo: TipoAviso, mensagem: string) => {
      const id = proximoId.current++;
      setAvisos((atuais) => [...atuais, { id, tipo, mensagem }]);

      const temporizador = window.setTimeout(() => fechar(id), DURACAO_MS);
      temporizadores.current.push(temporizador);
    },
    [fechar],
  );

  // Evita "setState em componente desmontado" se a pagina sair antes do timeout.
  useEffect(
    () => () => {
      for (const temporizador of temporizadores.current) {
        window.clearTimeout(temporizador);
      }
    },
    [],
  );

  const erro = useCallback(
    (mensagem: string) => mostrar('erro', mensagem),
    [mostrar],
  );
  const sucesso = useCallback(
    (mensagem: string) => mostrar('sucesso', mensagem),
    [mostrar],
  );

  return { avisos, erro, sucesso, fechar };
}

interface PropsListaAvisos {
  avisos: readonly Aviso[];
  onFechar: (id: number) => void;
}

export function ListaAvisos({ avisos, onFechar }: PropsListaAvisos) {
  if (avisos.length === 0) {
    return null;
  }

  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((aviso) => (
        <div key={aviso.id} className={`aviso aviso--${aviso.tipo}`}>
          <span>{aviso.mensagem}</span>
          <button
            type="button"
            className="aviso__fechar"
            onClick={() => onFechar(aviso.id)}
            aria-label="Fechar aviso"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
