import { IsIn, IsOptional } from 'class-validator';
import {
  CONTRATACAO_STATUSES,
  type ContratacaoStatus,
} from '../contratacao-status';

export class ListContratacoesQuery {
  /** Ausente = sem filtro, devolve todos os status. */
  @IsOptional()
  @IsIn(CONTRATACAO_STATUSES, {
    message: `status deve ser um de: ${CONTRATACAO_STATUSES.join(', ')}`,
  })
  status?: ContratacaoStatus;
}
