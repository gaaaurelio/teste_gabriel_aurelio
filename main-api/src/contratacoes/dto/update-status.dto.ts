import { IsIn } from 'class-validator';
import {
  CONTRATACAO_STATUSES,
  type ContratacaoStatus,
} from '../contratacao-status';

export class UpdateStatusDto {
  /**
   * A lista aceita vem da mesma constante usada pela regra de negocio, para
   * que incluir um status novo no dominio nao exija lembrar de atualizar o DTO.
   */
  @IsIn(CONTRATACAO_STATUSES, {
    message: `status deve ser um de: ${CONTRATACAO_STATUSES.join(', ')}`,
  })
  status!: ContratacaoStatus;
}
